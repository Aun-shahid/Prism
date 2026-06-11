from datetime import datetime
from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException, status

from ..database import get_applications_collection
from ..models.applications import (
    JobApplication,
    ApplicationCreateRequest,
    ApplicationUpdateRequest,
    ApplicationStatus,
    ApplicationStats,
)
from .logging_service import get_logger

logger = get_logger("application_service")


class ApplicationService:
    @staticmethod
    async def create_application(user_id: str, data: ApplicationCreateRequest) -> JobApplication:
        """Create a new job application entry."""
        collection = get_applications_collection()
        now = datetime.utcnow()

        doc = {
            "user_id": user_id,
            **data.model_dump(),
            "resume_id": None,
            "cover_letter_id": None,
            "created_at": now,
            "updated_at": now,
        }
        # Ensure status is stored as string
        doc["status"] = doc["status"].value if hasattr(doc["status"], "value") else doc["status"]

        result = await collection.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        logger.info(f"Created application '{data.position}' at '{data.company}' for user {user_id}")
        return JobApplication(**doc)

    @staticmethod
    async def list_applications(
        user_id: str,
        status_filter: Optional[ApplicationStatus] = None,
        search: Optional[str] = None,
    ) -> List[JobApplication]:
        """List applications with optional status filter and search."""
        collection = get_applications_collection()
        query = {"user_id": user_id}

        if status_filter:
            query["status"] = status_filter.value

        if search:
            query["$or"] = [
                {"company": {"$regex": search, "$options": "i"}},
                {"position": {"$regex": search, "$options": "i"}},
                {"tags": {"$regex": search, "$options": "i"}},
            ]

        cursor = collection.find(query).sort("updated_at", -1)
        applications = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            applications.append(JobApplication(**doc))
        return applications

    @staticmethod
    async def get_application(user_id: str, app_id: str) -> JobApplication:
        """Get a single application by ID."""
        collection = get_applications_collection()
        try:
            oid = ObjectId(app_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid application ID")

        doc = await collection.find_one({"_id": oid, "user_id": user_id})
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

        doc["_id"] = str(doc["_id"])
        return JobApplication(**doc)

    @staticmethod
    async def update_application(
        user_id: str, app_id: str, data: ApplicationUpdateRequest
    ) -> JobApplication:
        """Update an existing application."""
        collection = get_applications_collection()
        try:
            oid = ObjectId(app_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid application ID")

        update_dict = data.model_dump(exclude_unset=True)
        if not update_dict:
            return await ApplicationService.get_application(user_id, app_id)

        # Convert enum to string value
        if "status" in update_dict and hasattr(update_dict["status"], "value"):
            update_dict["status"] = update_dict["status"].value

        update_dict["updated_at"] = datetime.utcnow()

        result = await collection.update_one(
            {"_id": oid, "user_id": user_id},
            {"$set": update_dict}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

        return await ApplicationService.get_application(user_id, app_id)

    @staticmethod
    async def delete_application(user_id: str, app_id: str) -> bool:
        """Delete a job application."""
        collection = get_applications_collection()
        try:
            oid = ObjectId(app_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid application ID")

        result = await collection.delete_one({"_id": oid, "user_id": user_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

        logger.info(f"Deleted application {app_id} for user {user_id}")
        return True

    @staticmethod
    async def get_statistics(user_id: str) -> ApplicationStats:
        """Calculate pipeline statistics for the user's applications."""
        collection = get_applications_collection()
        cursor = collection.find({"user_id": user_id})

        counts = {s.value: 0 for s in ApplicationStatus}
        total = 0

        async for doc in cursor:
            total += 1
            s = doc.get("status", "wishlist")
            if s in counts:
                counts[s] += 1

        applied = counts.get("applied", 0)
        interviewing = counts.get("interviewing", 0)
        offered = counts.get("offered", 0)

        response_rate = ((interviewing + offered) / applied * 100) if applied > 0 else 0.0
        offer_rate = (offered / total * 100) if total > 0 else 0.0

        return ApplicationStats(
            total=total,
            wishlist=counts.get("wishlist", 0),
            applied=applied,
            interviewing=interviewing,
            offered=offered,
            rejected=counts.get("rejected", 0),
            withdrawn=counts.get("withdrawn", 0),
            response_rate=round(response_rate, 1),
            offer_rate=round(offer_rate, 1),
        )
