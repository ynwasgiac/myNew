# auth/token_refresh.py
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from database import get_db
from database.auth_crud import UserCRUD, UserSessionCRUD
from database.auth_models import User
from .utils import decode_access_token, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from .dependencies import security

# Configuration
TOKEN_REFRESH_THRESHOLD_MINUTES = 60  # Refresh if token expires in less than 15 minutes
AUTO_REFRESH_ON_ACTIVITY = True  # Enable automatic refresh on user activity
# минимальное время между обновлениями токена
# Это предотвращает слишком частые обновления
MIN_TIME_BETWEEN_REFRESHES_MINUTES = 15

async def check_and_refresh_token(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        db: AsyncSession = Depends(get_db)
) -> tuple[User, Optional[str]]:
    """
    Check token validity and refresh if needed
    Returns: (user, new_token_if_refreshed)
    """
    token = credentials.credentials

    try:
        # Decode the current token
        payload = decode_access_token(token)

        # Extract data
        username = payload.get("sub")
        user_id = payload.get("user_id")
        jti = payload.get("jti")
        exp = payload.get("exp")
        iat = payload.get("iat")  # ✅ Время создания токена

        if not username or not user_id or not jti or not exp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token data",
                headers={"WWW-Authenticate": "Bearer"}
            )

        # Check session validity
        session = await UserSessionCRUD.get_session_by_jti(db, jti)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired or revoked",
                headers={"WWW-Authenticate": "Bearer"}
            )

        # Get user
        user = await UserCRUD.get_user_by_id(db, user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive",
                headers={"WWW-Authenticate": "Bearer"}
            )

        # ✅ УЛУЧШЕННАЯ ЛОГИКА ОБНОВЛЕНИЯ ТОКЕНА
        if AUTO_REFRESH_ON_ACTIVITY:
            token_exp_time = datetime.fromtimestamp(exp)
            token_issued_time = datetime.fromtimestamp(iat) if iat else None
            current_time = datetime.utcnow()
            
            time_until_expiry = token_exp_time - current_time
            
            # Проверяем, нужно ли обновлять токен
            should_refresh = time_until_expiry.total_seconds() < (TOKEN_REFRESH_THRESHOLD_MINUTES * 60)
            
            # ✅ ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: не обновляем слишком часто
            if should_refresh and token_issued_time:
                time_since_issued = current_time - token_issued_time
                if time_since_issued.total_seconds() < (MIN_TIME_BETWEEN_REFRESHES_MINUTES * 60):
                    print(f"DEBUG: Token was issued {time_since_issued} ago, skipping refresh (too soon)")
                    should_refresh = False
            
            if should_refresh:
                print(f"DEBUG: Token expires in {time_until_expiry}, refreshing...")

                # Create new session
                new_expires_at = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
                new_session = await UserSessionCRUD.create_session(db, user.id, new_expires_at)

                # Create new token with current timestamp
                new_token = create_access_token(
                    data={
                        "sub": user.username,
                        "user_id": user.id,
                        "role": user.role.value,
                        "jti": new_session.token_jti,
                        "iat": int(datetime.utcnow().timestamp())  # ✅ Добавляем время создания
                    }
                )

                # Revoke old session
                await UserSessionCRUD.revoke_session(db, jti)

                print(f"DEBUG: Token successfully refreshed for user {user.username}")
                return user, new_token

        return user, None

    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG: Token refresh error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"}
        )


async def get_current_user_with_refresh(
        refresh_data: tuple = Depends(check_and_refresh_token)
) -> User:
    """
    Get current user and automatically refresh token if needed
    If token is refreshed, the new token is added to response headers
    """
    user, new_token = refresh_data

    # Note: FastAPI doesn't allow modifying response headers in dependencies
    # We'll handle this in the route handlers
    if new_token:
        # Store the new token in the user object for access in routes
        user._new_token = new_token

    return user


class TokenRefreshResponse:
    """Helper class to handle token refresh in responses"""

    @staticmethod
    def add_token_header(response, user: User):
        """Add refreshed token to response headers if available"""
        if hasattr(user, '_new_token') and user._new_token:
            response.headers["X-New-Token"] = user._new_token
            response.headers["X-Token-Refreshed"] = "true"
            print(f"DEBUG: Token refreshed for user {user.username}")


# Manual refresh endpoint
from fastapi import APIRouter, Response
from database.auth_schemas import Token, UserRoleEnum

refresh_router = APIRouter(prefix="/auth", tags=["Token Refresh"])


@refresh_router.post("/refresh-token", response_model=Token)
async def refresh_token(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        db: AsyncSession = Depends(get_db)
):
    """
    Manually refresh an access token
    """
    token = credentials.credentials

    try:
        # Decode current token
        payload = decode_access_token(token)

        user_id = payload.get("user_id")
        jti = payload.get("jti")

        if not user_id or not jti:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )

        # Verify session
        session = await UserSessionCRUD.get_session_by_jti(db, jti)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired"
            )

        # Get user
        user = await UserCRUD.get_user_by_id(db, user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )

        # Create new session
        new_expires_at = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        new_session = await UserSessionCRUD.create_session(db, user.id, new_expires_at)

        # Create new token
        new_token = create_access_token(
            data={
                "sub": user.username,
                "user_id": user.id,
                "role": user.role.value,
                "jti": new_session.token_jti
            }
        )

        # Revoke old session
        await UserSessionCRUD.revoke_session(db, jti)

        return {
            "access_token": new_token,
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user_role": UserRoleEnum(user.role.value)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token refresh failed"
        )