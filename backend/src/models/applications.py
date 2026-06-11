from enum import Enum
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class ApplicationStatus(str, Enum):
    WISHLIST = "wishlist"
    APPLIED = "applied"
    INTERVIEWING = "interviewing"
    OFFERED = "offered"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class JobApplication(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    company: str
    position: str
    job_url: Optional[str] = None
    job_description: Optional[str] = None
    status: ApplicationStatus = ApplicationStatus.WISHLIST
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    location: Optional[str] = None
    remote: Optional[bool] = None
    applied_date: Optional[datetime] = None
    notes: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    resume_id: Optional[str] = None
    cover_letter_id: Optional[str] = None
    tags: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class ApplicationCreateRequest(BaseModel):
    company: str
    position: str
    job_url: Optional[str] = None
    job_description: Optional[str] = None
    status: ApplicationStatus = ApplicationStatus.WISHLIST
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    location: Optional[str] = None
    remote: Optional[bool] = None
    applied_date: Optional[datetime] = None
    notes: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    tags: List[str] = []


class ApplicationUpdateRequest(BaseModel):
    company: Optional[str] = None
    position: Optional[str] = None
    job_url: Optional[str] = None
    job_description: Optional[str] = None
    status: Optional[ApplicationStatus] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    location: Optional[str] = None
    remote: Optional[bool] = None
    applied_date: Optional[datetime] = None
    notes: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    resume_id: Optional[str] = None
    cover_letter_id: Optional[str] = None
    tags: Optional[List[str]] = None


class ApplicationResponse(BaseModel):
    id: str
    user_id: str
    company: str
    position: str
    job_url: Optional[str] = None
    job_description: Optional[str] = None
    status: ApplicationStatus
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    location: Optional[str] = None
    remote: Optional[bool] = None
    applied_date: Optional[datetime] = None
    notes: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    resume_id: Optional[str] = None
    cover_letter_id: Optional[str] = None
    tags: List[str] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class ApplicationStats(BaseModel):
    total: int = 0
    wishlist: int = 0
    applied: int = 0
    interviewing: int = 0
    offered: int = 0
    rejected: int = 0
    withdrawn: int = 0
    response_rate: float = 0.0  # (interviewing + offered) / applied
    offer_rate: float = 0.0     # offered / total
