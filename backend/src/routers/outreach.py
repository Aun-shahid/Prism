from datetime import datetime
from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ..models.outreach import (
    ExtractRequest, ExtractResponse,
    ComposeRequest, ComposeResponse,
    OutreachSendRequest, OutreachSendResponse,
    InboundReplyResponse, SendReplyRequest, InboundPollResponse,
)
from ..models.gmail import EmailLogResponse
from ..models.applications import (
    ApplicationCreateRequest, ApplicationUpdateRequest, ApplicationStatus,
)
from ..models.users import User
from ..services.email_outreach_service import EmailOutreachService, extract_recipients
from ..services.email_settings_service import EmailSettingsService
from ..services.gmail_service import GmailService
from ..services.inbound_reply_service import InboundReplyService
from ..services.application_service import ApplicationService
from ..database import get_email_logs_collection
from ..auth.dependencies import get_current_active_user

router = APIRouter(prefix="/outreach", tags=["outreach"])


@router.post("/extract", response_model=ExtractResponse)
async def extract(
    data: ExtractRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Pull candidate application email addresses out of a pasted job description (no AI)."""
    recipients, best = extract_recipients(data.job_description)
    return ExtractResponse(recipients=recipients, best=best)


@router.post("/compose", response_model=ComposeResponse)
async def compose(
    data: ComposeRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Compose a tailored application email from the JD (one AI call). Returns a reviewable draft."""
    result = await EmailOutreachService.compose_application_email(
        current_user.id,
        data.job_description,
        recipient=data.recipient,
        company=data.company,
        preferred_provider=data.preferred_provider,
    )
    return ComposeResponse(**result)


@router.post("/send", response_model=OutreachSendResponse)
async def send(
    data: OutreachSendRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Send the (reviewed) application email, enforce guardrails, and log it to the pipeline."""
    settings = await EmailSettingsService.get_or_create(current_user.id)

    if not data.override_guardrails:
        sent_today = await EmailOutreachService.count_sent_today(current_user.id)
        if sent_today >= settings.daily_send_limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Daily send limit reached ({settings.daily_send_limit}). "
                    "Raise it in Email settings, or resend to override."
                ),
            )
        if settings.warn_already_emailed and await EmailOutreachService.already_emailed(current_user.id, data.to):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"You've already emailed {data.to}. Resend to override.",
            )

    # Optionally CC the user their own copy.
    cc = data.cc
    if settings.cc_self:
        conn = await GmailService.get_connection_status(current_user.id)
        if conn.google_email:
            cc = f"{cc}, {conn.google_email}" if cc else conn.google_email

    log = await GmailService.send_email(
        user_id=current_user.id,
        to=data.to,
        subject=data.subject,
        body=data.body,
        application_id=data.application_id,
        cc=cc,
        bcc=data.bcc,
        attachments=data.attachments,
    )

    # Link to the applications pipeline.
    application_id = data.application_id
    if data.create_application and not application_id:
        created = await ApplicationService.create_application(
            current_user.id,
            ApplicationCreateRequest(
                company=data.company or "Unknown",
                position=data.position or "Applied via email",
                contact_email=data.to,
                status=ApplicationStatus.APPLIED,
                job_description=data.job_description,
                applied_date=datetime.utcnow(),
            ),
        )
        application_id = created.id
    elif application_id:
        await ApplicationService.update_application(
            current_user.id,
            application_id,
            ApplicationUpdateRequest(
                status=ApplicationStatus.APPLIED,
                applied_date=datetime.utcnow(),
                contact_email=data.to,
            ),
        )

    return OutreachSendResponse(
        email_log=EmailLogResponse(**log.model_dump(by_alias=True)),
        application_id=application_id,
        warnings=[],
    )


# ─── Inbound (HR replies) ──────────────────────────────────────────────────────

@router.get("/replies", response_model=List[InboundReplyResponse])
async def list_replies(current_user: User = Depends(get_current_active_user)):
    """List detected HR replies (with any AI-drafted response) newest-first."""
    cursor = get_email_logs_collection().find(
        {"user_id": current_user.id, "direction": "inbound"}
    ).sort("sent_at", -1).limit(100)
    out = []
    async for doc in cursor:
        if doc.get("handled") == "dismissed":
            continue
        out.append(InboundReplyResponse(
            id=str(doc["_id"]),
            thread_id=doc.get("thread_id"),
            from_email=doc.get("reply_to") or doc.get("to"),
            subject=doc.get("subject"),
            category=doc.get("category"),
            handled=doc.get("handled"),
            draft_reply=doc.get("draft_reply"),
            reply_subject=doc.get("reply_subject"),
            received_at=doc.get("sent_at").isoformat() if doc.get("sent_at") else None,
        ))
    return out


@router.post("/poll", response_model=InboundPollResponse)
async def poll_inbound(current_user: User = Depends(get_current_active_user)):
    """Manually run the inbound reply check for the current user."""
    settings = await EmailSettingsService.get_or_create(current_user.id)
    ready = await GmailService.is_inbound_ready(current_user.id)
    handled = 0
    if settings.enable_inbound and ready:
        handled = await InboundReplyService.process_user_inbound(current_user.id, settings)
    return InboundPollResponse(handled=handled, inbound_ready=ready, enabled=settings.enable_inbound)


@router.post("/replies/{log_id}/send", response_model=EmailLogResponse)
async def send_reply(
    log_id: str,
    data: SendReplyRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Send an AI-drafted reply (optionally edited) in-thread, then clear the draft."""
    try:
        oid = ObjectId(log_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid id")

    logs = get_email_logs_collection()
    doc = await logs.find_one({"_id": oid, "user_id": current_user.id, "direction": "inbound"})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reply not found")

    body = (data.body or doc.get("draft_reply") or "").strip()
    if not body:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No reply body to send")

    log = await GmailService.send_email(
        user_id=current_user.id,
        to=doc.get("reply_to") or doc.get("to"),
        subject=doc.get("reply_subject") or f"Re: {doc.get('subject', '')}",
        body=body.replace("\n", "<br>"),
        thread_id=doc.get("thread_id"),
        in_reply_to=doc.get("rfc_message_id"),
        references=doc.get("rfc_message_id"),
        category=f"reply:{doc.get('category', 'other')}",
    )
    await GmailService.delete_draft(current_user.id, doc.get("gmail_draft_id"))
    await logs.update_one({"_id": oid}, {"$set": {"handled": "sent", "draft_reply": None, "gmail_draft_id": None}})
    return EmailLogResponse(**log.model_dump(by_alias=True))


@router.post("/replies/{log_id}/dismiss", status_code=status.HTTP_204_NO_CONTENT)
async def dismiss_reply(log_id: str, current_user: User = Depends(get_current_active_user)):
    """Dismiss a detected reply (removes it from the list; deletes any Gmail draft)."""
    try:
        oid = ObjectId(log_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid id")
    logs = get_email_logs_collection()
    doc = await logs.find_one({"_id": oid, "user_id": current_user.id, "direction": "inbound"})
    if doc:
        await GmailService.delete_draft(current_user.id, doc.get("gmail_draft_id"))
        await logs.update_one({"_id": oid}, {"$set": {"handled": "dismissed", "draft_reply": None, "gmail_draft_id": None}})
    return None
