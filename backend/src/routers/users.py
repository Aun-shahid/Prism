from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from ..models.users import User, UserResponse, UserUpdateRequest, UserType
from ..services.user_service import UserService
from ..auth.dependencies import get_current_active_user, require_super_admin

from ..database import (
    get_users_collection,
    get_scraper_targets_collection,
    get_scraped_jobs_collection,
    get_general_sources_collection,
)

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/admin/stats")
async def get_admin_stats(admin_user: User = Depends(require_super_admin)):
    """Retrieve overview statistics of the system (Admin only)."""
    users_col = get_users_collection()
    targets_col = get_scraper_targets_collection()
    jobs_col = get_scraped_jobs_collection()
    sources_col = get_general_sources_collection()
    
    total_users = await users_col.count_documents({})
    total_targets = await targets_col.count_documents({})
    total_jobs = await jobs_col.count_documents({})
    total_sources = await sources_col.count_documents({})
    
    return {
        "total_users": total_users,
        "total_targets": total_targets,
        "total_jobs": total_jobs,
        "total_sources": total_sources
    }

@router.get("/me", response_model=UserResponse)
async def get_my_details(current_user: User = Depends(get_current_active_user)):
    """Retrieve details for the currently authenticated user (self)."""
    return current_user

@router.get("", response_model=List[UserResponse])
async def list_all_users(admin_user: User = Depends(require_super_admin)):
    """List all users in the system (Admin only)."""
    users = await UserService.list_users()
    return users

@router.get("/{user_id}", response_model=UserResponse)
async def get_user_details(user_id: str, current_user: User = Depends(get_current_active_user)):
    """Retrieve details for a specific user. Users can access their own details, admins can access any user."""
    # Enforce permission check: self or admin
    if str(current_user.id) != user_id and current_user.role != UserType.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access these user details"
        )
    
    user = await UserService.get_user_by_id(user_id)
    return user

@router.patch("/{user_id}", response_model=UserResponse)
async def update_user_details(
    user_id: str,
    update_data: UserUpdateRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Update a user's details.
    - Regular users can update their own name, username, email, and password.
    - Admins can update roles and active status of any user.
    """
    updated_user = await UserService.update_user(user_id, update_data, current_user)
    return updated_user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_account(user_id: str, admin_user: User = Depends(require_super_admin)):
    """Delete a user account from the system (Admin only)."""
    await UserService.delete_user(user_id)
    return None
