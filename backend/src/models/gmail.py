from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class GmailConnection(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    google_email: str
    encrypted_access_token: str
    encrypted_refresh_token: str
    token_expiry: Optional[datetime] = None
    is_connected: bool = True
    connected_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class EmailSendRequest(BaseModel):
    to: str
    subject: str
    body: str  # Can be HTML
    application_id: Optional[str] = None


class EmailLog(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    to: str
    subject: str
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    application_id: Optional[str] = None
    status: str = "sent"  # sent | failed
    error_message: Optional[str] = None

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class GmailStatusResponse(BaseModel):
    is_connected: bool
    google_email: Optional[str] = None
    connected_at: Optional[datetime] = None


class EmailLogResponse(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    to: str
    subject: str
    sent_at: datetime
    application_id: Optional[str] = None
    status: str
    error_message: Optional[str] = None

    class Config:
        populate_by_name = True
