from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from ..database import get_users_collection
from ..models.users import User, UserUpdateRequest, UserType
from ..auth.utils import get_password_hash, get_user_by_email, get_user_by_username

class UserService:
    @staticmethod
    async def list_users() -> List[User]:
        """List all users in the system (admin only)."""
        users_collection = get_users_collection()
        users_cursor = users_collection.find()
        users = []
        async for user_doc in users_cursor:
            user_doc["_id"] = str(user_doc["_id"])
            users.append(User(**user_doc))
        return users

    @staticmethod
    async def get_user_by_id(user_id: str) -> Optional[User]:
        """Fetch a specific user by their database ID."""
        users_collection = get_users_collection()
        try:
            oid = ObjectId(user_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user ID format"
            )

        user_doc = await users_collection.find_one({"_id": oid})
        if not user_doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        user_doc["_id"] = str(user_doc["_id"])
        return User(**user_doc)

    @staticmethod
    async def update_user(user_id: str, update_data: UserUpdateRequest, current_user: User) -> User:
        """
        Update user details.
        - Admins can update any field (including role and active status).
        - Regular users can only update their own profile fields (name, username, email, password).
        """
        is_admin = current_user.role == UserType.SUPER_ADMIN
        
        # Check permissions
        if str(current_user.id) != user_id and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this user"
            )

        users_collection = get_users_collection()
        try:
            oid = ObjectId(user_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user ID format"
            )

        # Retrieve current user document
        user_doc = await users_collection.find_one({"_id": oid})
        if not user_doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Filter out fields that regular users are not allowed to change
        update_dict = update_data.model_dump(exclude_unset=True)
        
        if not is_admin:
            update_dict.pop("role", None)
            update_dict.pop("is_active", None)
            update_dict.pop("email_verified", None)

        if not update_dict:
            user_doc["_id"] = str(user_doc["_id"])
            return User(**user_doc)

        # Validate unique email
        if "email" in update_dict and update_dict["email"] != user_doc.get("email"):
            existing = await get_user_by_email(update_dict["email"])
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email is already in use"
                )

        # Validate unique username
        if "username" in update_dict and update_dict["username"] != user_doc.get("username"):
            existing = await get_user_by_username(update_dict["username"])
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username is already in use"
                )

        # Hash password if updated
        if "password" in update_dict:
            password = update_dict.pop("password")
            if password:
                update_dict["hashed_password"] = get_password_hash(password)

        # Update user in DB
        await users_collection.update_one({"_id": oid}, {"$set": update_dict})

        # Fetch updated user doc
        updated_doc = await users_collection.find_one({"_id": oid})
        updated_doc["_id"] = str(updated_doc["_id"])
        return User(**updated_doc)

    @staticmethod
    async def delete_user(user_id: str) -> bool:
        """Delete a user document (admin only)."""
        users_collection = get_users_collection()
        try:
            oid = ObjectId(user_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user ID format"
            )

        result = await users_collection.delete_one({"_id": oid})
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return True
