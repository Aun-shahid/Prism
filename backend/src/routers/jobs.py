from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from ..models.scraper import PaginatedScrapedJobsResponse, ScrapedJobResponse
from ..models.applications import ApplicationResponse
from ..models.jobs import ExternalSearchRequest, JobImportRequest
from ..models.users import User
from ..services.job_service import JobService
from ..auth.dependencies import get_current_active_user

router = APIRouter(prefix="/jobs", tags=["jobs"])

@router.get("", response_model=PaginatedScrapedJobsResponse)
async def list_jobs(
    search: Optional[str] = Query(None),
    is_new: Optional[bool] = Query(None),
    target_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
):
    """List scraped/discovered jobs with filtering and pagination."""
    return await JobService.list_jobs(
        user_id=current_user.id,
        search=search,
        is_new=is_new,
        target_id=target_id,
        page=page,
        limit=limit,
    )

@router.patch("/{job_id}/read", response_model=ScrapedJobResponse)
async def mark_job_read(
    job_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Mark a job listing as read."""
    from ..services.scraper_service import ScraperService
    job = await ScraperService.mark_job_read(current_user.id, job_id)
    return job

@router.post("/{job_id}/import", response_model=ApplicationResponse)
async def import_job(
    job_id: str,
    data: JobImportRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Import a job listing directly to Applications pipeline."""
    app = await JobService.import_to_applications(
        user_id=current_user.id,
        job_id=job_id,
        status_val=data.status or "wishlist",
        notes=data.notes
    )
    return app

@router.post("/search-external", response_model=List[ScrapedJobResponse])
async def search_external(
    data: ExternalSearchRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Query external job boards in real-time, matching search keyword and location."""
    jobs = await JobService.search_external_jobs(
        user_id=current_user.id,
        title=data.title,
        location=data.location
    )
    return jobs


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Delete a scraped job listing."""
    await JobService.delete_job(current_user.id, job_id)

