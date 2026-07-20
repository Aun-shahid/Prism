from typing import List
from fastapi import APIRouter, Depends, Query

from ..models.users import User
from ..services.title_taxonomy import search_titles
from ..auth.dependencies import get_current_active_user

router = APIRouter(prefix="/titles", tags=["titles"])


@router.get("/search", response_model=List[str])
async def search_job_titles(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=25),
    current_user: User = Depends(get_current_active_user),
):
    """Autocomplete suggestions for job-title fields, from an offline O*NET-derived dataset."""
    return search_titles(q, limit)
