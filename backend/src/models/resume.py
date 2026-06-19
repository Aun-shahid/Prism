from enum import Enum
from datetime import datetime
from typing import Any, Dict, List, Optional
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
    # Current version's sections sent from frontend so AI can preserve IDs
    version_sections: Optional[List[Dict[str, Any]]] = None


class GeneratedDocResponse(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    application_id: Optional[str] = None
    generation_type: GenerationType
    job_description: str
    # Structured sections returned by AI (replaces resume_content string)
    resume_sections: Optional[List[Dict[str, Any]]] = None
    cover_letter_content: Optional[str] = None
    ai_provider_used: str
    created_at: datetime

    class Config:
        populate_by_name = True


# ─── Resume Version models ─────────────────────────────────────────────────────

class ResumeVersionDoc(BaseModel):
    """MongoDB document model for a resume version."""
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    title: str
    is_favorite: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_ai_tailored: bool = False
    ai_cover_letter: Optional[str] = None
    application_id: Optional[str] = None
    application_label: Optional[str] = None
    # Structured resume content — owned by the version, typed strictly on the frontend
    contact: Dict[str, Any] = Field(default_factory=dict)
    sections: List[Dict[str, Any]] = Field(default_factory=list)
    customization: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class ResumeVersionCreate(BaseModel):
    title: str
    is_favorite: bool = False
    is_ai_tailored: bool = False
    ai_cover_letter: Optional[str] = None
    application_id: Optional[str] = None
    application_label: Optional[str] = None
    contact: Dict[str, Any] = Field(default_factory=dict)
    sections: List[Dict[str, Any]] = Field(default_factory=list)
    customization: Dict[str, Any] = Field(default_factory=dict)


class ResumeVersionUpdate(BaseModel):
    title: Optional[str] = None
    is_favorite: Optional[bool] = None
    is_ai_tailored: Optional[bool] = None
    ai_cover_letter: Optional[str] = None
    application_id: Optional[str] = None
    application_label: Optional[str] = None
    contact: Optional[Dict[str, Any]] = None
    sections: Optional[List[Dict[str, Any]]] = None
    customization: Optional[Dict[str, Any]] = None


class ResumeVersionResponse(BaseModel):
    id: str
    user_id: str
    title: str
    is_favorite: bool
    created_at: datetime
    updated_at: datetime
    is_ai_tailored: bool
    ai_cover_letter: Optional[str] = None
    application_id: Optional[str] = None
    application_label: Optional[str] = None
    contact: Dict[str, Any]
    sections: List[Dict[str, Any]]
    customization: Dict[str, Any]

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}
