from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class GmailConnection(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    google_email: str
    encrypted_access_token: str
    encrypted_refresh_token: str
    token_expiry: Optional[datetime] = None
    is_connected: bool = True
    # Space-joined scopes granted at connect time (used to gate inbound features).
    granted_scopes: Optional[str] = None
    connected_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class EmailAttachment(BaseModel):
    filename: str
    mime_type: str = "application/pdf"
    content_b64: str  # base64-encoded file bytes


class EmailSendRequest(BaseModel):
    to: str
    subject: str
    body: str  # Can be HTML
    application_id: Optional[str] = None
    cc: Optional[str] = None
    bcc: Optional[str] = None
    attachments: List[EmailAttachment] = []


class EmailLog(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    to: str
    subject: str
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    application_id: Optional[str] = None
    status: str = "sent"  # sent | failed
    error_message: Optional[str] = None
    # --- threading + direction (optional; older logs won't have them) ---
    thread_id: Optional[str] = None
    message_id: Optional[str] = None
    direction: str = "outbound"  # outbound | inbound
    category: Optional[str] = None  # e.g. interview_request | question | rejection | other

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class GmailStatusResponse(BaseModel):
    is_connected: bool
    google_email: Optional[str] = None
    connected_at: Optional[datetime] = None
    # True when the stored grant includes the read/compose scopes needed for inbound.
    inbound_ready: bool = False


class EmailLogResponse(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    to: str
    subject: str
    sent_at: datetime
    application_id: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    thread_id: Optional[str] = None
    message_id: Optional[str] = None
    direction: str = "outbound"
    category: Optional[str] = None

    class Config:
        populate_by_name = True
