from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class Education(BaseModel):
    institution: str
    degree: str
    field_of_study: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None  # "Present" for current
    gpa: Optional[str] = None
    description: Optional[str] = None


class WorkExperience(BaseModel):
    company: str
    title: str
    location: Optional[str] = None
    start_date: str
    end_date: Optional[str] = None  # None = currently employed
    description: Optional[str] = None
    highlights: List[str] = []


class Project(BaseModel):
    name: str
    description: Optional[str] = None
    technologies: List[str] = []
    url: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class Certification(BaseModel):
    name: str
    issuer: str
    date: Optional[str] = None
    url: Optional[str] = None


class UserProfile(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    headline: Optional[str] = None
    summary: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    skills: List[str] = []
    job_titles: List[str] = []
    education: List[Education] = []
    work_experience: List[WorkExperience] = []
    projects: List[Project] = []
    certifications: List[Certification] = []
    languages: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class ProfileUpdateRequest(BaseModel):
    headline: Optional[str] = None
    summary: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    skills: Optional[List[str]] = None
    job_titles: Optional[List[str]] = None
    education: Optional[List[Education]] = None
    work_experience: Optional[List[WorkExperience]] = None
    projects: Optional[List[Project]] = None
    certifications: Optional[List[Certification]] = None
    languages: Optional[List[str]] = None


class ProfileResponse(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    headline: Optional[str] = None
    summary: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    skills: List[str] = []
    job_titles: List[str] = []
    education: List[Education] = []
    work_experience: List[WorkExperience] = []
    projects: List[Project] = []
    certifications: List[Certification] = []
    languages: List[str] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
