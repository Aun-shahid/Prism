from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class ScraperTarget(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    company_name: str
    career_url: str
    keywords: List[str] = []
    is_active: bool = True
    last_scraped: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class ScrapedJob(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    target_id: str
    user_id: str
    title: str
    url: Optional[str] = None
    description_snippet: Optional[str] = None
    matched_keywords: List[str] = []
    is_new: bool = True
    discovered_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class ScraperTargetCreateRequest(BaseModel):
    company_name: str
    career_url: str
    keywords: List[str] = []


class ScraperTargetUpdateRequest(BaseModel):
    company_name: Optional[str] = None
    career_url: Optional[str] = None
    keywords: Optional[List[str]] = None
    is_active: Optional[bool] = None


class ScraperTargetResponse(BaseModel):
    id: str
    user_id: str
    company_name: str
    career_url: str
    keywords: List[str] = []
    is_active: bool
    last_scraped: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class ScrapedJobResponse(BaseModel):
    id: str
    target_id: str
    user_id: str
    title: str
    url: Optional[str] = None
    description_snippet: Optional[str] = None
    matched_keywords: List[str] = []
    is_new: bool
    discovered_at: datetime

    class Config:
        populate_by_name = True
