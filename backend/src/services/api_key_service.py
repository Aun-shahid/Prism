from datetime import datetime
from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException, status

from ..database import get_api_keys_collection
from ..models.api_keys import APIKeyDocument, APIKeyCreateRequest, AIProvider
from .encryption_service import encrypt_value, decrypt_value
from .logging_service import get_logger

logger = get_logger("api_key_service")


class APIKeyService:
    @staticmethod
    async def store_key(user_id: str, data: APIKeyCreateRequest) -> APIKeyDocument:
        """Encrypt and store an API key. Upserts if provider already exists for user."""
        collection = get_api_keys_collection()
        encrypted = encrypt_value(data.api_key)
        now = datetime.utcnow()

        # Check if user already has a key for this provider
        existing = await collection.find_one({
            "user_id": user_id,
            "provider": data.provider.value,
        })

        if existing:
            # Update existing key
            await collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "encrypted_key": encrypted,
                    "label": data.label or existing.get("label"),
                    "is_active": True,
                    "updated_at": now,
                }}
            )
            # Deactivate all other keys
            await collection.update_many(
                {"user_id": user_id, "_id": {"$ne": existing["_id"]}},
                {"$set": {"is_active": False}}
            )
            updated = await collection.find_one({"_id": existing["_id"]})
            updated["_id"] = str(updated["_id"])
            logger.info(f"Updated {data.provider.value} key for user {user_id}")
            return APIKeyDocument(**updated)

        # Insert new key
        doc = {
            "user_id": user_id,
            "provider": data.provider.value,
            "encrypted_key": encrypted,
            "label": data.label,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        result = await collection.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        # Deactivate all other keys
        await collection.update_many(
            {"user_id": user_id, "_id": {"$ne": result.inserted_id}},
            {"$set": {"is_active": False}}
        )
        logger.info(f"Stored new {data.provider.value} key for user {user_id}")
        return APIKeyDocument(**doc)

    @staticmethod
    async def get_user_keys(user_id: str) -> List[APIKeyDocument]:
        """List all API keys for a user (without decryption)."""
        collection = get_api_keys_collection()
        cursor = collection.find({"user_id": user_id})
        keys = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            keys.append(APIKeyDocument(**doc))
        return keys

    @staticmethod
    async def get_decrypted_key(user_id: str, provider: AIProvider) -> Optional[str]:
        """Retrieve and decrypt the API key for a specific provider. Returns None if not found."""
        collection = get_api_keys_collection()
        doc = await collection.find_one({
            "user_id": user_id,
            "provider": provider.value,
            "is_active": True,
        })
        if not doc:
            return None
        try:
            return decrypt_value(doc["encrypted_key"])
        except ValueError:
            logger.error(f"Failed to decrypt {provider.value} key for user {user_id}")
            return None

    @staticmethod
    async def delete_key(user_id: str, key_id: str) -> bool:
        """Remove a stored API key."""
        collection = get_api_keys_collection()
        try:
            oid = ObjectId(key_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid key ID format"
            )

        result = await collection.delete_one({"_id": oid, "user_id": user_id})
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )
        logger.info(f"Deleted API key {key_id} for user {user_id}")
        return True

    @staticmethod
    async def toggle_key(user_id: str, key_id: str, is_active: bool) -> APIKeyDocument:
        """Enable or disable an API key."""
        collection = get_api_keys_collection()
        try:
            oid = ObjectId(key_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid key ID format"
            )

        if is_active:
            # Deactivate all other keys
            await collection.update_many(
                {"user_id": user_id, "_id": {"$ne": oid}},
                {"$set": {"is_active": False}}
            )

        result = await collection.find_one_and_update(
            {"_id": oid, "user_id": user_id},
            {"$set": {"is_active": is_active, "updated_at": datetime.utcnow()}},
            return_document=True
        )
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )
        result["_id"] = str(result["_id"])
        return APIKeyDocument(**result)
