from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# Presets kept as plain strings (validated loosely) so the UI can evolve without
# a migration. Unknown values fall back to sane defaults in the prompt builder.
DEFAULT_DAILY_SEND_LIMIT = 25
MAX_CUSTOM_INSTRUCTIONS = 2000  # hard cap before the text reaches the model


class EmailSettings(BaseModel):
    """Per-user controls for how outreach emails are written and sent."""
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str

    # --- How the AI writes ---
    custom_instructions: str = ""          # free-form, appended to the base rules
    tone: str = "warm"                     # formal | warm | direct
    length: str = "short"                  # short | medium
    signature: str = ""                    # appended to every email body
    sender_name: str = ""                  # display name / how they sign off

    # --- Outbound behaviour ---
    attach_resume: bool = False
    default_resume_version_id: Optional[str] = None
    outbound_auto_send: bool = False       # False = review first
    daily_send_limit: int = DEFAULT_DAILY_SEND_LIMIT
    cc_self: bool = False
    warn_already_emailed: bool = True

    # --- Inbound (HR replies) ---
    enable_inbound: bool = False           # opt-in; needs broader Gmail scopes
    inbound_auto_reply: bool = False       # False = draft for review

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class EmailSettingsUpdateRequest(BaseModel):
    custom_instructions: Optional[str] = None
    tone: Optional[str] = None
    length: Optional[str] = None
    signature: Optional[str] = None
    sender_name: Optional[str] = None
    attach_resume: Optional[bool] = None
    default_resume_version_id: Optional[str] = None
    outbound_auto_send: Optional[bool] = None
    daily_send_limit: Optional[int] = None
    cc_self: Optional[bool] = None
    warn_already_emailed: Optional[bool] = None
    enable_inbound: Optional[bool] = None
    inbound_auto_reply: Optional[bool] = None


class EmailSettingsResponse(BaseModel):
    custom_instructions: str = ""
    tone: str = "warm"
    length: str = "short"
    signature: str = ""
    sender_name: str = ""
    attach_resume: bool = False
    default_resume_version_id: Optional[str] = None
    outbound_auto_send: bool = False
    daily_send_limit: int = DEFAULT_DAILY_SEND_LIMIT
    cc_self: bool = False
    warn_already_emailed: bool = True
    enable_inbound: bool = False
    inbound_auto_reply: bool = False
