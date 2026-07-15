from typing import List, Optional
from pydantic import BaseModel

from .gmail import EmailAttachment, EmailLogResponse


class ExtractRequest(BaseModel):
    job_description: str


class ExtractResponse(BaseModel):
    recipients: List[str] = []
    best: Optional[str] = None


class ComposeRequest(BaseModel):
    job_description: str
    recipient: Optional[str] = None
    company: Optional[str] = None
    preferred_provider: Optional[str] = None


class ComposeResponse(BaseModel):
    draft_id: str
    subject: str
    body: str
    note: str = ""
    recipient: Optional[str] = None
    recipients: List[str] = []
    provider_used: Optional[str] = None


class OutreachSendRequest(BaseModel):
    to: str
    subject: str
    body: str
    cc: Optional[str] = None
    bcc: Optional[str] = None
    attachments: List[EmailAttachment] = []
    application_id: Optional[str] = None
    company: Optional[str] = None
    position: Optional[str] = None
    job_description: Optional[str] = None
    create_application: bool = True
    override_guardrails: bool = False  # resend past the already-emailed / daily-cap guard


class OutreachSendResponse(BaseModel):
    email_log: EmailLogResponse
    application_id: Optional[str] = None
    warnings: List[str] = []


class InboundReplyResponse(BaseModel):
    id: str
    thread_id: Optional[str] = None
    from_email: Optional[str] = None
    subject: Optional[str] = None
    category: Optional[str] = None
    handled: Optional[str] = None       # drafted | auto_replied | notified | sent | dismissed
    draft_reply: Optional[str] = None
    reply_subject: Optional[str] = None
    received_at: Optional[str] = None


class SendReplyRequest(BaseModel):
    body: Optional[str] = None          # optional edited body; falls back to the stored draft


class InboundPollResponse(BaseModel):
    handled: int = 0
    inbound_ready: bool = True
    enabled: bool = True
