from typing import List
from fastapi import APIRouter, Depends, Query, status
from ..models.gmail import EmailSendRequest, GmailStatusResponse, EmailLogResponse
from ..models.users import User
from ..services.gmail_service import GmailService
from ..auth.dependencies import get_current_active_user

router = APIRouter(prefix="/gmail", tags=["gmail"])


@router.get("/connect")
async def start_gmail_oauth(
    current_user: User = Depends(get_current_active_user),
):
    """Start the Gmail OAuth flow. Returns the Google consent URL to redirect the user to."""
    url = await GmailService.get_oauth_url(current_user.id)
    return {"authorization_url": url}


@router.get("/callback")
async def gmail_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
):
    """
    OAuth callback handler. Google redirects here with the authorization code.
    The 'state' parameter contains the user_id.
    """
    connection = await GmailService.handle_callback(user_id=state, auth_code=code)
    return {"detail": "Gmail connected successfully", "email": connection.google_email}


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
