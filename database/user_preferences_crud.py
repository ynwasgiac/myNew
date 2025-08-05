from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, and_, or_
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta

from database.user_preferences_models import UserPreferences
from database.auth_models import User
from database.user_preferences_schemas import (
    PreferencesCreate, PreferencesUpdate, NotificationSettingsUpdate,
    QuizSettingsUpdate, LearningSettingsUpdate, PracticeSettingsUpdate
)


class UserPreferencesCRUD:
    """CRUD operations for user preferences"""

    # ===== CREATE OPERATIONS =====

    @staticmethod
    async def create_preferences(
            db: AsyncSession,
            user_id: int,
            preferences_data: PreferencesCreate
    ) -> UserPreferences:
        """Create new user preferences"""
        new_preferences = UserPreferences(
            user_id=user_id,
            quiz_word_count=preferences_data.quiz_word_count,
            practice_word_count=preferences_data.practice_word_count,
            daily_goal=preferences_data.daily_goal,
            session_length=preferences_data.session_length,
            notification_settings=preferences_data.notification_settings.dict()
        )

        db.add(new_preferences)
        await db.commit()
        await db.refresh(new_preferences)
        return new_preferences

    @staticmethod
    async def create_default_preferences(
            db: AsyncSession,
            user_id: int
    ) -> UserPreferences:
        """Create default preferences for a user"""
        default_preferences = UserPreferences(
            user_id=user_id,
            quiz_word_count=6,
            practice_word_count=6,
            daily_goal=12,
            session_length=20,
            notification_settings={
                'daily_reminders': True,
                'review_reminders': True,
                'achievement_notifications': True,
                'streak_reminders': True,
                'goal_reminders': True
            }
        )

        db.add(default_preferences)
        await db.commit()
        await db.refresh(default_preferences)
        return default_preferences

    # ===== READ OPERATIONS =====

    @staticmethod
    async def get_preferences_by_user_id(
            db: AsyncSession,
            user_id: int
    ) -> Optional[UserPreferences]:
        """Get user preferences by user ID"""
        result = await db.execute(
            select(UserPreferences).where(UserPreferences.user_id == user_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_preferences_with_user(
            db: AsyncSession,
            user_id: int
    ) -> Optional[UserPreferences]:
        """Get preferences with user information"""
        result = await db.execute(
            select(UserPreferences)
            .options(joinedload(UserPreferences.user))
            .where(UserPreferences.user_id == user_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_or_create_preferences(
            db: AsyncSession,
            user_id: int
    ) -> UserPreferences:
        """Get preferences or create default ones if they don't exist"""
        preferences = await UserPreferencesCRUD.get_preferences_by_user_id(db, user_id)

        if not preferences:
            preferences = await UserPreferencesCRUD.create_default_preferences(db, user_id)

        return preferences

    @staticmethod
    async def preferences_exist(
            db: AsyncSession,
            user_id: int
    ) -> bool:
        """Check if preferences exist for a user"""
        result = await db.execute(
            select(func.count(UserPreferences.id))
            .where(UserPreferences.user_id == user_id)
        )
        return result.scalar() > 0

    # ===== UPDATE OPERATIONS =====

    @staticmethod
    async def update_preferences(
            db: AsyncSession,
            user_id: int,
            preferences_data: PreferencesUpdate
    ) -> Optional[UserPreferences]:
        """Update user preferences"""
        # Build update data
        update_data = {'updated_at': datetime.utcnow()}

        if preferences_data.quiz_word_count is not None:
            update_data['quiz_word_count'] = preferences_data.quiz_word_count
        if preferences_data.practice_word_count is not None:
            update_data['practice_word_count'] = preferences_data.practice_word_count
        if preferences_data.daily_goal is not None:
            update_data['daily_goal'] = preferences_data.daily_goal
        if preferences_data.session_length is not None:
            update_data['session_length'] = preferences_data.session_length
        if preferences_data.notification_settings is not None:
            # Get current settings and update only provided fields
            current_prefs = await UserPreferencesCRUD.get_preferences_by_user_id(db, user_id)
            if current_prefs:
                current_settings = current_prefs.notification_settings.copy()
                for key, value in preferences_data.notification_settings.dict(exclude_unset=True).items():
                    if value is not None:
                        current_settings[key] = value
                update_data['notification_settings'] = current_settings

        # Execute update
        await db.execute(
            update(UserPreferences)
            .where(UserPreferences.user_id == user_id)
            .values(**update_data)
        )
        await db.commit()

        # Return updated preferences
        return await UserPreferencesCRUD.get_preferences_by_user_id(db, user_id)

    @staticmethod
    async def update_quiz_settings(
            db: AsyncSession,
            user_id: int,
            quiz_settings: QuizSettingsUpdate
    ) -> Optional[UserPreferences]:
        """Update quiz-specific settings"""
        await db.execute(
            update(UserPreferences)
            .where(UserPreferences.user_id == user_id)
            .values(
                quiz_word_count=quiz_settings.quiz_word_count,
                updated_at=datetime.utcnow()
            )
        )
        await db.commit()
        return await UserPreferencesCRUD.get_preferences_by_user_id(db, user_id)

    @staticmethod
    async def update_practice_settings(
            db: AsyncSession,
            user_id: int,
            practice_settings: PracticeSettingsUpdate
    ) -> Optional[UserPreferences]:
        """Update practice-specific settings"""
        await db.execute(
            update(UserPreferences)
            .where(UserPreferences.user_id == user_id)
            .values(
                practice_word_count=practice_settings.practice_word_count,
                updated_at=datetime.utcnow()
            )
        )
        await db.commit()
        return await UserPreferencesCRUD.get_preferences_by_user_id(db, user_id)

    @staticmethod
    async def update_learning_settings(
            db: AsyncSession,
            user_id: int,
            learning_settings: LearningSettingsUpdate
    ) -> Optional[UserPreferences]:
        """Update learning-specific settings"""
        update_data = {'updated_at': datetime.utcnow()}

        if learning_settings.daily_goal is not None:
            update_data['daily_goal'] = learning_settings.daily_goal
        if learning_settings.session_length is not None:
            update_data['session_length'] = learning_settings.session_length

        await db.execute(
            update(UserPreferences)
            .where(UserPreferences.user_id == user_id)
            .values(**update_data)
        )
        await db.commit()
        return await UserPreferencesCRUD.get_preferences_by_user_id(db, user_id)

    # Remove interface language update method - language preferences handled elsewhere

    @staticmethod
    async def update_notification_settings(
            db: AsyncSession,
            user_id: int,
            notification_settings: NotificationSettingsUpdate
    ) -> Optional[UserPreferences]:
        """Update notification settings"""
        # Get current settings
        current_prefs = await UserPreferencesCRUD.get_preferences_by_user_id(db, user_id)
        if not current_prefs:
            return None

        # Update only provided fields
        current_settings = current_prefs.notification_settings.copy()
        for key, value in notification_settings.dict(exclude_unset=True).items():
            if value is not None:
                current_settings[key] = value

        await db.execute(
            update(UserPreferences)
            .where(UserPreferences.user_id == user_id)
            .values(
                notification_settings=current_settings,
                updated_at=datetime.utcnow()
            )
        )
        await db.commit()
        return await UserPreferencesCRUD.get_preferences_by_user_id(db, user_id)

    # ===== DELETE OPERATIONS =====

    @staticmethod
    async def delete_preferences(
            db: AsyncSession,
            user_id: int
    ) -> bool:
        """Delete user preferences"""
        result = await db.execute(
            delete(UserPreferences).where(UserPreferences.user_id == user_id)
        )
        await db.commit()
        return result.rowcount > 0

    @staticmethod
    async def reset_to_default(
            db: AsyncSession,
            user_id: int
    ) -> UserPreferences:
        """Reset user preferences to default values"""
        # Delete existing preferences
        await UserPreferencesCRUD.delete_preferences(db, user_id)

        # Create new default preferences
        return await UserPreferencesCRUD.create_default_preferences(db, user_id)

    # ===== BULK OPERATIONS =====

    @staticmethod
    async def get_all_preferences(
            db: AsyncSession,
            skip: int = 0,
            limit: int = 100
    ) -> List[UserPreferences]:
        """Get all user preferences with pagination"""
        result = await db.execute(
            select(UserPreferences)
            .options(joinedload(UserPreferences.user))
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    @staticmethod
    async def bulk_update_preferences(
            db: AsyncSession,
            user_ids: List[int],
            preferences_data: PreferencesUpdate
    ) -> Tuple[int, List[int]]:
        """Bulk update preferences for multiple users"""
        # Build update data
        update_data = {'updated_at': datetime.utcnow()}

        if preferences_data.quiz_word_count is not None:
            update_data['quiz_word_count'] = preferences_data.quiz_word_count
        if preferences_data.practice_word_count is not None:
            update_data['practice_word_count'] = preferences_data.practice_word_count
        if preferences_data.daily_goal is not None:
            update_data['daily_goal'] = preferences_data.daily_goal
        if preferences_data.session_length is not None:
            update_data['session_length'] = preferences_data.session_length

        # Execute bulk update
        result = await db.execute(
            update(UserPreferences)
            .where(UserPreferences.user_id.in_(user_ids))
            .values(**update_data)
        )
        await db.commit()

        # Return success count and failed user IDs
        success_count = result.rowcount
        failed_user_ids = []

        if success_count < len(user_ids):
            # Find which users failed
            successful_result = await db.execute(
                select(UserPreferences.user_id)
                .where(UserPreferences.user_id.in_(user_ids))
            )
            successful_user_ids = [row[0] for row in successful_result.all()]
            failed_user_ids = [uid for uid in user_ids if uid not in successful_user_ids]

        return success_count, failed_user_ids

    # ===== STATISTICS OPERATIONS =====

    @staticmethod
    async def get_preferences_statistics(
            db: AsyncSession
    ) -> Dict[str, Any]:
        """Get preferences statistics"""
        # Total users with preferences
        total_result = await db.execute(
            select(func.count(UserPreferences.id))
        )
        total_count = total_result.scalar()

        if total_count == 0:
            return {
                'total_users_with_preferences': 0,
                'average_quiz_word_count': 0,
                'average_practice_word_count': 0,
                'average_daily_goal': 0,
                'average_session_length': 0,
                'most_common_interface_language': 'en',
                'language_distribution': {},
                'notification_settings_stats': {}
            }

        # Average values
        avg_result = await db.execute(
            select(
                func.avg(UserPreferences.quiz_word_count),
                func.avg(UserPreferences.practice_word_count),
                func.avg(UserPreferences.daily_goal),
                func.avg(UserPreferences.session_length)
            )
        )
        avg_quiz, avg_practice, avg_goal, avg_session = avg_result.first()

        # Language distribution
        lang_result = await db.execute(
            select(
                UserPreferences.interface_language,
                func.count(UserPreferences.id)
            )
            .group_by(UserPreferences.interface_language)
            .order_by(func.count(UserPreferences.id).desc())
        )
        lang_distribution = dict(lang_result.all())
        most_common_language = list(lang_distribution.keys())[0] if lang_distribution else 'en'

        return {
            'total_users_with_preferences': total_count,
            'average_quiz_word_count': round(avg_quiz, 2) if avg_quiz else 0,
            'average_practice_word_count': round(avg_practice, 2) if avg_practice else 0,
            'average_daily_goal': round(avg_goal, 2) if avg_goal else 0,
            'average_session_length': round(avg_session, 2) if avg_session else 0,
            'notification_settings_stats': {}  # Would need JSON aggregation for detailed stats
        }

    # Remove language-based utility methods - language preferences handled elsewhere

    @staticmethod
    async def get_users_with_notifications_enabled(
            db: AsyncSession,
            notification_type: str,
            skip: int = 0,
            limit: int = 100
    ) -> List[UserPreferences]:
        """Get users with specific notification type enabled"""
        # This would require JSON path queries - simplified for now
        result = await db.execute(
            select(UserPreferences)
            .options(joinedload(UserPreferences.user))
            .offset(skip)
            .limit(limit)
        )

        # Filter in Python (could be optimized with database JSON functions)
        all_prefs = result.scalars().all()
        filtered_prefs = [
            pref for pref in all_prefs
            if pref.notification_settings.get(notification_type, False)
        ]

        return filtered_prefs

    @staticmethod
    async def get_quiz_word_count_distribution(
            db: AsyncSession
    ) -> Dict[int, int]:
        """Get distribution of quiz word count preferences"""
        result = await db.execute(
            select(
                UserPreferences.quiz_word_count,
                func.count(UserPreferences.id)
            )
            .group_by(UserPreferences.quiz_word_count)
            .order_by(UserPreferences.quiz_word_count)
        )
        return dict(result.all())

    @staticmethod
    async def get_practice_word_count_distribution(
            db: AsyncSession
    ) -> Dict[int, int]:
        """Get distribution of pracice word count preferences"""
        result = await db.execute(
            select(
                UserPreferences.practice_word_count,
                func.count(UserPreferences.id)
            )
            .group_by(UserPreferences.practice_word_count)
            .order_by(UserPreferences.practice_word_count)
        )
        return dict(result.all())