import asyncio
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import StreamingResponse

from ..auth.dependencies import (
    ACCESS_TOKEN_COOKIE_NAME,
    _verify_token_str,
    get_current_active_user,
)
from ..auth.utils import get_user_by_id
from ..models.notification import NotificationResponse
from ..models.users import User
from ..services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


async def get_current_user_for_stream(
    request: Request,
    token: Optional[str] = Query(None),
) -> User:
    """Extract and validate active user from header, query param, or cookie (for EventSource stream)."""
    token_str = None

    # 1. Try Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token_str = auth_header.split(" ")[1]

    # 2. Try query parameter
    if not token_str and token:
        token_str = token

    # 3. Try cookies
    if not token_str:
        token_str = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)

    if not token_str:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials for stream connection",
        )

    payload = await _verify_token_str(token_str)
    if not payload or not payload.get("sub"):
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token for stream connection",
        )

    user = await get_user_by_id(payload["sub"])
    if not user or not user.is_active:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return user


@router.get("/stream")
async def stream_notifications(
    request: Request,
    current_user: User = Depends(get_current_user_for_stream),
):
    """Server-Sent Events (SSE) stream endpoint to push notifications to the frontend in real-time."""
    async def event_generator():
        queue = asyncio.Queue()
        NotificationService.subscribe(current_user.id, queue)
        try:
            # Send initial connection event
            yield "data: {\"type\": \"connected\"}\n\n"

            while True:
                try:
                    # Wait for a notification with a 30s timeout to send keep-alive pings
                    notification = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {notification.model_dump_json()}\n\n"
                except asyncio.TimeoutError:
                    # Send periodic keep-alive event to prevent browser/gateway timeout
                    yield "data: {\"type\": \"ping\"}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            NotificationService.unsubscribe(current_user.id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
        },
    )


@router.get("", response_model=List[NotificationResponse])
async def list_notifications(
    current_user: User = Depends(get_current_active_user),
    limit: int = Query(50, ge=1, le=100),
):
    """Retrieve recent notifications for the current user."""
    notifications = await NotificationService.list_notifications(current_user.id, limit)
    return notifications


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Mark a notification as read."""
    notification = await NotificationService.mark_read(current_user.id, notification_id)
    return notification


@router.post("/read-all", status_code=status.HTTP_200_OK)
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_active_user),
):
    """Mark all notifications as read for the current user."""
    await NotificationService.mark_all_read(current_user.id)
    return {"message": "All notifications marked as read"}
