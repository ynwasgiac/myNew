# database/auth_crud.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import datetime, timedelta
from .auth_models import User, UserSession, UserRole
from .models import Language
import uuid


class UserCRUD:
    @staticmethod
    async def create_user(
            db: AsyncSession,
            username: str,
            email: str,
            hashed_password: str,
            full_name: Optional[str] = None,
            role: UserRole = UserRole.STUDENT,
            main_language_code: Optional[str] = None
    ) -> User:
        """Create a new user with optional main language"""
        main_language_id = None

        # If main_language_code is provided, get the language ID
        if main_language_code:
            language_result = await db.execute(
                select(Language).where(Language.language_code == main_language_code)
            )
            language = language_result.scalar_one_or_none()
            if language:
                main_language_id = language.id

        db_user = User(
            username=username,
            email=email,
            hashed_password=hashed_password,
            full_name=full_name,
            role=role,
            main_language_id=main_language_id
        )
        db.add(db_user)
        await db.commit()
        await db.refresh(db_user)
        return db_user

    @staticmethod
    async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
        """Get user by ID with main language relationship"""
        result = await db.execute(
            select(User)
            .options(selectinload(User.main_language))
            .where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_by_username(db: AsyncSession, username: str) -> Optional[User]:
        """Get user by username with main language relationship"""
        result = await db.execute(
            select(User)
            .options(selectinload(User.main_language))
            .where(User.username == username)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
        """Get user by email with main language relationship"""
        result = await db.execute(
            select(User)
            .options(selectinload(User.main_language))
            .where(User.email == email)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def update_user(
            db: AsyncSession,
            user_id: int,
            **kwargs
    ) -> Optional[User]:
        """Update user fields"""
        update_data = {k: v for k, v in kwargs.items() if v is not None}
        if not update_data:
            return await UserCRUD.get_user_by_id(db, user_id)

        update_data['updated_at'] = datetime.utcnow()

        stmt = (
            update(User)
            .where(User.id == user_id)
            .values(**update_data)
            .returning(User)
        )
        result = await db.execute(stmt)
        await db.commit()
        updated_user = result.scalar_one_or_none()

        # Refresh to get the relationship data
        if updated_user:
            await db.refresh(updated_user)

        return updated_user

    @staticmethod
    async def set_user_main_language(
            db: AsyncSession,
            user_id: int,
            language_code: str
    ) -> Optional[User]:
        """Set user's main language by language code"""
        # First, get the language by code
        language_result = await db.execute(
            select(Language).where(Language.language_code == language_code)
        )
        language = language_result.scalar_one_or_none()

        if not language:
            return None  # Language not found

        # Update user's main_language_id
        return await UserCRUD.update_user(db, user_id, main_language_id=language.id)

    @staticmethod
    async def get_user_main_language(
            db: AsyncSession,
            user_id: int
    ) -> Optional[Language]:
        """Get user's main language"""
        user = await UserCRUD.get_user_by_id(db, user_id)
        return user.main_language if user else None

    @staticmethod
    async def clear_user_main_language(
            db: AsyncSession,
            user_id: int
    ) -> Optional[User]:
        """Clear user's main language (set to None)"""
        return await UserCRUD.update_user(db, user_id, main_language_id=None)

    @staticmethod
    async def update_password(
            db: AsyncSession,
            user_id: int,
            hashed_password: str
    ) -> bool:
        """Update user password"""
        stmt = (
            update(User)
            .where(User.id == user_id)
            .values(hashed_password=hashed_password, updated_at=datetime.utcnow())
        )
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount > 0

    @staticmethod
    async def update_user_role(
            db: AsyncSession,
            user_id: int,
            role: UserRole
    ) -> Optional[User]:
        """Update user role (admin only operation)"""
        return await UserCRUD.update_user(db, user_id, role=role)


class UserSessionCRUD:
    @staticmethod
    (
            db: AsyncSession,
            user_id: int,
            expires_at: datetime
    ) -> UserSession:
        """Create a new user session"""
        jti = str(uuid.uuid4())

        db_session = UserSession(
            user_id=user_id,
            token_jti=jti,
            expires_at=expires_at
        )
        db.add(db_session)
        await db.commit()
        await db.refresh(db_session)
        return db_session

    @staticmethod
    async def get_session_by_jti(db: AsyncSession, jti: str) -> Optional[UserSession]:
        """Get session by JWT ID"""
        result = await db.execute(
            select(UserSession).where(
                and_(
                    UserSession.token_jti == jti,
                    UserSession.is_revoked == False,
                    UserSession.expires_at > datetime.utcnow()
                )
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def revoke_session(db: AsyncSession, jti: str) -> bool:
        """Revoke a session"""
        stmt = (
            update(UserSession)
            .where(UserSession.token_jti == jti)
            .values(is_revoked=True)
        )
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount > 0

    @staticmethod
    async def revoke_user_sessions(db: AsyncSession, user_id: int) -> bool:
        """Revoke all sessions for a user"""
        stmt = (
            update(UserSession)
            .where(UserSession.user_id == user_id)
            .values(is_revoked=True)
        )
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount > 0

    @staticmethod
    async def cleanup_expired_sessions(db: AsyncSession) -> int:
        """Clean up expired sessions"""
        stmt = delete(UserSession).where(UserSession.expires_at < datetime.utcnow())
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount