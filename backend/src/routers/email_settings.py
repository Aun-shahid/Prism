from fastapi import APIRouter, Depends

from ..models.email_settings import EmailSettingsUpdateRequest, EmailSettingsResponse
from ..models.users import User
from ..services.email_settings_service import EmailSettingsService
from ..auth.dependencies import get_current_active_user

router = APIRouter(prefix="/email-settings", tags=["email-settings"])


@router.get("", response_model=EmailSettingsResponse)
async def get_email_settings(current_user: User = Depends(get_current_active_user)):
    """Get the current user's email-outreach settings (creates defaults if none)."""
    settings = await EmailSettingsService.get_or_create(current_user.id)
    return EmailSettingsResponse(**settings.model_dump())


@router.put("", response_model=EmailSettingsResponse)
async def update_email_settings(
    data: EmailSettingsUpdateRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Update the current user's email-outreach settings."""
    settings = await EmailSettingsService.update(current_user.id, data)
    return EmailSettingsResponse(**settings.model_dump())
