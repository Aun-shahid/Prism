from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .jwt import verify_token
from .utils import get_user_by_id
from .permissions import check_super_admin
from ..models.users import User

ACCESS_TOKEN_COOKIE_NAME = "access_token"
security = HTTPBearer(auto_error=False)

async def _verify_token_str(token: str) -> dict | None:
    if not token:
        return None
    return verify_token(token, "access")

async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    """Extract and validate the current user from Bearer token or cookie."""
    token_str = None
    if credentials and getattr(credentials, "credentials", None):
        token_str = credentials.credentials
    else:
        token_str = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)

    payload = await _verify_token_str(token_str)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await get_user_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )

    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return current_user

async def require_super_admin(
    current_user: User = Depends(get_current_active_user),
) -> User:
    check_super_admin(current_user)
    return current_user

# Legacy alias
require_admin = require_super_admin

async def get_current_user_websocket(token: str) -> User | None:
    try:
        payload = verify_token(token, "access")
        if payload is None:
            return None
        user_id = payload.get("sub")
        if user_id is None:
            return None
        user = await get_user_by_id(user_id)
        if user is None or not user.is_active:
            return None
        return user
    except Exception:
        return None
