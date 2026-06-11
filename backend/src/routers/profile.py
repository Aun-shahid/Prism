from typing import List
from fastapi import APIRouter, Depends, status, UploadFile, File
from ..models.profile import (
    ProfileUpdateRequest,
    ProfileResponse,
    Education,
    WorkExperience,
    Project,
    Certification,
)
from ..models.users import User
from ..services.profile_service import ProfileService
from ..auth.dependencies import get_current_active_user

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ProfileResponse)
async def get_profile(current_user: User = Depends(get_current_active_user)):
    """Get the current user's profile (creates empty profile if none exists)."""
    profile = await ProfileService.get_or_create_profile(current_user.id)
    return profile


@router.put("", response_model=ProfileResponse)
async def update_profile(
    data: ProfileUpdateRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Update the current user's full profile."""
    profile = await ProfileService.update_profile(current_user.id, data)
    return profile


@router.post("/upload-cv", response_model=ProfileResponse)
async def upload_cv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
):
    """Upload resume file and auto-populate user profile using AI."""
    content = await file.read()
    profile = await ProfileService.parse_cv_and_update_profile(
        user_id=current_user.id,
        file_content=content,
        filename=file.filename
    )
    return profile


@router.patch("/skills", response_model=ProfileResponse)
async def update_skills(
    skills: List[str],
    current_user: User = Depends(get_current_active_user),
):
    """Replace the user's skills list."""
    profile = await ProfileService.update_skills(current_user.id, skills)
    return profile


@router.patch("/job-titles", response_model=ProfileResponse)
async def update_job_titles(
    job_titles: List[str],
    current_user: User = Depends(get_current_active_user),
):
    """Replace the user's target job titles list."""
    profile = await ProfileService.update_job_titles(current_user.id, job_titles)
    return profile


# --- Education ---

@router.post("/education", response_model=ProfileResponse, status_code=status.HTTP_201_CREATED)
async def add_education(
    education: Education,
    current_user: User = Depends(get_current_active_user),
):
    """Add an education entry."""
    profile = await ProfileService.add_education(current_user.id, education)
    return profile


@router.delete("/education/{index}", response_model=ProfileResponse)
async def remove_education(
    index: int,
    current_user: User = Depends(get_current_active_user),
):
    """Remove an education entry by index."""
    profile = await ProfileService.remove_education(current_user.id, index)
    return profile


# --- Work Experience ---

@router.post("/experience", response_model=ProfileResponse, status_code=status.HTTP_201_CREATED)
async def add_experience(
    experience: WorkExperience,
    current_user: User = Depends(get_current_active_user),
):
    """Add a work experience entry."""
    profile = await ProfileService.add_work_experience(current_user.id, experience)
    return profile


@router.delete("/experience/{index}", response_model=ProfileResponse)
async def remove_experience(
    index: int,
    current_user: User = Depends(get_current_active_user),
):
    """Remove a work experience entry by index."""
    profile = await ProfileService.remove_work_experience(current_user.id, index)
    return profile


# --- Projects ---

@router.post("/projects", response_model=ProfileResponse, status_code=status.HTTP_201_CREATED)
async def add_project(
    project: Project,
    current_user: User = Depends(get_current_active_user),
):
    """Add a project entry."""
    profile = await ProfileService.add_project(current_user.id, project)
    return profile


@router.delete("/projects/{index}", response_model=ProfileResponse)
async def remove_project(
    index: int,
    current_user: User = Depends(get_current_active_user),
):
    """Remove a project entry by index."""
    profile = await ProfileService.remove_project(current_user.id, index)
    return profile


# --- Certifications ---

@router.post("/certifications", response_model=ProfileResponse, status_code=status.HTTP_201_CREATED)
async def add_certification(
    cert: Certification,
    current_user: User = Depends(get_current_active_user),
):
    """Add a certification entry."""
    profile = await ProfileService.add_certification(current_user.id, cert)
    return profile


@router.delete("/certifications/{index}", response_model=ProfileResponse)
async def remove_certification(
    index: int,
    current_user: User = Depends(get_current_active_user),
):
    """Remove a certification entry by index."""
    profile = await ProfileService.remove_certification(current_user.id, index)
    return profile
