from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from database.auth_models import User
from database.learning_schemas import (
    UserPreferencesResponse, 
    UserPreferencesUpdate,
    UserPreferencesCreate
)
from database.user_preferences_crud import UserPreferencesCRUD
from auth.routes import get_current_user

router = APIRouter(prefix="/user/preferences", tags=["User Preferences"])

@router.get("/", response_model=UserPreferencesResponse)
async def get_user_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's preferences"""
    preferences = await UserPreferencesCRUD.get_or_create_preferences(db, current_user.id)
    return preferences

@router.patch("/", response_model=UserPreferencesResponse)
async def update_user_preferences(
    preferences_update: UserPreferencesUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update user preferences"""
    preferences = await UserPreferencesCRUD.update_user_preferences(
        db, current_user.id, preferences_update
    )
    
    if not preferences:
        raise HTTPException(status_code=404, detail="Preferences not found")
    
    return preferences

@router.get("/quiz", response_model=dict)
async def get_quiz_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get quiz-specific preferences"""
    preferences = await UserPreferencesCRUD.get_or_create_preferences(db, current_user.id)
    return {"quiz_word_count": preferences.quiz_word_count}

@router.patch("/quiz", response_model=dict)
async def update_quiz_preferences(
    quiz_word_count: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update quiz word count preference"""
    if not (1 <= quiz_word_count <= 50):
        raise HTTPException(
            status_code=400, 
            detail="Quiz word count must be between 1 and 50"
        )
    
    preferences_update = UserPreferencesUpdate(quiz_word_count=quiz_word_count)
    preferences = await UserPreferencesCRUD.update_user_preferences(
        db, current_user.id, preferences_update
    )
    
    return {"quiz_word_count": preferences.quiz_word_count}