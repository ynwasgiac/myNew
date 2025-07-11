# database/auth_schemas.py
from pydantic import BaseModel, EmailStr, Field, validator
from datetime import datetime
from typing import Optional
from enum import Enum
import re


class UserRoleEnum(str, Enum):
    STUDENT = "student"
    WRITER = "writer"
    ADMIN = "admin"


def validate_password(password: str) -> str:
    """Validate password requirements"""
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")

    if len(password) > 100:
        raise ValueError("Password must be less than 100 characters long")

    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter")

    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter")

    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one number")

    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password):
        raise ValueError("Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;':\"\\,.<>/?)")

    # Check for common weak patterns
    if password.lower() in ["password", "123456789", "qwertyuiop", "admin", "user"]:
        raise ValueError("Password is too common and weak")

    return password


# Language preference schemas
class UserLanguagePreference(BaseModel):
    """User's main language preference"""
    language_code: str = Field(..., min_length=2, max_length=5, description="Language code (e.g., 'en', 'ru', 'kk')")


class UserMainLanguageResponse(BaseModel):
    """Response for user's main language"""
    language_code: Optional[str] = None
    language_name: Optional[str] = None

    class Config:
        from_attributes = True


# User schemas
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: Optional[str] = Field(None, max_length=100)


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=100)
    role: UserRoleEnum = UserRoleEnum.STUDENT  # Default to student
    main_language_code: Optional[str] = Field(None, min_length=2, max_length=5, description="Preferred language code")

    @validator('password')
    def validate_password_strength(cls, v):
        return validate_password(v)

    @validator('username')
    def validate_username(cls, v):
        if not re.match(r"^[a-zA-Z0-9_-]+$", v):
            raise ValueError("Username can only contain letters, numbers, underscores, and hyphens")
        return v

    @validator('main_language_code')
    def validate_language_code(cls, v):
        if v is not None and not re.match(r"^[a-z]{2,5}$", v.lower()):
            raise ValueError("Language code must be 2-5 lowercase letters")
        return v.lower() if v else v


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, max_length=100)
    role: Optional[UserRoleEnum] = None
    is_active: Optional[bool] = None
    main_language_code: Optional[str] = Field(None, min_length=2, max_length=5, description="Preferred language code")

    @validator('username')
    def validate_username(cls, v):
        if v is not None and not re.match(r"^[a-zA-Z0-9_-]+$", v):
            raise ValueError("Username can only contain letters, numbers, underscores, and hyphens")
        return v

    @validator('main_language_code')
    def validate_language_code(cls, v):
        if v is not None and not re.match(r"^[a-z]{2,5}$", v.lower()):
            raise ValueError("Language code must be 2-5 lowercase letters")
        return v.lower() if v else v


class UserResponse(UserBase):
    id: int
    role: UserRoleEnum
    is_active: bool
    is_superuser: bool
    created_at: datetime
    main_language: Optional[UserMainLanguageResponse] = None

    @validator('main_language', pre=True)
    def format_main_language(cls, v):
        if v is None:
            return None
        if hasattr(v, 'language_code') and hasattr(v, 'language_name'):
            return UserMainLanguageResponse(
                language_code=v.language_code,
                language_name=v.language_name
            )
        return v

    class Config:
        from_attributes = True


class UserProfileResponse(BaseModel):
    """Extended user profile with language preferences"""
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    role: UserRoleEnum
    is_active: bool
    created_at: datetime
    main_language: Optional[UserMainLanguageResponse] = None

    @validator('main_language', pre=True)
    def format_main_language(cls, v):
        if v is None:
            return None
        if hasattr(v, 'language_code') and hasattr(v, 'language_name'):
            return UserMainLanguageResponse(
                language_code=v.language_code,
                language_name=v.language_name
            )
        return v

    class Config:
        from_attributes = True


# Authentication schemas
class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user_role: UserRoleEnum  # Include role in token response
    user_language: Optional[str] = None  # Include user's main language


class TokenData(BaseModel):
    username: Optional[str] = None
    user_id: Optional[int] = None
    jti: Optional[str] = None
    role: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)

    @validator('new_password')
    def validate_new_password_strength(cls, v):
        return validate_password(v)


# Language management schemas
class SetMainLanguageRequest(BaseModel):
    """Request to set user's main language"""
    language_code: str = Field(..., min_length=2, max_length=5, description="Language code to set as main language")

    @validator('language_code')
    def validate_language_code(cls, v):
        v = v.lower()  # Convert to lowercase first
        if not re.match(r"^[a-z]{2,5}$", v):
            raise ValueError("Language code must be 2-5 lowercase letters")
        return v


class MainLanguageUpdateResponse(BaseModel):
    """Response after updating main language"""
    success: bool
    message: str
    main_language: Optional[UserMainLanguageResponse] = None

    class Config:
        from_attributes = True