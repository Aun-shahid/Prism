from datetime import datetime

from ..database import get_email_settings_collection
from ..models.email_settings import (
    EmailSettings,
    EmailSettingsUpdateRequest,
    MAX_CUSTOM_INSTRUCTIONS,
)
from .logging_service import get_logger

logger = get_logger("email_settings_service")

_VALID_TONES = {"formal", "warm", "direct"}
_VALID_LENGTHS = {"short", "medium"}


class EmailSettingsService:
    @staticmethod
    async def get_or_create(user_id: str) -> EmailSettings:
        """Return the user's email settings, creating defaults on first access."""
        collection = get_email_settings_collection()
        doc = await collection.find_one({"user_id": user_id})
        if doc:
            doc["_id"] = str(doc["_id"])
            return EmailSettings(**doc)

        now = datetime.utcnow()
        defaults = EmailSettings(user_id=user_id, created_at=now, updated_at=now)
        payload = defaults.model_dump(by_alias=False, exclude={"id"})
        result = await collection.insert_one(payload)
        defaults.id = str(result.inserted_id)
        logger.info(f"Created default email settings for user {user_id}")
        return defaults

    @staticmethod
    async def update(user_id: str, data: EmailSettingsUpdateRequest) -> EmailSettings:
        """Patch the user's email settings, coercing invalid enum/limit values."""
        collection = get_email_settings_collection()
        await EmailSettingsService.get_or_create(user_id)  # ensure a doc exists

        update = data.model_dump(exclude_unset=True)

        # Validation / clamping so a bad value can't reach the model or blow costs.
        if "tone" in update and update["tone"] not in _VALID_TONES:
            update["tone"] = "warm"
        if "length" in update and update["length"] not in _VALID_LENGTHS:
            update["length"] = "short"
        if "custom_instructions" in update and update["custom_instructions"]:
            update["custom_instructions"] = update["custom_instructions"][:MAX_CUSTOM_INSTRUCTIONS]
        if "daily_send_limit" in update and update["daily_send_limit"] is not None:
            update["daily_send_limit"] = max(1, min(int(update["daily_send_limit"]), 200))

        update["updated_at"] = datetime.utcnow()
        await collection.update_one({"user_id": user_id}, {"$set": update})

        doc = await collection.find_one({"user_id": user_id})
        doc["_id"] = str(doc["_id"])
        logger.info(f"Updated email settings for user {user_id}")
        return EmailSettings(**doc)
