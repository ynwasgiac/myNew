# api/preferences_routes.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
from datetime import datetime

from database.connection import get_db
from database.user_preferences_crud import UserPreferencesCRUD
from database.user_preferences_schemas import (
    # Create schemas
    PreferencesCreate, NotificationSettingsCreate,

    # Update schemas
    PreferencesUpdate, NotificationSettingsUpdate, QuizSettingsUpdate,
    LearningSettingsUpdate,

    # Response schemas
    PreferencesResponse, PreferencesWithUserResponse, NotificationSettingsResponse,
    DefaultPreferencesResponse, PreferencesStatsResponse, PreferencesValidationResponse,
    PreferencesValidationError,

    # Bulk operation schemas
    BulkPreferencesUpdate, BulkPreferencesResponse,

    # Export/Import schemas
    PreferencesExport, PreferencesImport, PreferencesImportResponse
)
from database.auth_models import User
from auth.dependencies import get_current_user, get_current_admin

router = APIRouter(prefix="/api/preferences", tags=["User Preferences"])


# ===== CORE PREFERENCES ENDPOINTS =====

@router.get("/", response_model=PreferencesResponse)
async def get_user_preferences(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """
    Get current user's preferences.
    Creates default preferences if none exist.
    """
    try:
        preferences = await UserPreferencesCRUD.get_or_create_preferences(db, current_user.id)
        return PreferencesResponse.from_orm(preferences)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get preferences: {str(e)}"
        )


@router.get("/with-user", response_model=PreferencesWithUserResponse)
async def get_preferences_with_user_info(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Get user preferences with user information"""
    try:
        preferences = await UserPreferencesCRUD.get_preferences_with_user(db, current_user.id)
        if not preferences:
            # Create default and get with user info
            await UserPreferencesCRUD.create_default_preferences(db, current_user.id)
            preferences = await UserPreferencesCRUD.get_preferences_with_user(db, current_user.id)

        return PreferencesWithUserResponse.from_orm(preferences)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get preferences with user info: {str(e)}"
        )


@router.post("/", response_model=PreferencesResponse, status_code=status.HTTP_201_CREATED)
async def create_user_preferences(
        preferences_data: PreferencesCreate,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """
    Create user preferences.
    Raises error if preferences already exist.
    """
    try:
        # Check if preferences already exist
        existing_preferences = await UserPreferencesCRUD.preferences_exist(db, current_user.id)
        if existing_preferences:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User preferences already exist. Use PUT /api/preferences/ to update."
            )

        # Create new preferences
        new_preferences = await UserPreferencesCRUD.create_preferences(
            db, current_user.id, preferences_data
        )

        return PreferencesResponse.from_orm(new_preferences)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create preferences: {str(e)}"
        )


@router.put("/", response_model=PreferencesResponse)
async def update_user_preferences(
        preferences_data: PreferencesUpdate,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """
    Update user preferences.
    Creates default preferences if none exist, then updates them.
    """
    try:
        # Ensure preferences exist
        await UserPreferencesCRUD.get_or_create_preferences(db, current_user.id)

        # Update preferences
        updated_preferences = await UserPreferencesCRUD.update_preferences(
            db, current_user.id, preferences_data
        )

        if not updated_preferences:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Failed to update preferences"
            )

        return PreferencesResponse.from_orm(updated_preferences)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update preferences: {str(e)}"
        )


# ===== PARTIAL UPDATE ENDPOINTS =====

@router.patch("/quiz-settings", response_model=PreferencesResponse)
async def update_quiz_settings(
        quiz_settings: QuizSettingsUpdate,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Update quiz-specific settings"""
    try:
        # Ensure preferences exist
        await UserPreferencesCRUD.get_or_create_preferences(db, current_user.id)

        # Update quiz settings
        updated_preferences = await UserPreferencesCRUD.update_quiz_settings(
            db, current_user.id, quiz_settings
        )

        if not updated_preferences:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Failed to update quiz settings"
            )

        return PreferencesResponse.from_orm(updated_preferences)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update quiz settings: {str(e)}"
        )


@router.patch("/learning-settings", response_model=PreferencesResponse)
async def update_learning_settings(
        learning_settings: LearningSettingsUpdate,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Update learning-specific settings"""
    try:
        # Ensure preferences exist
        await UserPreferencesCRUD.get_or_create_preferences(db, current_user.id)

        # Update learning settings
        updated_preferences = await UserPreferencesCRUD.update_learning_settings(
            db, current_user.id, learning_settings
        )

        if not updated_preferences:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Failed to update learning settings"
            )

        return PreferencesResponse.from_orm(updated_preferences)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update learning settings: {str(e)}"
        )


@router.patch("/notifications", response_model=PreferencesResponse)
async def update_notification_settings(
        notification_settings: NotificationSettingsUpdate,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Update notification preferences"""
    try:
        # Ensure preferences exist
        await UserPreferencesCRUD.get_or_create_preferences(db, current_user.id)

        # Update notification settings
        updated_preferences = await UserPreferencesCRUD.update_notification_settings(
            db, current_user.id, notification_settings
        )

        if not updated_preferences:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Failed to update notification settings"
            )

        return PreferencesResponse.from_orm(updated_preferences)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update notification settings: {str(e)}"
        )


# ===== DELETE AND RESET ENDPOINTS =====

@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_preferences(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """
    Delete user preferences.
    This will reset preferences to default on next access.
    """
    try:
        deleted = await UserPreferencesCRUD.delete_preferences(db, current_user.id)

        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User preferences not found"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete preferences: {str(e)}"
        )


@router.post("/reset-to-default", response_model=PreferencesResponse)
async def reset_preferences_to_default(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Reset user preferences to default values"""
    try:
        # Reset to default
        new_preferences = await UserPreferencesCRUD.reset_to_default(db, current_user.id)
        return PreferencesResponse.from_orm(new_preferences)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset preferences: {str(e)}"
        )


# ===== UTILITY ENDPOINTS =====

@router.get("/default-values", response_model=DefaultPreferencesResponse)
async def get_default_preferences():
    """Get default preference values"""
    try:
        return DefaultPreferencesResponse(
            quiz_word_count=5,
            daily_goal=10,
            session_length=10,
            notification_settings=NotificationSettingsCreate()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get default preferences: {str(e)}"
        )


@router.get("/exists")
async def check_preferences_exist(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Check if user has preferences set"""
    try:
        exists = await UserPreferencesCRUD.preferences_exist(db, current_user.id)
        return {"preferences_exist": exists}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check preferences existence: {str(e)}"
        )


# ===== ADMIN ENDPOINTS =====

@router.get("/admin/all", response_model=List[PreferencesWithUserResponse])
async def get_all_preferences_admin(
        skip: int = Query(0, ge=0, description="Number of records to skip"),
        limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
        current_user: User = Depends(get_current_admin),
        db: AsyncSession = Depends(get_db)
):
    """Get all user preferences (admin only)"""
    try:
        preferences_list = await UserPreferencesCRUD.get_all_preferences(db, skip, limit)
        return [PreferencesWithUserResponse.from_orm(prefs) for prefs in preferences_list]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get all preferences: {str(e)}"
        )


@router.get("/admin/statistics", response_model=PreferencesStatsResponse)
async def get_preferences_statistics(
        current_user: User = Depends(get_current_admin),
        db: AsyncSession = Depends(get_db)
):
    """Get preferences statistics (admin only)"""
    try:
        stats = await UserPreferencesCRUD.get_preferences_statistics(db)
        return PreferencesStatsResponse(**stats)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get preferences statistics: {str(e)}"
        )


@router.post("/admin/bulk-update", response_model=BulkPreferencesResponse)
async def bulk_update_preferences(
        bulk_update: BulkPreferencesUpdate,
        current_user: User = Depends(get_current_admin),
        db: AsyncSession = Depends(get_db)
):
    """Bulk update preferences for multiple users (admin only)"""
    try:
        success_count, failed_users = await UserPreferencesCRUD.bulk_update_preferences(
            db, bulk_update.user_ids, bulk_update.preferences_update
        )

        return BulkPreferencesResponse(
            success_count=success_count,
            failed_count=len(failed_users),
            failed_users=failed_users
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk update preferences: {str(e)}"
        )


@router.get("/admin/quiz-distribution")
async def get_quiz_word_count_distribution(
        current_user: User = Depends(get_current_admin),
        db: AsyncSession = Depends(get_db)
):
    """Get distribution of quiz word count preferences (admin only)"""
    try:
        distribution = await UserPreferencesCRUD.get_quiz_word_count_distribution(db)
        return {"quiz_word_count_distribution": distribution}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get quiz distribution: {str(e)}"
        )


@router.get("/admin/notification-users")
async def get_users_with_notifications(
        notification_type: str = Query(..., description="Type of notification"),
        skip: int = Query(0, ge=0),
        limit: int = Query(100, ge=1, le=1000),
        current_user: User = Depends(get_current_admin),
        db: AsyncSession = Depends(get_db)
):
    """Get users with specific notification type enabled (admin only)"""
    try:
        users = await UserPreferencesCRUD.get_users_with_notifications_enabled(
            db, notification_type, skip, limit
        )
        return {
            "notification_type": notification_type,
            "total_users": len(users),
            "users": [PreferencesWithUserResponse.from_orm(user) for user in users]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get users with notifications: {str(e)}"
        )

# ===== HEALTH CHECK ENDPOINT =====

@router.get("/health")
async def preferences_health_check(
        db: AsyncSession = Depends(get_db)
):
    """Health check for preferences system"""
    try:
        # Test database connection by getting count
        from sqlalchemy import select, func
        from database.user_preferences_models import UserPreferences

        result = await db.execute(select(func.count(UserPreferences.id)))
        total_preferences = result.scalar()

        return {
            "status": "healthy",
            "total_preferences": total_preferences,
            "timestamp": datetime.utcnow(),
            "message": "Preferences system operational"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Preferences system unhealthy: {str(e)}"
        )