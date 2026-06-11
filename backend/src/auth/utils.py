import bcrypt
import secrets
import hashlib
import logging
from datetime import datetime
from ..database import get_users_collection
from ..models.users import User, UserType
from ..config import settings
from bson import ObjectId
from bson.errors import InvalidId
import pytz

logger = logging.getLogger(__name__)

def _secret_bytes(secret: str) -> bytes:
    return (secret or "").encode("utf-8")

def _secret_exceeds_bcrypt_limit(secret: str) -> bool:
    return len(_secret_bytes(secret)) > 72

def _prehash_secret(secret: str) -> bytes:
    # Deterministic pre-hash to keep bcrypt input <= 72 bytes.
    return hashlib.sha256(_secret_bytes(secret)).hexdigest().encode("ascii")

def _verify_bcrypt(secret_bytes: bytes, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(secret_bytes, (hashed_password or "").encode("utf-8"))
    except ValueError:
        return False

def verify_password_with_strategy(plain_password: str, hashed_password: str) -> tuple[bool, bool]:
    """
    Verify a password using backward-compatible strategies.

    Returns:
      (is_valid, should_rehash_with_canonical_strategy)
    """
    raw_secret = _secret_bytes(plain_password)
    exceeds_limit = len(raw_secret) > 72

    # 1) Canonical path for all new/updated passwords.
    canonical_secret = _prehash_secret(plain_password) if exceeds_limit else raw_secret
    if _verify_bcrypt(canonical_secret, hashed_password):
        return True, False

    # 2) Legacy compatibility path: old bcrypt behavior truncated >72 bytes.
    if exceeds_limit and _verify_bcrypt(raw_secret[:72], hashed_password):
        logger.info("AUTH fallback_used strategy=legacy_truncate reason=password_gt_72_bytes")
        return True, True

    return False, False

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hash."""
    is_valid, _ = verify_password_with_strategy(plain_password, hashed_password)
    return is_valid

def get_password_hash(password: str) -> str:
    """Hash password with canonical strategy."""
    secret = _prehash_secret(password) if _secret_exceeds_bcrypt_limit(password) else _secret_bytes(password)
    return bcrypt.hashpw(secret, bcrypt.gensalt()).decode("utf-8")

async def get_user_by_email(email: str) -> User:
    """Get user by email from database"""
    users_collection = get_users_collection()
    user_data = await users_collection.find_one({"email": email})
    if user_data:
        # Convert ObjectId to string for Pydantic model
        user_data["_id"] = str(user_data["_id"])
        return User(**user_data)
    return None

async def get_user_by_username(username: str) -> User:
    """Get user by username from database"""
    users_collection = get_users_collection()
    user_data = await users_collection.find_one({"username": username})
    if user_data:
        # Convert ObjectId to string for Pydantic model
        user_data["_id"] = str(user_data["_id"])
        return User(**user_data)
    return None

async def get_user_by_id(user_id: str) -> User:
    """Get user by ID from database"""
    users_collection = get_users_collection()
    try:
        oid = ObjectId(user_id)
    except (InvalidId, TypeError):
        return None

    user_data = await users_collection.find_one({"_id": oid})
    if user_data:
        # Convert ObjectId to string for Pydantic model
        user_data["_id"] = str(user_data["_id"])
        return User(**user_data)
    return None

async def authenticate_user(email: str, password: str) -> User:
    """Authenticate user with email and password"""
    user = await get_user_by_email(email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user

async def authenticate_user_by_username_or_email(username_or_email: str, password: str) -> User:
    """Authenticate user with username or email and password"""
    # Try to find user by username first
    user = await get_user_by_username(username_or_email)
    
    # If not found by username, try by email
    if not user:
        user = await get_user_by_email(username_or_email)
    
    # If still not found, return None
    if not user:
        return None
    
    # Verify password using compatibility-aware strategy.
    is_valid, should_rehash = verify_password_with_strategy(password, user.hashed_password)
    if not is_valid:
        return None

    # Opportunistic migration: if user authenticated via legacy truncation path,
    # persist canonical hash now to avoid future ambiguity.
    if should_rehash:
        logger.info("AUTH migration_applied strategy=canonical_prehash user=%s", user.id)
        users_collection = get_users_collection()
        await users_collection.update_one(
            {"_id": ObjectId(user.id)},
            {"$set": {"hashed_password": get_password_hash(password)}}
        )
    
    return user

async def update_user_login(user_id: str):
    """Update user's last login time"""
    users_collection = get_users_collection()
    tz = pytz.timezone(settings.TIMEZONE)
    try:
        oid = ObjectId(user_id)
    except (InvalidId, TypeError):
        return

    await users_collection.update_one(
        {"_id": oid},
        {"$set": {"last_login": datetime.now(tz)}}
    )

async def create_user_from_oauth(email: str, name: str, google_id: str, user_type: UserType = UserType.USER) -> User:
    """Create a new user from OAuth provider data"""
    users_collection = get_users_collection()
    
    user_data = {
        "email": email,
        "name": name,
        "role": user_type.value,
        "hashed_password": "",  # OAuth users don't have password
        "is_active": True,
        "email_verified": True,  # OAuth users are pre-verified
        "created_at": datetime.utcnow(),
        "last_login": datetime.utcnow(),
        "google_id": google_id,
        "refresh_token": None,
        "refresh_token_expires_at": None,
    }
    
    result = await users_collection.insert_one(user_data)
    user_data["_id"] = str(result.inserted_id)
    
    return User(**user_data)
