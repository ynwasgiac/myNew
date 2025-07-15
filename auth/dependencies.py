# auth/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from database import get_db
from database.auth_crud import UserCRUD, UserSessionCRUD
from database.auth_models import User, UserRole
from .utils import decode_access_token

# Initialize HTTP Bearer security
security = HTTPBearer()


async def get_current_user(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        db: AsyncSession = Depends(get_db)
) -> User:
    """
    Get the current authenticated user from JWT token
    """
    token = credentials.credentials
    print(f"DEBUG: Received token: {token[:20]}..." if len(token) > 20 else f"DEBUG: Received token: {token}")

    try:
        # Decode JWT token
        payload = decode_access_token(token)
        print(f"DEBUG: Decoded payload: {payload}")

        # Extract user data from token
        username = payload.get("sub")
        user_id = payload.get("user_id")
        jti = payload.get("jti")

        # Validate required fields
        if not username or not user_id or not jti:
            print("DEBUG: Missing required token fields")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token data",
                headers={"WWW-Authenticate": "Bearer"}
            )

        # Check if session is valid
        session = await UserSessionCRUD.get_session_by_jti(db, jti)
        print(f"DEBUG: Session lookup result: {session}")
        
        if not session:
            print("DEBUG: Session not found or expired")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired or revoked",
                headers={"WWW-Authenticate": "Bearer"}
            )

        # Get user from database
        user = await UserCRUD.get_user_by_id(db, user_id)
        print(f"DEBUG: User lookup result: {user}")
        
        if not user:
            print("DEBUG: User not found")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"}
            )

        # Check if user is active
        if not user.is_active:
            print("DEBUG: User account disabled")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account disabled",
                headers={"WWW-Authenticate": "Bearer"}
            )

        print(f"DEBUG: Authentication successful for user: {user.username}")
        return user

    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG: Authentication exception: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"}
        )


async def get_current_active_user(
        current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current active user (alias for clarity)
    """
    return current_user


async def get_current_admin(
        current_user: User = Depends(get_current_user)
) -> User:
    """
    Verify current user has admin role
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


async def get_current_writer_or_admin(
        current_user: User = Depends(get_current_user)
) -> User:
    """
    Verify current user has writer or admin role
    """
    if current_user.role not in [UserRole.WRITER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Writer or Admin access required"
        )
    return current_user


async def get_current_student_or_above(
        current_user: User = Depends(get_current_user)
) -> User:
    """
    Verify current user has student, writer, or admin role (any authenticated user)
    """
    if current_user.role not in [UserRole.STUDENT, UserRole.WRITER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User access required"
        )
    return current_user


def require_role(required_role: UserRole):
    """
    Factory function to create role-specific dependency
    """

    async def role_dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"{required_role.value.title()} role required"
            )
        return current_user

    return role_dependency


def require_any_role(allowed_roles: List[UserRole]):
    """
    Factory function to create multi-role dependency
    """

    async def multi_role_dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            role_names = [role.value.title() for role in allowed_roles]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {', '.join(role_names)}"
            )
        return current_user

    return multi_role_dependency


async def get_current_user_optional(
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
        db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """
    Get current user if token provided, otherwise return None
    Useful for endpoints that can work with or without authentication
    """
    if not credentials:
        return None

    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None


# Legacy compatibility
async def get_current_superuser(
        current_user: User = Depends(get_current_user)
) -> User:
    """
    Legacy superuser check - maps to admin role
    """
    if current_user.role != UserRole.ADMIN and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superuser access required"
        )
    return current_user