from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class ScraperTarget(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    company_name: str
    career_url: Optional[str] = None
    keywords: List[str] = []
    is_active: bool = True
    last_scraped: Optional[datetime] = None
    # AI company research fields
    website: Optional[str] = None
    jobs_url: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[str] = None
    headquarters: Optional[str] = None
    company_size: Optional[str] = None
    talking_points: List[str] = []
    research_status: str = "none"  # none | pending | completed | failed
    researched_at: Optional[datetime] = None
    research_sources: List[str] = []
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
    # --- de-duplication + freshness (optional; older docs won't have them) ---
    dedup_key: Optional[str] = None          # normalized URL used to detect duplicates
    first_seen: Optional[datetime] = None    # first time this posting was discovered
    last_seen: Optional[datetime] = None     # most recent scrape that still saw it
    company: Optional[str] = None            # resolved company name, when known
    location: Optional[str] = None           # posting location, when known
    source: Optional[str] = None             # e.g. "greenhouse", "lever", "html", "rss"
    # --- years-of-experience requirement, extracted from the description via
    # a small regex dictionary (scraper_utils.extract_years_experience) ---
    years_experience_min: Optional[int] = None
    years_experience_max: Optional[int] = None
    years_experience_display: Optional[str] = None  # e.g. "3-5 years", "5+ years"

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class ScraperTargetCreateRequest(BaseModel):
    company_name: str
    career_url: Optional[str] = None
    keywords: List[str] = []


class WatchCompanyRequest(BaseModel):
    """Add a company to the watchlist — AI research fills in whatever isn't given."""
    company_name: str
    keywords: List[str] = []
    preferred_provider: Optional[str] = None
    # Optional: if the user already knows the careers/jobs page, providing it
    # skips the AI having to search for and guess at the right URL.
    career_url: Optional[str] = None


class ScraperTargetUpdateRequest(BaseModel):
    company_name: Optional[str] = None
    career_url: Optional[str] = None
    keywords: Optional[List[str]] = None
    is_active: Optional[bool] = None


class ScraperTargetResponse(BaseModel):
    id: str
    user_id: str
    company_name: str
    career_url: Optional[str] = None
    keywords: List[str] = []
    is_active: bool
    last_scraped: Optional[datetime] = None
    website: Optional[str] = None
    jobs_url: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[str] = None
    headquarters: Optional[str] = None
    company_size: Optional[str] = None
    talking_points: List[str] = []
    research_status: str = "none"
    researched_at: Optional[datetime] = None
    research_sources: List[str] = []
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
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    company: Optional[str] = None
    location: Optional[str] = None
    source: Optional[str] = None
    years_experience_min: Optional[int] = None
    years_experience_max: Optional[int] = None
    years_experience_display: Optional[str] = None

    class Config:
        populate_by_name = True


class PaginatedScrapedJobsResponse(BaseModel):
    jobs: List[ScrapedJobResponse]
    total: int
    page: int
    limit: int
    pages: int
