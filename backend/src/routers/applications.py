from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from ..models.applications import (
    ApplicationCreateRequest,
    ApplicationUpdateRequest,
    ApplicationResponse,
    ApplicationStats,
    ApplicationStatus,
)
from ..models.users import User
from ..services.application_service import ApplicationService
from ..auth.dependencies import get_current_active_user

router = APIRouter(prefix="/applications", tags=["applications"])


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    data: ApplicationCreateRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Create a new job application."""
    app = await ApplicationService.create_application(current_user.id, data)
    return app


@router.get("", response_model=List[ApplicationResponse])
async def list_applications(
    status_filter: Optional[ApplicationStatus] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
):
    """List all applications with optional status filter and search."""
    apps = await ApplicationService.list_applications(
        current_user.id, status_filter=status_filter, search=search
    )
    return apps


@router.get("/stats", response_model=ApplicationStats)
async def get_application_stats(
    current_user: User = Depends(get_current_active_user),
):
    """Get application pipeline statistics."""
    stats = await ApplicationService.get_statistics(current_user.id)
    return stats


@router.get("/{app_id}", response_model=ApplicationResponse)
async def get_application(
    app_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Get a single application by ID."""
    app = await ApplicationService.get_application(current_user.id, app_id)
    return app


@router.patch("/{app_id}", response_model=ApplicationResponse)
async def update_application(
    app_id: str,
    data: ApplicationUpdateRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Update an application."""
    app = await ApplicationService.update_application(current_user.id, app_id, data)
    return app


@router.delete("/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(
    app_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Delete an application."""
    await ApplicationService.delete_application(current_user.id, app_id)
    return None
