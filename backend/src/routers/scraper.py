from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from ..models.scraper import (
    ScraperTargetCreateRequest,
    ScraperTargetUpdateRequest,
    ScraperTargetResponse,
    ScrapedJobResponse,
)
from ..models.general_sources import (
    GeneralScraperSourceCreateRequest,
    GeneralScraperSourceUpdateRequest,
    GeneralScraperSourceResponse,
)
from ..models.users import User
from ..services.scraper_service import ScraperService
from ..auth.dependencies import get_current_active_user, require_super_admin

router = APIRouter(prefix="/scraper", tags=["scraper"])


# --- Targets ---

@router.post("/targets", response_model=ScraperTargetResponse, status_code=status.HTTP_201_CREATED)
async def add_scraper_target(
    data: ScraperTargetCreateRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Add a new company career page to scrape."""
    target = await ScraperService.add_target(current_user.id, data)
    return target


@router.get("/targets", response_model=List[ScraperTargetResponse])
async def list_scraper_targets(
    current_user: User = Depends(get_current_active_user),
):
    """List all scraper targets."""
    targets = await ScraperService.list_targets(current_user.id)
    return targets


@router.patch("/targets/{target_id}", response_model=ScraperTargetResponse)
async def update_scraper_target(
    target_id: str,
    data: ScraperTargetUpdateRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Update a scraper target."""
    target = await ScraperService.update_target(current_user.id, target_id, data)
    return target


@router.delete("/targets/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_scraper_target(
    target_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Remove a scraper target and its discovered jobs."""
    await ScraperService.remove_target(current_user.id, target_id)
    return None


@router.post("/targets/{target_id}/scrape", response_model=List[ScrapedJobResponse])
async def trigger_scrape(
    target_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Manually trigger a scrape for a specific target."""
    jobs = await ScraperService.scrape_target(current_user.id, target_id)
    return jobs


# --- Discovered Jobs ---

@router.get("/jobs", response_model=List[ScrapedJobResponse])
async def get_discovered_jobs(
    target_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
):
    """Get all discovered jobs, optionally filtered by target."""
    jobs = await ScraperService.get_discovered_jobs(current_user.id, target_id)
    return jobs


@router.patch("/jobs/{job_id}/read", response_model=ScrapedJobResponse)
async def mark_job_read(
    job_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Mark a discovered job as read."""
    job = await ScraperService.mark_job_read(current_user.id, job_id)
    return job


# --- General Sources ---

@router.get("/general-sources", response_model=List[GeneralScraperSourceResponse])
async def list_general_sources(
    admin_user: User = Depends(require_super_admin),
):
    """List all general scraper sources (Admin only)."""
    sources = await ScraperService.list_general_sources()
    return sources


@router.post("/general-sources", response_model=GeneralScraperSourceResponse, status_code=status.HTTP_201_CREATED)
async def add_general_source(
    data: GeneralScraperSourceCreateRequest,
    admin_user: User = Depends(require_super_admin),
):
    """Add a new general scraper source (Admin only)."""
    source = await ScraperService.add_general_source(data)
    return source


@router.patch("/general-sources/{source_id}", response_model=GeneralScraperSourceResponse)
async def update_general_source(
    source_id: str,
    data: GeneralScraperSourceUpdateRequest,
    admin_user: User = Depends(require_super_admin),
):
    """Update a general scraper source (Admin only)."""
    source = await ScraperService.update_general_source(source_id, data)
    return source


@router.delete("/general-sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_general_source(
    source_id: str,
    admin_user: User = Depends(require_super_admin),
):
    """Remove a general scraper source (Admin only)."""
    await ScraperService.remove_general_source(source_id)
    return None


@router.post("/general-sources/{source_id}/scrape", response_model=List[ScrapedJobResponse])
async def trigger_general_scrape(
    source_id: str,
    admin_user: User = Depends(require_super_admin),
):
    """Manually trigger a scrape for a specific general source for the current admin user (Admin only)."""
    from ..services.general_scraper_service import GeneralScraperService
    jobs = await GeneralScraperService.scrape_single_source_for_user(admin_user.id, source_id)
    return jobs
