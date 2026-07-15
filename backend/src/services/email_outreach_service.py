"""
Outreach composition: turn a pasted job description into a ready-to-send
application email. Recipient extraction is pure regex (no AI). Composition is a
single BYOK `generate_text` call, grounded in the user's profile and their
email-writing settings. Cost-conscious by design ([[prism-cost-constraint]]).
"""

import re
from datetime import datetime, timedelta
from typing import List, Optional, Tuple

from ..database import (
    get_email_drafts_collection,
    get_email_logs_collection,
    get_scraper_targets_collection,
)
from ..models.email_settings import EmailSettings
from .ai_service import AIService
from .profile_service import ProfileService, format_profile_for_prompt
from .email_settings_service import EmailSettingsService
from .logging_service import get_logger

logger = get_logger("email_outreach_service")

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")

# Local-parts we never auto-target.
_NOISE_LOCALPARTS = (
    "noreply", "no-reply", "donotreply", "do-not-reply", "support", "help",
    "info", "sales", "marketing", "privacy", "legal", "webmaster",
    "postmaster", "abuse", "unsubscribe", "notifications", "mailer-daemon",
)
# Local-parts that strongly indicate an application/recruiting inbox.
_APPLY_LOCALPARTS = (
    "career", "careers", "job", "jobs", "hr", "recruit", "recruiting",
    "recruitment", "apply", "application", "applications", "talent",
    "hiring", "cv", "resume", "resumes", "join", "work",
)
_APPLY_PHRASES = (
    "send your cv", "send your resume", "send cv", "send resume", "email your",
    "apply to", "apply via", "apply by", "applications to", "resume to",
    "cv to", "get in touch", "reach out to", "contact us at", "email us",
)

# Base email-writing rules — shared verbatim with the assistant's generate_email
# intent so both paths write in the same voice. Layered with per-user settings
# in `render_email_task`.
BASE_EMAIL_TASK = (
    "\nTASK: Write a job application / outreach email.\n"
    "- Start with a suggested subject line (as 'Subject: ...').\n"
    "- Keep the body under 180 words: hook, 2-3 concrete proof points drawn "
    "from the user's real experience matched to the role, and a confident, "
    "low-friction call to action.\n"
    "- Weave in one specific company detail from the research if available — "
    "it should feel researched, not templated.\n"
    "- Sound like a strong human candidate: direct, warm, zero clichés "
    "('I am writing to express...' is banned).\n"
    "- After the email, add a short '---' separated note listing what you "
    "personalized and anything the user should verify or fill in."
)

_PERSONA = (
    "You are Prism, a sharp and supportive AI career assistant helping the user "
    "apply to jobs by email.\n\n"
    "Ground every claim about the user in their profile data below — never invent "
    "experience, skills, employers, or metrics they don't have. If their profile "
    "lacks something relevant, leave it out.\n\n"
)

_TONE_HINT = {
    "formal": "Tone: polished and professional.",
    "warm": "Tone: warm, personable, and confident.",
    "direct": "Tone: direct and concise, no filler.",
}
_LENGTH_HINT = {
    "short": "Keep the body tight — under ~150 words.",
    "medium": "The body may run a bit longer — up to ~250 words if it earns it.",
}


def extract_recipients(text: str) -> Tuple[List[str], Optional[str]]:
    """
    Find plausible application email addresses in a pasted job description.
    Returns (ranked_candidates, best). Pure regex + heuristics — no AI.
    """
    if not text:
        return [], None
    lowered = text.lower()

    seen = set()
    scored = []
    for m in _EMAIL_RE.finditer(text):
        addr = m.group(0)
        key = addr.lower()
        if key in seen:
            continue
        seen.add(key)
        local = key.split("@", 1)[0]
        if any(n in local for n in _NOISE_LOCALPARTS):
            continue  # drop noreply/support/etc entirely

        score = 0
        if any(a in local for a in _APPLY_LOCALPARTS):
            score += 3
        # proximity: an apply phrase shortly before the address is a strong signal
        window = lowered[max(0, m.start() - 60):m.start()]
        if any(p in window for p in _APPLY_PHRASES):
            score += 2
        scored.append((score, addr))

    if not scored:
        return [], None
    # stable sort by score desc, preserving first-seen order for ties
    scored_sorted = sorted(range(len(scored)), key=lambda i: (-scored[i][0], i))
    candidates = [scored[i][1] for i in scored_sorted]
    return candidates, candidates[0]


def render_email_task(settings: Optional[EmailSettings]) -> str:
    """Base email rules + the user's tone/length/custom-instruction settings."""
    task = BASE_EMAIL_TASK
    if not settings:
        return task
    extras = []
    if settings.tone in _TONE_HINT:
        extras.append(_TONE_HINT[settings.tone])
    if settings.length in _LENGTH_HINT:
        extras.append(_LENGTH_HINT[settings.length])
    if settings.sender_name:
        extras.append(f"Sign off as {settings.sender_name}.")
    if settings.custom_instructions.strip():
        extras.append(
            "The user gave these extra instructions — follow them unless they'd "
            f"require fabricating facts:\n{settings.custom_instructions.strip()}"
        )
    if extras:
        task += "\n\nADDITIONAL STYLE GUIDANCE:\n- " + "\n- ".join(extras)
    return task


def _company_block_from_watchlist(targets_docs: List[dict], company: Optional[str]) -> str:
    """Build a short company-context block from CACHED watchlist research (no web/AI call)."""
    if not company:
        return ""
    company_l = company.strip().lower()
    match = None
    for doc in targets_docs:
        if (doc.get("company_name") or "").strip().lower() == company_l:
            match = doc
            break
    if not match:
        return ""
    lines = [f"COMPANY RESEARCH ({match.get('company_name')}):"]
    for key in ("description", "industry", "headquarters", "company_size", "website"):
        if match.get(key):
            lines.append(f"- {key}: {match[key]}")
    tps = match.get("talking_points") or []
    if tps:
        lines.append("- talking_points: " + "; ".join(str(t) for t in tps))
    return "\n".join(lines) if len(lines) > 1 else ""


def build_email_system_prompt(profile_text: str, company_block: str,
                              settings: Optional[EmailSettings]) -> str:
    prompt = _PERSONA + f"USER'S FULL CAREER PROFILE:\n{profile_text}\n"
    if company_block:
        prompt += f"\n{company_block}\n"
    prompt += render_email_task(settings)
    return prompt


def _parse_email_output(text: str) -> Tuple[str, str, str]:
    """Split raw model output into (subject, body, personalization_note)."""
    body = (text or "").strip()
    note = ""
    if "\n---" in body:
        head, _, tail = body.rpartition("\n---")
        body = head.strip()
        note = tail.strip().lstrip("-").strip()

    subject = ""
    lines = body.splitlines()
    for i, line in enumerate(lines):
        m = re.match(r"\s*subject\s*:\s*(.+)", line, re.I)
        if m:
            subject = m.group(1).strip()
            del lines[i]
            body = "\n".join(lines).strip()
            break
    return subject, body, note


class EmailOutreachService:
    @staticmethod
    async def compose_application_email(
        user_id: str,
        job_description: str,
        recipient: Optional[str] = None,
        company: Optional[str] = None,
        preferred_provider: Optional[str] = None,
    ) -> dict:
        """Compose a job-application email from a pasted JD (one AI call). Persists a draft."""
        profile = await ProfileService.get_or_create_profile(user_id)
        profile_text = format_profile_for_prompt(profile)
        settings = await EmailSettingsService.get_or_create(user_id)

        # Cached company context only (never a live web/AI research call here).
        targets = []
        if company:
            cursor = get_scraper_targets_collection().find({"user_id": user_id})
            async for doc in cursor:
                targets.append(doc)
        company_block = _company_block_from_watchlist(targets, company)

        system_prompt = build_email_system_prompt(profile_text, company_block, settings)
        user_prompt = (
            f"Here is the job posting I want to apply to:\n\n{job_description}\n\n"
            + (f"I'm emailing: {recipient}\n\n" if recipient else "")
            + "Write the application email now."
        )
        text, provider = await AIService.generate_text(
            user_id, system_prompt, user_prompt, preferred_provider=preferred_provider
        )

        subject, body, note = _parse_email_output(text)
        if settings.signature and settings.signature.strip() not in body:
            body = f"{body}\n\n{settings.signature.strip()}"
        candidates, best = extract_recipients(job_description)
        if not recipient:
            recipient = best

        now = datetime.utcnow()
        draft_doc = {
            "user_id": user_id,
            "job_description": job_description,
            "recipient": recipient,
            "company": company,
            "subject": subject,
            "body": body,
            "note": note,
            "provider_used": provider,
            "created_at": now,
        }
        result = await get_email_drafts_collection().insert_one(draft_doc)

        return {
            "draft_id": str(result.inserted_id),
            "subject": subject,
            "body": body,
            "note": note,
            "recipient": recipient,
            "recipients": candidates,
            "provider_used": provider,
        }

    @staticmethod
    async def compose_reply(
        user_id: str,
        conversation_text: str,
        category: str,
        preferred_provider: Optional[str] = None,
    ) -> str:
        """Draft a reply to an HR message given the thread context (one AI call)."""
        profile = await ProfileService.get_or_create_profile(user_id)
        profile_text = format_profile_for_prompt(profile)
        settings = await EmailSettingsService.get_or_create(user_id)

        system_prompt = (
            _PERSONA + f"USER'S FULL CAREER PROFILE:\n{profile_text}\n\n"
            "TASK: Write a concise, professional reply to the recruiter/HR message "
            "below. Match their tone, answer what they asked, and keep momentum "
            "toward a next step (a call, availability, or the info they requested). "
            "Never invent facts about the user. Output ONLY the reply body — no "
            "subject line, no preamble.\n"
            + (f"\nThe message looks like: {category}." if category else "")
            + (f"\nUser style guidance:\n{settings.custom_instructions.strip()}"
               if settings.custom_instructions.strip() else "")
            + (f"\nSign off as {settings.sender_name}." if settings.sender_name else "")
        )
        user_prompt = f"CONVERSATION SO FAR:\n{conversation_text}\n\nWrite my reply."
        text, _provider = await AIService.generate_text(
            user_id, system_prompt, user_prompt, preferred_provider=preferred_provider
        )
        body = text.strip()
        if settings.signature and settings.signature.strip() not in body:
            body = f"{body}\n\n{settings.signature.strip()}"
        return body

    # ------------------------------------------------------------------
    # Guardrail helpers (read email_logs)
    # ------------------------------------------------------------------

    @staticmethod
    async def count_sent_today(user_id: str) -> int:
        start = datetime.utcnow() - timedelta(hours=24)
        return await get_email_logs_collection().count_documents({
            "user_id": user_id,
            "direction": "outbound",
            "status": "sent",
            "sent_at": {"$gte": start},
        })

    @staticmethod
    async def already_emailed(user_id: str, to: str) -> bool:
        if not to:
            return False
        existing = await get_email_logs_collection().find_one({
            "user_id": user_id,
            "direction": "outbound",
            "status": "sent",
            "to": {"$regex": f"^{re.escape(to)}$", "$options": "i"},
        })
        return existing is not None
