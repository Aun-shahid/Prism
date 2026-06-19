from typing import List
from fastapi import APIRouter, Depends, status
from ..models.resume import ResumeGenerateRequest, GeneratedDocResponse, ResumeVersionCreate, ResumeVersionUpdate, ResumeVersionResponse
from ..models.users import User
from ..services.resume_service import ResumeService, VersionService
from ..auth.dependencies import get_current_active_user

router = APIRouter(prefix="/resume", tags=["resume"])


@router.post("/generate", response_model=GeneratedDocResponse, status_code=status.HTTP_201_CREATED)
async def generate_resume(
    data: ResumeGenerateRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Generate a tailored resume and/or cover letter from your profile + a job description."""
    doc = await ResumeService.generate(current_user.id, data)
    return doc


@router.get("/history", response_model=List[GeneratedDocResponse])
async def list_generated_docs(
    current_user: User = Depends(get_current_active_user),
):
    """List all previously generated resumes/cover letters."""
    docs = await ResumeService.list_generated(current_user.id)
    return docs


@router.get("/history/{doc_id}", response_model=GeneratedDocResponse)
async def get_generated_doc(
    doc_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Get a specific generated document."""
    doc = await ResumeService.get_generated(current_user.id, doc_id)
    return doc


@router.delete("/history/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_generated_doc(
    doc_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Delete a generated document."""
    await ResumeService.delete_generated(current_user.id, doc_id)
    return None


# ─── Resume Version Routes ─────────────────────────────────────────────────────

@router.get("/versions", response_model=List[ResumeVersionResponse])
async def list_resume_versions(
    current_user: User = Depends(get_current_active_user),
):
    """List all saved resume versions for the current user."""
    return await VersionService.list_versions(current_user.id)


@router.post("/versions", response_model=ResumeVersionResponse, status_code=status.HTTP_201_CREATED)
async def create_resume_version(
    data: ResumeVersionCreate,
    current_user: User = Depends(get_current_active_user),
):
    """Create a new resume version."""
    return await VersionService.create_version(current_user.id, data)


@router.post("/versions/{version_id}/duplicate", response_model=ResumeVersionResponse, status_code=status.HTTP_201_CREATED)
async def duplicate_resume_version(
    version_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Duplicate an existing resume version."""
    return await VersionService.duplicate_version(current_user.id, version_id)


@router.patch("/versions/{version_id}", response_model=ResumeVersionResponse)
async def update_resume_version(
    version_id: str,
    data: ResumeVersionUpdate,
    current_user: User = Depends(get_current_active_user),
):
    """Partially update a resume version."""
    return await VersionService.update_version(current_user.id, version_id, data)


@router.delete("/versions/{version_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume_version(
    version_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Delete a resume version."""
    await VersionService.delete_version(current_user.id, version_id)
    return None
