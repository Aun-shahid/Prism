from typing import List
from fastapi import APIRouter, Depends, status
from ..models.resume import ResumeGenerateRequest, GeneratedDocResponse
from ..models.users import User
from ..services.resume_service import ResumeService
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
