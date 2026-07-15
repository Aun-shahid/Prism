from enum import Enum
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

# Resume versions round-trip camelCase JSON with the frontend (createdAt,
# isFavorite, isAiTailored, aiCoverLetter, ...). Accept camelCase on input and
# emit it on output, while Python code keeps snake_case field names.
_CAMEL_CONFIG = ConfigDict(populate_by_name=True, alias_generator=to_camel)


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


class ResumeTailorRequest(BaseModel):
    """Prompt-driven resume edit. The AI returns only the affected fields as
    edit operations (see ResumeTailorResponse.operations), never the whole resume."""
    instruction: Optional[str] = None       # natural-language edit, e.g. "remove 2 projects, add 2"
    job_description: Optional[str] = None    # optional tailoring context
    sections: List[Dict[str, Any]] = Field(default_factory=list)  # current version's sections (with ids)
    want_resume: bool = True                 # produce resume edit operations
    want_cover_letter: bool = False          # also produce a cover letter
    preferred_provider: Optional[str] = None  # "openai" | "gemini" | "claude"


class ResumeTailorResponse(BaseModel):
    """Affected-fields-only result of a tailor request."""
    operations: List[Dict[str, Any]] = Field(default_factory=list)
    summary: str = ""                        # human-readable recap of the changes
    cover_letter: Optional[str] = None
    provider_used: Optional[str] = None


class BulletImproveRequest(BaseModel):
    """Ask the AI to coach one resume bullet / description into best-practice shape."""
    text: str
    context: Optional[str] = None  # e.g. "Software Engineer at Acme"
    job_description: Optional[str] = None
    preferred_provider: Optional[str] = None


class BulletImproveResponse(BaseModel):
    improved: str
    alternatives: List[str] = []
    tips: List[str] = []
    provider_used: Optional[str] = None


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
    model_config = _CAMEL_CONFIG

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
    model_config = _CAMEL_CONFIG

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
    model_config = _CAMEL_CONFIG

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
