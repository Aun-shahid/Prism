from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from ..models.users import User, UserResponse, UserUpdateRequest, UserType
from ..services.user_service import UserService
from ..auth.dependencies import get_current_active_user, require_super_admin

router = APIRouter(prefix="/users", tags=["users"])

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
