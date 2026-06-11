from datetime import datetime
import hashlib
from fastapi import HTTPException, status
from ..models.users import User, UserRegisterRequest, UserType
from ..database import get_users_collection
from ..auth.utils import (
    get_user_by_email,
    get_user_by_username,
    get_password_hash,
    authenticate_user_by_username_or_email,
    update_user_login
)
from ..auth.jwt import create_access_token, create_refresh_token
from bson import ObjectId

class AuthService:
    @staticmethod
    async def register_user(register_data: UserRegisterRequest) -> User:
        """Register a new user. If this is the first user, auto-elevate to SUPER_ADMIN."""
        users_collection = get_users_collection()
        
        # Check if email is already registered
        existing_email = await get_user_by_email(register_data.email)
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already registered"
            )

        # Check if username is already registered
        existing_username = await get_user_by_username(register_data.username)
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username is already taken"
            )

        # Hash the user's password
        hashed_password = get_password_hash(register_data.password)

        # Determine user role (default to USER)
        role = UserType.USER

        # Construct the user document
        user_data = {
            "email": register_data.email,
            "name": register_data.name,
            "username": register_data.username,
            "hashed_password": hashed_password,
            "role": role.value,
            "is_active": True,
            "email_verified": False,
            "created_at": datetime.utcnow(),
            "last_login": None,
            "google_id": None,
            "refresh_token": None,
            "refresh_token_expires_at": None,
        }

        # Insert user into MongoDB
        result = await users_collection.insert_one(user_data)
        user_data["_id"] = str(result.inserted_id)

        return User(**user_data)

    @staticmethod
    async def login_user(username_or_email: str, password: str) -> dict:
        """Authenticate user and return access + refresh tokens."""
        user = await authenticate_user_by_username_or_email(username_or_email, password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username/email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Update last login timestamp in DB
        await update_user_login(user.id)

        # Generate tokens
        token_data = {"sub": str(user.id)}
        access_token = create_access_token(token_data)
        
        refresh_token, expires_at = create_refresh_token()
        hashed_refresh = hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()

        # Save hashed refresh token to user document
        users_collection = get_users_collection()
        await users_collection.update_one(
            {"_id": ObjectId(user.id)},
            {"$set": {
                "refresh_token": hashed_refresh,
                "refresh_token_expires_at": expires_at
            }}
        )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": user
        }

    @staticmethod
    async def refresh_access_token(refresh_token: str) -> dict:
        """Verify the refresh token and return rotated access + refresh tokens."""
        if not refresh_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token missing"
            )

        hashed_refresh = hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()
        users_collection = get_users_collection()

        # Find user with matching active refresh token
        user_data = await users_collection.find_one({
            "refresh_token": hashed_refresh,
            "refresh_token_expires_at": {"$gt": datetime.utcnow()}
        })

        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token"
            )

        user_id = str(user_data["_id"])
        
        # Generate new tokens
        token_data = {"sub": user_id}
        new_access_token = create_access_token(token_data)
        
        new_refresh_token, expires_at = create_refresh_token()
        new_hashed_refresh = hashlib.sha256(new_refresh_token.encode("utf-8")).hexdigest()

        # Rotate refresh token in DB
        await users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "refresh_token": new_hashed_refresh,
                "refresh_token_expires_at": expires_at
            }}
        )

        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer"
        }
