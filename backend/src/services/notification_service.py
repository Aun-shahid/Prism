import asyncio
from datetime import datetime
from typing import Dict, List, Set
from bson import ObjectId

from ..database import get_notifications_collection
from ..models.notification import Notification
from .logging_service import get_logger

logger = get_logger("notification_service")


class NotificationService:
    # Map from user_id -> set of active asyncio.Queues
    _subscribers: Dict[str, Set[asyncio.Queue]] = {}

    @classmethod
    def subscribe(cls, user_id: str, queue: asyncio.Queue):
        """Register a client's message queue for real-time notifications."""
        if user_id not in cls._subscribers:
            cls._subscribers[user_id] = set()
        cls._subscribers[user_id].add(queue)
        logger.info(f"User {user_id} subscribed to real-time notifications. Active queues: {len(cls._subscribers[user_id])}")

    @classmethod
    def unsubscribe(cls, user_id: str, queue: asyncio.Queue):
        """Remove a client's message queue on disconnect."""
        if user_id in cls._subscribers:
            cls._subscribers[user_id].discard(queue)
            if not cls._subscribers[user_id]:
                del cls._subscribers[user_id]
            logger.info(f"User {user_id} unsubscribed from notifications.")

    @classmethod
    async def create_notification(
        cls, user_id: str, title: str, message: str, type: str = "info"
    ) -> Notification:
        """Create a notification in the database and push to active real-time subscribers."""
        collection = get_notifications_collection()
        now = datetime.utcnow()
        doc = {
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": type,
            "is_read": False,
            "created_at": now,
        }
        result = await collection.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        notification = Notification(**doc)

        # Broadcast to active subscribers for this user
        if user_id in cls._subscribers:
            queues = list(cls._subscribers[user_id])
            logger.info(f"Broadcasting notification to {len(queues)} active queues for user {user_id}")
            for queue in queues:
                try:
                    await queue.put(notification)
                except Exception as e:
                    logger.error(f"Failed to put notification in queue: {e}")

        return notification

    @classmethod
    async def list_notifications(cls, user_id: str, limit: int = 50) -> List[Notification]:
        """List notifications for a user, sorted by created_at desc."""
        collection = get_notifications_collection()
        cursor = collection.find({"user_id": user_id}).sort("created_at", -1).limit(limit)
        notifications = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            notifications.append(Notification(**doc))
        return notifications

    @classmethod
    async def mark_read(cls, user_id: str, notification_id: str) -> Notification:
        """Mark a notification as read."""
        collection = get_notifications_collection()
        try:
            oid = ObjectId(notification_id)
        except Exception:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid notification ID")

        doc = await collection.find_one_and_update(
            {"_id": oid, "user_id": user_id},
            {"$set": {"is_read": True}},
            return_document=True,
        )
        if not doc:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

        doc["_id"] = str(doc["_id"])
        return Notification(**doc)

    @classmethod
    async def mark_all_read(cls, user_id: str) -> bool:
        """Mark all notifications as read for a user."""
        collection = get_notifications_collection()
        await collection.update_many(
            {"user_id": user_id, "is_read": False},
            {"$set": {"is_read": True}}
        )
        return True
