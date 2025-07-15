# auth/routes.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from database import get_db
from database.auth_crud import UserCRUD, UserSessionCRUD
from database.auth_schemas import UserCreate, UserLogin, Token, UserResponse, PasswordChange, UserRoleEnum
from database.auth_models import UserRole
from .utils import verify_password, get_password_hash, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from .dependencies import get_current_user, get_current_admin, security
import uuid

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=201)
async def register_user(
        user_data: UserCreate,
        db: AsyncSession = Depends(get_db)
):
    """Register a new user (defaults to student role)"""
    # Check if username already exists
    existing_user = await UserCRUD.get_user_by_username(db, user_data.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    # Check if email already exists
    existing_email = await UserCRUD.get_user_by_email(db, user_data.email)
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Hash the password
    hashed_password = get_password_hash(user_data.password)

    # Convert enum to model enum
    role_mapping = {
        UserRoleEnum.STUDENT: UserRole.STUDENT,
        UserRoleEnum.WRITER: UserRole.WRITER,
        UserRoleEnum.ADMIN: UserRole.ADMIN
    }

    # Create the user
    user = await UserCRUD.create_user(
        db,
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        role=role_mapping[user_data.role]
    )

    return user


@router.post("/login", response_model=Token)
async def login_user(
        user_credentials: UserLogin,
        db: AsyncSession = Depends(get_db)
):
    """Login user and return access token"""
    # Get user by username
    user = await UserCRUD.get_user_by_username(db, user_credentials.username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )

    # Verify password
    if not verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )

    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled"
        )

    # Create session
    expires_at = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    session = await UserSessionCRUD.create_session(db, user.id, expires_at)

    # Create access token with role
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user.username,
            "user_id": user.id,
            "role": user.role.value,
            "jti": session.jti
        },
        expires_delta=access_token_expires
    )

    # Convert model enum to response enum
    response_role = UserRoleEnum(user.role.value)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # Convert to seconds
        "user_role": response_role
    }


@router.post("/logout")
async def logout_user(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        db: AsyncSession = Depends(get_db)
):
    """Logout user and revoke token"""
    from .utils import decode_access_token

    token = credentials.credentials
    payload = decode_access_token(token)
    jti = payload.get("jti")

    if jti:
        await UserSessionCRUD.revoke_session(db, jti)

    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
        current_user=Depends(get_current_user)
):
    """Get current user information"""
    return current_user


@router.post("/change-password")
async def change_password(
        password_data: PasswordChange,
        current_user=Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Change user password"""
    # Verify current password
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )

    # Hash new password
    new_hashed_password = get_password_hash(password_data.new_password)

    # Update password
    success = await UserCRUD.update_password(db, current_user.id, new_hashed_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update password"
        )

    # Revoke all existing sessions for security
    await UserSessionCRUD.revoke_user_sessions(db, current_user.id)

    return {"message": "Password changed successfully. Please login again."}


@router.post("/revoke-all-sessions")
async def revoke_all_sessions(
        current_user=Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Revoke all user sessions (logout from all devices)"""
    await UserSessionCRUD.revoke_user_sessions(db, current_user.id)
    return {"message": "All sessions revoked successfully"}


# Admin-only endpoints
@router.post("/admin/promote-user")
async def promote_user_role(
        user_id: int,
        new_role: UserRoleEnum,
        db: AsyncSession = Depends(get_db),
        admin_user=Depends(get_current_admin)
):
    """Promote or change user role (admin only)"""
    # Convert enum to model enum
    role_mapping = {
        UserRoleEnum.STUDENT: UserRole.STUDENT,
        UserRoleEnum.WRITER: UserRole.WRITER,
        UserRoleEnum.ADMIN: UserRole.ADMIN
    }

    user = await UserCRUD.update_user_role(db, user_id, role_mapping[new_role])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return {
        "message": f"User {user.username} role updated to {new_role.value}",
        "user": user
    }