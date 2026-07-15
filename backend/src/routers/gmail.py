from urllib.parse import quote
from typing import List
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import RedirectResponse
from ..models.gmail import EmailSendRequest, GmailStatusResponse, EmailLogResponse
from ..models.users import User
from ..services.gmail_service import GmailService
from ..services.logging_service import get_logger
from ..auth.dependencies import get_current_active_user
from ..config import settings

logger = get_logger("gmail_router")

router = APIRouter(prefix="/gmail", tags=["gmail"])

_GMAIL_PAGE_URL = f"{settings.FRONTEND_URL.rstrip('/')}/dashboard/gmail"


@router.get("/connect")
async def start_gmail_oauth(
    current_user: User = Depends(get_current_active_user),
):
    """Start the Gmail OAuth flow. Returns the Google consent URL to redirect the user to."""
    url = await GmailService.get_oauth_url(current_user.id)
    return {"authorization_url": url}


@router.get("/callback")
async def gmail_oauth_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
):
    """
    OAuth callback handler. Google redirects the browser here with the
    authorization code (or an error, e.g. the user declined consent). Always
    redirect back into the app rather than showing a bare JSON page.
    """
    if error or not code or not state:
        return RedirectResponse(f"{_GMAIL_PAGE_URL}?gmail=error&message={quote(error or 'Gmail connection was cancelled.')}")

    try:
        await GmailService.handle_callback(user_id=state, auth_code=code)
        return RedirectResponse(f"{_GMAIL_PAGE_URL}?gmail=connected")
    except Exception as e:
        logger.error(f"Gmail OAuth callback failed for user {state}: {e}")
        message = getattr(e, "detail", None) or "Failed to connect Gmail. Please try again."
        return RedirectResponse(f"{_GMAIL_PAGE_URL}?gmail=error&message={quote(str(message))}")


@router.get("/status", response_model=GmailStatusResponse)
async def get_gmail_status(
    current_user: User = Depends(get_current_active_user),
):
    """Check if Gmail is connected for the current user."""
    gmail_status = await GmailService.get_connection_status(current_user.id)
    return gmail_status


@router.post("/send", response_model=EmailLogResponse, status_code=status.HTTP_201_CREATED)
async def send_email(
    data: EmailSendRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Send an email via the user's connected Gmail account."""
    log = await GmailService.send_email(
        user_id=current_user.id,
        to=data.to,
        subject=data.subject,
        body=data.body,
        application_id=data.application_id,
        cc=data.cc,
        bcc=data.bcc,
        attachments=data.attachments,
    )
    return log


@router.get("/sent", response_model=List[EmailLogResponse])
async def list_sent_emails(
    current_user: User = Depends(get_current_active_user),
):
    """List email send history."""
    logs = await GmailService.list_sent_emails(current_user.id)
    return logs


@router.post("/disconnect")
async def disconnect_gmail(
    current_user: User = Depends(get_current_active_user),
):
    """Disconnect Gmail account."""
    await GmailService.disconnect(current_user.id)
    return {"detail": "Gmail disconnected successfully"}
