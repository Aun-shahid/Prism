from typing import List
from fastapi import APIRouter, Depends, status
from ..models.api_keys import APIKeyCreateRequest, APIKeyResponse
from ..models.users import User
from ..services.api_key_service import APIKeyService
from ..auth.dependencies import get_current_active_user

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


@router.post("", response_model=APIKeyResponse, status_code=status.HTTP_201_CREATED)
async def store_api_key(
    data: APIKeyCreateRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Store or update an API key (encrypted at rest). One key per provider."""
    key = await APIKeyService.store_key(current_user.id, data)
    return key


@router.get("", response_model=List[APIKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_active_user),
):
    """List all stored API keys for the current user (keys are never returned)."""
    keys = await APIKeyService.get_user_keys(current_user.id)
    return keys


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    key_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Delete a stored API key."""
    await APIKeyService.delete_key(current_user.id, key_id)
    return None


@router.patch("/{key_id}/toggle", response_model=APIKeyResponse)
async def toggle_api_key(
    key_id: str,
    is_active: bool = True,
    current_user: User = Depends(get_current_active_user),
):
    """Enable or disable an API key."""
    key = await APIKeyService.toggle_key(current_user.id, key_id, is_active)
    return key
