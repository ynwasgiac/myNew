from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from typing import Optional, Dict, Any

from database.auth_models import UserPreferences, User
from database.learning_schemas import UserPreferencesCreate, UserPreferencesUpdate

class UserPreferencesCRUD:
    
    @staticmethod
    async def get_user_preferences(db: AsyncSession, user_id: int) -> Optional[UserPreferences]:
        """Get user preferences by user ID"""
        result = await db.execute(
            select(UserPreferences).where(UserPreferences.user_id == user_id)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def create_user_preferences(
        db: AsyncSession, 
        user_id: int, 
        preferences_data: UserPreferencesCreate
    ) -> UserPreferences:
        """Create new user preferences"""
        preferences = UserPreferences(
            user_id=user_id,
            **preferences_data.dict()
        )
        db.add(preferences)
        await db.commit()
        await db.refresh(preferences)
        return preferences
    
    @staticmethod
    async def update_user_preferences(
        db: AsyncSession,
        user_id: int,
        preferences_update: UserPreferencesUpdate
    ) -> Optional[UserPreferences]:
        """Update user preferences"""
        # Get existing preferences
        existing = await UserPreferencesCRUD.get_user_preferences(db, user_id)
        
        if not existing:
            # Create new preferences if they don't exist
            create_data = UserPreferencesCreate(
                **{k: v for k, v in preferences_update.dict().items() if v is not None}
            )
            return await UserPreferencesCRUD.create_user_preferences(db, user_id, create_data)
        
        # Update existing preferences
        update_data = {k: v for k, v in preferences_update.dict().items() if v is not None}
        
        if update_data:
            await db.execute(
                update(UserPreferences)
                .where(UserPreferences.user_id == user_id)
                .values(**update_data, updated_at=datetime.utcnow())
            )
            await db.commit()
            await db.refresh(existing)
        
        return existing
    
    @staticmethod
    async def get_or_create_preferences(
        db: AsyncSession, 
        user_id: int
    ) -> UserPreferences:
        """Get user preferences or create with defaults if they don't exist"""
        preferences = await UserPreferencesCRUD.get_user_preferences(db, user_id)
        
        if not preferences:
            # Create with defaults
            default_preferences = UserPreferencesCreate()
            preferences = await UserPreferencesCRUD.create_user_preferences(
                db, user_id, default_preferences
            )
        
        return preferences