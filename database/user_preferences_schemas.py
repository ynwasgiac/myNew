# database/preferences_schemas.py
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime


class NotificationSettingsBase(BaseModel):
    """Base notification settings schema"""
    daily_reminders: bool = True
    review_reminders: bool = True
    achievement_notifications: bool = True
    streak_reminders: bool = True
    goal_reminders: bool = True


class PreferencesBase(BaseModel):
    """Base preferences schema"""
    quiz_word_count: int = Field(default=5, ge=1, le=50, description="Number of words in quiz (1-50)")
    practice_word_count: int = Field(default=5, ge=1, le=50, description="Number of words in practice (1-50)")
    daily_goal: int = Field(default=10, ge=1, le=100, description="Daily learning goal (1-100)")
    session_length: int = Field(default=10, ge=5, le=60, description="Session length in minutes (5-60)")
    notification_settings: NotificationSettingsBase = Field(default_factory=NotificationSettingsBase)

    @validator('quiz_word_count')
    def validate_quiz_word_count(cls, v):
        if not isinstance(v, int) or not (1 <= v <= 50):
            raise ValueError('Quiz word count must be between 1 and 50')
        return v

    @validator('practice_word_count')
    def validate_practice_word_count(cls, v):
        if not isinstance(v, int) or not (1 <= v <= 50):
            raise ValueError('Peactice word count must be between 1 and 50')
        return v

    @validator('daily_goal')
    def validate_daily_goal(cls, v):
        if not isinstance(v, int) or not (1 <= v <= 100):
            raise ValueError('Daily goal must be between 1 and 100')
        return v

    @validator('session_length')
    def validate_session_length(cls, v):
        if not isinstance(v, int) or not (5 <= v <= 60):
            raise ValueError('Session length must be between 5 and 60 minutes')
        return v


# ===== CREATE SCHEMAS =====

class NotificationSettingsCreate(NotificationSettingsBase):
    """Schema for creating notification settings"""
    pass


class PreferencesCreate(PreferencesBase):
    """Schema for creating user preferences"""
    pass


# ===== UPDATE SCHEMAS =====

class NotificationSettingsUpdate(BaseModel):
    """Schema for updating notification settings"""
    daily_reminders: Optional[bool] = None
    review_reminders: Optional[bool] = None
    achievement_notifications: Optional[bool] = None
    streak_reminders: Optional[bool] = None
    goal_reminders: Optional[bool] = None


class PreferencesUpdate(BaseModel):
    """Schema for updating user preferences"""
    practice_word_count: Optional[int] = Field(None, ge=1, le=50, description="Number of words in quiz (1-50)")
    quiz_word_count: Optional[int] = Field(None, ge=1, le=50, description="Number of words in quiz (1-50)")
    daily_goal: Optional[int] = Field(None, ge=1, le=100, description="Daily learning goal (1-100)")
    session_length: Optional[int] = Field(None, ge=5, le=60, description="Session length in minutes (5-60)")
    notification_settings: Optional[NotificationSettingsUpdate] = None

    @validator('quiz_word_count')
    def validate_quiz_word_count(cls, v):
        if v is not None and (not isinstance(v, int) or not (1 <= v <= 50)):
            raise ValueError('Quiz word count must be between 1 and 50')
        return v

    @validator('practice_word_count')
    def validate_practice_word_count(cls, v):
        if v is not None and (not isinstance(v, int) or not (1 <= v <= 50)):
            raise ValueError('Practice word count must be between 1 and 50')
        return v

    @validator('daily_goal')
    def validate_daily_goal(cls, v):
        if v is not None and (not isinstance(v, int) or not (1 <= v <= 100)):
            raise ValueError('Daily goal must be between 1 and 100')
        return v

    @validator('session_length')
    def validate_session_length(cls, v):
        if v is not None and (not isinstance(v, int) or not (5 <= v <= 60)):
            raise ValueError('Session length must be between 5 and 60 minutes')
        return v


# ===== PARTIAL UPDATE SCHEMAS =====

class QuizSettingsUpdate(BaseModel):
    """Schema for updating quiz-specific settings"""
    quiz_word_count: int = Field(..., ge=1, le=50, description="Number of words in quiz")

class PracticeSettingsUpdate(BaseModel):
    """Schema for updating practice-specific settings"""
    practice_word_count: int = Field(..., ge=1, le=50, description="Number of words in practice")


class LearningSettingsUpdate(BaseModel):
    """Schema for updating learning-specific settings"""
    daily_goal: Optional[int] = Field(None, ge=1, le=100, description="Daily learning goal")
    session_length: Optional[int] = Field(None, ge=5, le=60, description="Session length in minutes")


# ===== RESPONSE SCHEMAS =====

class NotificationSettingsResponse(NotificationSettingsBase):
    """Response schema for notification settings"""

    class Config:
        from_attributes = True


class PreferencesResponse(BaseModel):
    """Response schema for user preferences"""
    id: int
    user_id: int
    quiz_word_count: int
    practice_word_count: int
    daily_goal: int
    session_length: int
    notification_settings: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PreferencesWithUserResponse(PreferencesResponse):
    """Response schema for preferences with user info"""
    user: Dict[str, Any]


# ===== UTILITY SCHEMAS =====

# Language-related schemas removed - language preferences handled elsewhere

class DefaultPreferencesResponse(BaseModel):
    """Response schema for default preferences"""
    quiz_word_count: int
    practice_word_count: int
    daily_goal: int
    session_length: int
    notification_settings: NotificationSettingsBase


class PreferencesValidationError(BaseModel):
    """Schema for validation errors"""
    field: str
    error: str


class PreferencesValidationResponse(BaseModel):
    """Response schema for validation results"""
    is_valid: bool
    errors: List[PreferencesValidationError] = []


# ===== BULK OPERATIONS SCHEMAS =====

class BulkPreferencesUpdate(BaseModel):
    """Schema for bulk updating multiple users' preferences"""
    user_ids: List[int]
    preferences_update: PreferencesUpdate


class BulkPreferencesResponse(BaseModel):
    """Response schema for bulk operations"""
    success_count: int
    failed_count: int
    failed_users: List[int] = []
    errors: List[str] = []


# ===== STATISTICS SCHEMAS =====

class PreferencesStatsResponse(BaseModel):
    """Response schema for preferences statistics"""
    total_users_with_preferences: int
    average_quiz_word_count: float
    average_practice_word_count: float
    average_daily_goal: float
    average_session_length: float
    notification_settings_stats: Dict[str, Dict[str, int]]


class UserPreferencesHistory(BaseModel):
    """Schema for user preferences change history"""
    change_date: datetime
    field_changed: str
    old_value: Any
    new_value: Any


class PreferencesHistoryResponse(BaseModel):
    """Response schema for preferences history"""
    user_id: int
    changes: List[UserPreferencesHistory]


# ===== EXPORT/IMPORT SCHEMAS =====

class PreferencesExport(BaseModel):
    """Schema for exporting preferences"""
    user_id: int
    username: str
    preferences: PreferencesResponse


class PreferencesImport(BaseModel):
    """Schema for importing preferences"""
    user_id: int
    preferences: PreferencesCreate
    overwrite_existing: bool = False


class PreferencesImportResponse(BaseModel):
    """Response schema for import operations"""
    imported_count: int
    skipped_count: int
    error_count: int
    errors: List[str] = []
