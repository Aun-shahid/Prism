from enum import Enum
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class AIProvider(str, Enum):
    OPENAI = "openai"
    GEMINI = "gemini"
    CLAUDE = "claude"


class APIKeyDocument(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    provider: AIProvider
    encrypted_key: str
    label: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class APIKeyCreateRequest(BaseModel):
    provider: AIProvider
    api_key: str  # Plaintext — will be encrypted before storage
    label: Optional[str] = None


class APIKeyUpdateRequest(BaseModel):
    api_key: Optional[str] = None
    label: Optional[str] = None
    is_active: Optional[bool] = None


class APIKeyResponse(BaseModel):
    id: str
    provider: AIProvider
    label: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
        # Never expose the actual key
