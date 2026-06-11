from enum import Enum
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class GenerationType(str, Enum):
    RESUME = "resume"
    COVER_LETTER = "cover_letter"
    BOTH = "both"


class GeneratedDocument(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    application_id: Optional[str] = None
    generation_type: GenerationType
    job_description: str
    resume_content: Optional[str] = None
    cover_letter_content: Optional[str] = None
    ai_provider_used: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class ResumeGenerateRequest(BaseModel):
    job_description: str
    generation_type: GenerationType = GenerationType.BOTH
    preferred_provider: Optional[str] = None  # "openai" | "gemini" | "claude"
    application_id: Optional[str] = None


class GeneratedDocResponse(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    application_id: Optional[str] = None
    generation_type: GenerationType
    job_description: str
    resume_content: Optional[str] = None
    cover_letter_content: Optional[str] = None
    ai_provider_used: str
    created_at: datetime

    class Config:
        populate_by_name = True
