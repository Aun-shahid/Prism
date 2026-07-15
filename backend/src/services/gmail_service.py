import base64
import re
import html as html_lib
from datetime import datetime
from email import encoders
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional

from fastapi import HTTPException, status

from ..config import settings
from ..database import get_gmail_connections_collection, get_email_logs_collection
from ..models.gmail import GmailConnection, EmailLog, GmailStatusResponse, EmailAttachment
from .encryption_service import encrypt_value, decrypt_value
from .logging_service import get_logger

logger = get_logger("gmail_service")

# gmail.send: send mail. gmail.readonly: read inbox/threads (inbound replies).
# gmail.compose: create drafts. Inbound features need readonly+compose, so adding
# a company means existing users must reconnect once to grant the wider scopes.
SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.compose",
]

# Scope required for the inbound (read HR replies) features.
INBOUND_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"


def _html_to_text(body: str) -> str:
    """Best-effort plain-text alternative from an HTML body (deliverability)."""
    if not body:
        return ""
    text = re.sub(r"(?i)<br\s*/?>", "\n", body)
    text = re.sub(r"(?i)</p>", "\n\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    return html_lib.unescape(text).strip()


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
            "granted_scopes": " ".join(credentials.scopes or []),
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
    def _build_mime(
        to: str,
        subject: str,
        body: str,
        cc: Optional[str] = None,
        bcc: Optional[str] = None,
        attachments: Optional[List[EmailAttachment]] = None,
        in_reply_to: Optional[str] = None,
        references: Optional[str] = None,
    ) -> MIMEMultipart:
        """Build a multipart message with a plain-text + HTML body and optional files."""
        alternative = MIMEMultipart("alternative")
        alternative.attach(MIMEText(_html_to_text(body), "plain", "utf-8"))
        alternative.attach(MIMEText(body, "html", "utf-8"))

        if attachments:
            message = MIMEMultipart("mixed")
            message.attach(alternative)
            for att in attachments:
                maintype, _, subtype = (att.mime_type or "application/octet-stream").partition("/")
                part = MIMEBase(maintype or "application", subtype or "octet-stream")
                try:
                    part.set_payload(base64.b64decode(att.content_b64))
                except Exception:
                    continue  # skip an unreadable attachment rather than fail the send
                encoders.encode_base64(part)
                part.add_header("Content-Disposition", "attachment", filename=att.filename)
                message.attach(part)
        else:
            message = alternative

        message["to"] = to
        message["subject"] = subject
        if cc:
            message["cc"] = cc
        if bcc:
            message["bcc"] = bcc
        if in_reply_to:
            message["In-Reply-To"] = in_reply_to
            message["References"] = references or in_reply_to
        return message

    @staticmethod
    async def send_email(
        user_id: str,
        to: str,
        subject: str,
        body: str,
        application_id: Optional[str] = None,
        cc: Optional[str] = None,
        bcc: Optional[str] = None,
        attachments: Optional[List[EmailAttachment]] = None,
        thread_id: Optional[str] = None,
        in_reply_to: Optional[str] = None,
        references: Optional[str] = None,
        direction: str = "outbound",
        category: Optional[str] = None,
    ) -> EmailLog:
        """Send an email via the user's connected Gmail account.

        Supports attachments, cc/bcc, and replying within an existing thread
        (pass thread_id + in_reply_to). Captures the Gmail message/thread ids so
        the inbound loop can later track replies.
        """
        credentials = await GmailService._get_credentials(user_id)
        logs_collection = get_email_logs_collection()
        now = datetime.utcnow()

        try:
            from googleapiclient.discovery import build

            service = build("gmail", "v1", credentials=credentials)
            message = GmailService._build_mime(
                to, subject, body, cc, bcc, attachments, in_reply_to, references
            )

            raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
            send_body = {"raw": raw}
            if thread_id:
                send_body["threadId"] = thread_id
            send_result = service.users().messages().send(
                userId="me", body=send_body
            ).execute()

            log_doc = {
                "user_id": user_id,
                "to": to,
                "subject": subject,
                "sent_at": now,
                "application_id": application_id,
                "status": "sent",
                "error_message": None,
                "thread_id": send_result.get("threadId"),
                "message_id": send_result.get("id"),
                "direction": direction,
                "category": category,
            }
            result = await logs_collection.insert_one(log_doc)
            log_doc["_id"] = str(result.inserted_id)
            logger.info(f"Email sent to {to} for user {user_id}")
            return EmailLog(**log_doc)

        except HTTPException:
            raise
        except Exception as e:
            log_doc = {
                "user_id": user_id,
                "to": to,
                "subject": subject,
                "sent_at": now,
                "application_id": application_id,
                "status": "failed",
                "error_message": str(e),
                "direction": direction,
                "category": category,
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

        granted = doc.get("granted_scopes") or ""
        return GmailStatusResponse(
            is_connected=True,
            google_email=doc.get("google_email"),
            connected_at=doc.get("connected_at"),
            inbound_ready=INBOUND_SCOPE in granted,
        )

    @staticmethod
    async def is_inbound_ready(user_id: str) -> bool:
        """True if the stored grant includes the read scope needed for inbound."""
        collection = get_gmail_connections_collection()
        doc = await collection.find_one({"user_id": user_id, "is_connected": True})
        return bool(doc and INBOUND_SCOPE in (doc.get("granted_scopes") or ""))

    # ------------------------------------------------------------------
    # Inbound helpers (need gmail.readonly / gmail.compose scopes)
    # ------------------------------------------------------------------

    @staticmethod
    async def _service(user_id: str):
        from googleapiclient.discovery import build
        credentials = await GmailService._get_credentials(user_id)
        return build("gmail", "v1", credentials=credentials)

    @staticmethod
    async def get_thread_messages(user_id: str, thread_id: str) -> List[dict]:
        """Return simplified messages for a thread: {id, from, to, date, snippet, is_inbound}."""
        service = await GmailService._service(user_id)
        thread = service.users().threads().get(userId="me", id=thread_id, format="metadata",
                                               metadataHeaders=["From", "To", "Subject", "Date", "Message-ID"]).execute()
        out = []
        for msg in thread.get("messages", []):
            headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}
            label_ids = msg.get("labelIds", [])
            out.append({
                "id": msg.get("id"),
                "from": headers.get("from", ""),
                "to": headers.get("to", ""),
                "subject": headers.get("subject", ""),
                "date": headers.get("date", ""),
                "rfc_message_id": headers.get("message-id", ""),
                "snippet": msg.get("snippet", ""),
                "is_inbound": "SENT" not in label_ids,  # messages the user sent are labelled SENT
            })
        return out

    @staticmethod
    async def get_message_text(user_id: str, message_id: str) -> str:
        """Fetch a single message's plain-text body (falls back to the snippet)."""
        service = await GmailService._service(user_id)
        msg = service.users().messages().get(userId="me", id=message_id, format="full").execute()

        def _walk(part) -> Optional[str]:
            if part.get("mimeType") == "text/plain":
                data = part.get("body", {}).get("data")
                if data:
                    return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
            for sub in part.get("parts", []) or []:
                found = _walk(sub)
                if found:
                    return found
            return None

        payload = msg.get("payload", {})
        text = _walk(payload)
        return (text or msg.get("snippet", "") or "").strip()

    @staticmethod
    async def create_draft(user_id: str, to: str, subject: str, body: str,
                           thread_id: Optional[str] = None,
                           in_reply_to: Optional[str] = None,
                           references: Optional[str] = None) -> str:
        """Create an in-thread Gmail draft (for review). Returns the draft id."""
        service = await GmailService._service(user_id)
        message = GmailService._build_mime(
            to, subject, body, in_reply_to=in_reply_to, references=references
        )
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
        draft_body = {"message": {"raw": raw}}
        if thread_id:
            draft_body["message"]["threadId"] = thread_id
        result = service.users().drafts().create(userId="me", body=draft_body).execute()
        return result.get("id", "")

    @staticmethod
    async def delete_draft(user_id: str, draft_id: str) -> None:
        """Delete a Gmail draft (used after the user sends the reply from the app)."""
        if not draft_id:
            return
        try:
            service = await GmailService._service(user_id)
            service.users().drafts().delete(userId="me", id=draft_id).execute()
        except Exception as e:
            logger.warning(f"Failed to delete draft {draft_id}: {e}")

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
