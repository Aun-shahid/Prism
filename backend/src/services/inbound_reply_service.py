"""
Inbound loop: watch the threads we sent application emails on, detect NEW replies
from HRs, and (per the user's settings) either draft a reply for review or send
one automatically. Opt-in per user (`enable_inbound`) and needs the wider Gmail
scopes; only ever touches threads we started — never the whole mailbox.

Cost control: one AI call per genuinely-new inbound message, capped per run.
"""

from datetime import datetime
from typing import List

from ..database import get_email_logs_collection, get_email_settings_collection
from ..models.email_settings import EmailSettings
from .ai_service import AIService
from .gmail_service import GmailService
from .profile_service import ProfileService, format_profile_for_prompt
from .logging_service import get_logger

logger = get_logger("inbound_reply_service")

# Bound cost: at most this many new inbound messages processed per user per run.
_MAX_INBOUND_PER_RUN = 8
# Categories we're willing to auto-reply to (never rejections/ambiguous).
_AUTO_REPLY_OK = {"interview_request", "question"}

_CLASSIFY_SYSTEM = (
    "You are Prism, the user's job-application assistant. The user emailed a "
    "company to apply for a role; below is the email thread. Look at the LATEST "
    "message from the recruiter/HR and do two things:\n"
    "1. Classify it as one of: interview_request | question | rejection | other.\n"
    "2. Draft the user's reply body (no subject, no preamble). If a reply isn't "
    "warranted (e.g. a plain rejection), return an empty reply.\n"
    "Ground everything in the user's real profile below — never invent facts. "
    "Keep replies concise, warm, and momentum-building.\n\n"
    "Return JSON: {\"category\": \"...\", \"reply\": \"...\"}\n\n"
    "USER'S PROFILE:\n{profile}\n"
)


class InboundReplyService:
    @staticmethod
    async def _already_processed(user_id: str, message_id: str) -> bool:
        doc = await get_email_logs_collection().find_one({
            "user_id": user_id,
            "direction": "inbound",
            "message_id": message_id,
        })
        return doc is not None

    @staticmethod
    async def _tracked_thread_ids(user_id: str) -> List[str]:
        """Thread ids we have sent outbound mail on."""
        cursor = get_email_logs_collection().find(
            {"user_id": user_id, "direction": "outbound", "thread_id": {"$ne": None}},
            {"thread_id": 1},
        )
        ids = set()
        async for doc in cursor:
            if doc.get("thread_id"):
                ids.add(doc["thread_id"])
        return list(ids)

    @staticmethod
    async def process_user_inbound(user_id: str, settings: EmailSettings) -> int:
        """Process new HR replies for one user. Returns count of messages handled."""
        if not settings.enable_inbound:
            return 0
        if not await GmailService.is_inbound_ready(user_id):
            logger.info(f"User {user_id} has inbound enabled but hasn't granted read scope; skipping.")
            return 0

        profile = await ProfileService.get_or_create_profile(user_id)
        profile_text = format_profile_for_prompt(profile)
        logs = get_email_logs_collection()

        handled = 0
        for thread_id in await InboundReplyService._tracked_thread_ids(user_id):
            if handled >= _MAX_INBOUND_PER_RUN:
                break
            try:
                messages = await GmailService.get_thread_messages(user_id, thread_id)
            except Exception as e:
                logger.warning(f"Failed to read thread {thread_id} for {user_id}: {e}")
                continue

            inbound = [m for m in messages if m.get("is_inbound")]
            for msg in inbound:
                if handled >= _MAX_INBOUND_PER_RUN:
                    break
                mid = msg.get("id")
                if not mid or await InboundReplyService._already_processed(user_id, mid):
                    continue

                try:
                    await InboundReplyService._handle_message(
                        user_id, settings, profile_text, thread_id, msg, messages
                    )
                    handled += 1
                except Exception as e:
                    logger.error(f"Failed handling inbound msg {mid} for {user_id}: {e}")
                    # Still record it so we don't retry forever on a poison message.
                    await logs.insert_one({
                        "user_id": user_id, "to": msg.get("from", ""),
                        "subject": msg.get("subject", ""), "sent_at": datetime.utcnow(),
                        "direction": "inbound", "message_id": mid, "thread_id": thread_id,
                        "status": "failed", "error_message": str(e), "category": "other",
                    })
        return handled

    @staticmethod
    async def _handle_message(user_id, settings, profile_text, thread_id, msg, thread_messages):
        # Build the conversation text (oldest → newest) for grounding.
        convo = "\n\n".join(
            f"[{'HR' if m.get('is_inbound') else 'Me'}] {m.get('snippet', '')}"
            for m in thread_messages
        )
        latest_body = await GmailService.get_message_text(user_id, msg["id"])
        convo += f"\n\n[HR — latest, full text]\n{latest_body}"

        system = _CLASSIFY_SYSTEM.replace("{profile}", profile_text)
        result, _provider = await AIService.generate_json(
            user_id, system, f"THREAD:\n{convo}\n\nClassify + draft the reply.", purpose="tailor"
        )
        category = (result.get("category") or "other").strip().lower()
        reply = (result.get("reply") or "").strip()
        if settings.signature and reply and settings.signature.strip() not in reply:
            reply = f"{reply}\n\n{settings.signature.strip()}"

        sender = msg.get("from", "")
        subject = msg.get("subject", "")
        reply_subject = subject if subject.lower().startswith("re:") else f"Re: {subject}"
        rfc_id = msg.get("rfc_message_id") or None

        action = "notified"
        gmail_draft_id = None
        if reply:
            if settings.inbound_auto_reply and category in _AUTO_REPLY_OK:
                await GmailService.send_email(
                    user_id=user_id, to=sender, subject=reply_subject, body=reply.replace("\n", "<br>"),
                    thread_id=thread_id, in_reply_to=rfc_id, references=rfc_id,
                    direction="outbound", category=f"reply:{category}",
                )
                action = "auto_replied"
            else:
                gmail_draft_id = await GmailService.create_draft(
                    user_id=user_id, to=sender, subject=reply_subject,
                    body=reply.replace("\n", "<br>"), thread_id=thread_id,
                    in_reply_to=rfc_id, references=rfc_id,
                )
                action = "drafted"

        # Mark this inbound message processed so we never handle it twice, and keep
        # the drafted reply so the user can review + send it from the app.
        await get_email_logs_collection().insert_one({
            "user_id": user_id, "to": sender, "subject": subject,
            "sent_at": datetime.utcnow(), "direction": "inbound", "message_id": msg["id"],
            "thread_id": thread_id, "status": "received", "category": category,
            "handled": action,
            "reply_to": sender,
            "reply_subject": reply_subject,
            "rfc_message_id": rfc_id,
            "draft_reply": reply if action == "drafted" else None,
            "gmail_draft_id": gmail_draft_id,
        })

        # Notify the user (rides the existing SSE notification stream).
        try:
            from .notification_service import NotificationService
            labels = {
                "auto_replied": "replied automatically",
                "drafted": "a reply is drafted for your review",
                "notified": "no reply needed",
            }
            await NotificationService.create_notification(
                user_id=user_id,
                title=f"HR replied ({category.replace('_', ' ')})",
                message=f"{sender or 'A recruiter'} responded — {labels.get(action, action)}.",
                type="hr_reply",
            )
        except Exception as e:
            logger.error(f"Failed to notify user {user_id} of HR reply: {e}")


async def run_inbound_reply_poll():
    """Scheduler entry point: process inbound replies for every opt-in user."""
    settings_col = get_email_settings_collection()
    processed_users = 0
    async for doc in settings_col.find({"enable_inbound": True}):
        doc["_id"] = str(doc["_id"])
        try:
            settings = EmailSettings(**doc)
            count = await InboundReplyService.process_user_inbound(settings.user_id, settings)
            if count:
                processed_users += 1
                logger.info(f"Processed {count} inbound HR message(s) for user {settings.user_id}")
        except Exception as e:
            logger.error(f"Inbound poll failed for a user: {e}")
    if processed_users:
        logger.info(f"Inbound reply poll handled replies for {processed_users} user(s).")
