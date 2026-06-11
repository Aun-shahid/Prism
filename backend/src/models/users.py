from enum import Enum
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, EmailStr

class UserType(str, Enum):
    SUPER_ADMIN = "super_admin"
    USER = "user"

def is_system_admin(role: str | UserType) -> bool:
    if isinstance(role, UserType):
        return role == UserType.SUPER_ADMIN
    return role == UserType.SUPER_ADMIN.value

class User(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    email: EmailStr
    name: str
    username: Optional[str] = None
    hashed_password: str
    role: UserType = UserType.USER
    is_active: bool = True
    email_verified: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    google_id: Optional[str] = None
    refresh_token: Optional[str] = None
    refresh_token_expires_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class UserRegisterRequest(BaseModel):
    email: EmailStr
    name: str
    username: str
    password: str

class UserLoginRequest(BaseModel):
    username_or_email: str
    password: str

class UserResponse(BaseModel):
    id: str = Field(alias="_id")
    email: EmailStr
    name: str
    username: Optional[str] = None
    role: UserType
    is_active: bool
    email_verified: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    google_id: Optional[str] = None

    class Config:
        populate_by_name = True

class UserUpdateRequest(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[UserType] = None
    is_active: Optional[bool] = None
    email_verified: Optional[bool] = None
    google_id: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
