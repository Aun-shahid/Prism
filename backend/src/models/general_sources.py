from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class GeneralScraperSource(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    url: str
    source_type: str  # "rss", "preset_linkedin", "preset_arbeitnow"
    locations: List[str] = []
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class GeneralScraperSourceCreateRequest(BaseModel):
    name: str
    url: str
    source_type: str
    locations: List[str] = []


class GeneralScraperSourceUpdateRequest(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    locations: Optional[List[str]] = None
    is_active: Optional[bool] = None


class GeneralScraperSourceResponse(BaseModel):
    id: str
    name: str
    url: str
    source_type: str
    locations: List[str] = []
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
