from fastapi import APIRouter, Depends, Response, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from ..models.users import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    TokenResponse
)
from ..services.auth_service import AuthService
from ..auth.dependencies import ACCESS_TOKEN_COOKIE_NAME

router = APIRouter(prefix="/auth", tags=["authentication"])

REFRESH_TOKEN_COOKIE_NAME = "refresh_token"

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    """Utility to set both access and refresh tokens as secure, HTTP-only cookies."""
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE_NAME,
        value=access_token,
        httponly=True,
        max_age=30 * 60,  # 30 minutes
        expires=30 * 60,
        samesite="lax",
        secure=False,  # Set to True in production with HTTPS
    )
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        max_age=7 * 24 * 60 * 60,  # 7 days
        expires=7 * 24 * 60 * 60,
        samesite="lax",
        secure=False,  # Set to True in production with HTTPS
    )

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(register_data: UserRegisterRequest):
    """Register a new user. The first user will automatically become a super_admin."""
    user = await AuthService.register_user(register_data)
    return user

@router.post("/login", response_model=TokenResponse)
async def login(login_data: UserLoginRequest, response: Response):
    """Authenticate user with email/username and password."""
    auth_result = await AuthService.login_user(
        username_or_email=login_data.username_or_email,
        password=login_data.password
    )
    set_auth_cookies(
        response, 
        auth_result["access_token"], 
        auth_result["refresh_token"]
    )
    return {
        "access_token": auth_result["access_token"],
        "refresh_token": auth_result["refresh_token"],
        "token_type": auth_result["token_type"]
    }

@router.post("/token", response_model=TokenResponse)
async def login_for_swagger_token(response: Response, form_data: OAuth2PasswordRequestForm = Depends()):
    """Authenticate user using Form data (compatible with Swagger/OpenAPI authorize flow)."""
    auth_result = await AuthService.login_user(
        username_or_email=form_data.username,
        password=form_data.password
    )
    set_auth_cookies(
        response, 
        auth_result["access_token"], 
        auth_result["refresh_token"]
    )
    return {
        "access_token": auth_result["access_token"],
        "refresh_token": auth_result["refresh_token"],
        "token_type": auth_result["token_type"]
    }

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: Request, response: Response):
    """
    Refresh the access token using the refresh token.
    Reads from the secure cookie or falls back to an Authorization header.
    """
    # Try reading the refresh token from cookie
    token_str = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)
    
    # Fallback: check if it's sent in a JSON body (if cookie not present)
    if not token_str:
        try:
            body = await request.json()
            token_str = body.get("refresh_token")
        except Exception:
            token_str = None

    refresh_result = await AuthService.refresh_access_token(token_str)
    
    set_auth_cookies(
        response, 
        refresh_result["access_token"], 
        refresh_result["refresh_token"]
    )
    
    return {
        "access_token": refresh_result["access_token"],
        "refresh_token": refresh_result["refresh_token"],
        "token_type": refresh_result["token_type"]
    }

@router.post("/logout")
async def logout(response: Response):
    """Log out by clearing authentication cookies."""
    response.delete_cookie(
        key=ACCESS_TOKEN_COOKIE_NAME,
        httponly=True,
        samesite="lax",
        secure=False,
    )
    response.delete_cookie(
        key=REFRESH_TOKEN_COOKIE_NAME,
        httponly=True,
        samesite="lax",
        secure=False,
    )
    return {"detail": "Successfully logged out"}
