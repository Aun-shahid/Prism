import base64
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional

from fastapi import HTTPException, status

from ..config import settings
from ..database import get_gmail_connections_collection, get_email_logs_collection
from ..models.gmail import GmailConnection, EmailLog, GmailStatusResponse
from .encryption_service import encrypt_value, decrypt_value
from .logging_service import get_logger

logger = get_logger("gmail_service")

SCOPES = ["https://www.googleapis.com/auth/gmail.send"]


class GmailService:
    @staticmethod
    def _check_google_credentials():
        """Verify Google OAuth credentials are configured."""
        if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Gmail OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
            )

    @staticmethod
    async def get_oauth_url(user_id: str) -> str:
        """Generate a Google OAuth consent URL for Gmail access."""
        GmailService._check_google_credentials()

        from google_auth_oauthlib.flow import Flow

        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
                }
            },
            scopes=SCOPES,
        )
        flow.redirect_uri = settings.GOOGLE_REDIRECT_URI

        authorization_url, state = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
            state=user_id,  # Pass user_id as state for callback
        )
        logger.info(f"Generated OAuth URL for user {user_id}")
        return authorization_url

    @staticmethod
    async def handle_callback(user_id: str, auth_code: str) -> GmailConnection:
        """Exchange authorization code for tokens and store encrypted."""
        GmailService._check_google_credentials()

        from google_auth_oauthlib.flow import Flow
        from google.oauth2.credentials import Credentials

        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
                }
            },
            scopes=SCOPES,
        )
        flow.redirect_uri = settings.GOOGLE_REDIRECT_URI

        flow.fetch_token(code=auth_code)
        credentials = flow.credentials

        # Get user's Google email
        from googleapiclient.discovery import build

        service = build("gmail", "v1", credentials=credentials)
        profile = service.users().getProfile(userId="me").execute()
        google_email = profile.get("emailAddress", "")

        # Store encrypted tokens
        collection = get_gmail_connections_collection()
        now = datetime.utcnow()

        encrypted_access = encrypt_value(credentials.token)
        encrypted_refresh = encrypt_value(credentials.refresh_token or "")

        connection_doc = {
            "user_id": user_id,
            "google_email": google_email,
            "encrypted_access_token": encrypted_access,
            "encrypted_refresh_token": encrypted_refresh,
            "token_expiry": credentials.expiry,
            "is_connected": True,
            "connected_at": now,
        }

        # Upsert — replace existing connection for this user
        await collection.update_one(
            {"user_id": user_id},
            {"$set": connection_doc},
            upsert=True,
        )

        doc = await collection.find_one({"user_id": user_id})
        doc["_id"] = str(doc["_id"])
        logger.info(f"Gmail connected for user {user_id} ({google_email})")
        return GmailConnection(**doc)

    @staticmethod
    async def _get_credentials(user_id: str):
        """Retrieve and refresh Gmail credentials for a user."""
        collection = get_gmail_connections_collection()
        doc = await collection.find_one({"user_id": user_id, "is_connected": True})
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Gmail is not connected. Please connect your Gmail account first.",
            )

        from google.oauth2.credentials import Credentials

        access_token = decrypt_value(doc["encrypted_access_token"])
        refresh_token = decrypt_value(doc["encrypted_refresh_token"])

        credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=SCOPES,
        )

        # Refresh if expired
        if credentials.expired and credentials.refresh_token:
            from google.auth.transport.requests import Request

            credentials.refresh(Request())

            # Update stored tokens
            new_encrypted_access = encrypt_value(credentials.token)
            await collection.update_one(
                {"user_id": user_id},
                {"$set": {
                    "encrypted_access_token": new_encrypted_access,
                    "token_expiry": credentials.expiry,
                }}
            )

        return credentials

    @staticmethod
    async def send_email(
        user_id: str, to: str, subject: str, body: str, application_id: Optional[str] = None
    ) -> EmailLog:
        """Send an email via the user's connected Gmail account."""
        credentials = await GmailService._get_credentials(user_id)
        logs_collection = get_email_logs_collection()
        now = datetime.utcnow()

        try:
            from googleapiclient.discovery import build

            service = build("gmail", "v1", credentials=credentials)

            message = MIMEMultipart("alternative")
            message["to"] = to
            message["subject"] = subject

            # Add HTML body
            html_part = MIMEText(body, "html")
            message.attach(html_part)

            raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
            send_result = service.users().messages().send(
                userId="me", body={"raw": raw}
            ).execute()

            log_doc = {
                "user_id": user_id,
                "to": to,
                "subject": subject,
                "sent_at": now,
                "application_id": application_id,
                "status": "sent",
                "error_message": None,
            }
            result = await logs_collection.insert_one(log_doc)
            log_doc["_id"] = str(result.inserted_id)
            logger.info(f"Email sent to {to} for user {user_id}")
            return EmailLog(**log_doc)

        except Exception as e:
            log_doc = {
                "user_id": user_id,
                "to": to,
                "subject": subject,
                "sent_at": now,
                "application_id": application_id,
                "status": "failed",
                "error_message": str(e),
            }
            result = await logs_collection.insert_one(log_doc)
            log_doc["_id"] = str(result.inserted_id)
            logger.error(f"Failed to send email to {to}: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to send email: {str(e)}",
            )

    @staticmethod
    async def get_connection_status(user_id: str) -> GmailStatusResponse:
        """Check if Gmail is connected for the user."""
        collection = get_gmail_connections_collection()
        doc = await collection.find_one({"user_id": user_id, "is_connected": True})
        if not doc:
            return GmailStatusResponse(is_connected=False)

        return GmailStatusResponse(
            is_connected=True,
            google_email=doc.get("google_email"),
            connected_at=doc.get("connected_at"),
        )

    @staticmethod
    async def disconnect(user_id: str) -> bool:
        """Disconnect Gmail by removing stored credentials."""
        collection = get_gmail_connections_collection()
        result = await collection.update_one(
            {"user_id": user_id},
            {"$set": {"is_connected": False}}
        )
        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No Gmail connection found",
            )
        logger.info(f"Gmail disconnected for user {user_id}")
        return True

    @staticmethod
    async def list_sent_emails(user_id: str) -> List[EmailLog]:
        """List email send history."""
        collection = get_email_logs_collection()
        cursor = collection.find({"user_id": user_id}).sort("sent_at", -1)
        logs = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            logs.append(EmailLog(**doc))
        return logs
