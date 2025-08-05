# database/learning_schemas.py
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


# Enums for responses
class LearningStatusEnum(str, Enum):
    WANT_TO_LEARN = "want_to_learn"
    LEARNING = "learning"
    LEARNED = "learned"
    MASTERED = "mastered"
    REVIEW = "review"


class DifficultyRatingEnum(str, Enum):
    VERY_EASY = "very_easy"
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    VERY_HARD = "very_hard"


# Word Progress Schemas
class UserWordProgressBase(BaseModel):
    status: LearningStatusEnum = LearningStatusEnum.WANT_TO_LEARN
    difficulty_rating: Optional[DifficultyRatingEnum] = None
    user_notes: Optional[str] = None


class UserWordProgressCreate(UserWordProgressBase):
    kazakh_word_id: int


class UserWordProgressUpdate(BaseModel):
    status: Optional[LearningStatusEnum] = None
    difficulty_rating: Optional[DifficultyRatingEnum] = None
    user_notes: Optional[str] = None
    was_correct: Optional[bool] = None


class UserWordProgressResponse(UserWordProgressBase):
    id: int
    user_id: int
    kazakh_word_id: int
    times_seen: int
    times_correct: int
    times_incorrect: int
    added_at: datetime
    first_learned_at: Optional[datetime] = None
    last_practiced_at: Optional[datetime] = None
    next_review_at: Optional[datetime] = None
    repetition_interval: int
    ease_factor: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserWordProgressWithWord(UserWordProgressResponse):
    """Word progress with word details"""
    kazakh_word: Dict[str, Any]  # Will include word details

    class Config:
        from_attributes = True


# Learning Session Schemas
class UserLearningSessionCreate(BaseModel):
    session_type: str = Field(..., description="Type of session: practice, review, quiz, etc.")
    category_id: Optional[int] = None
    difficulty_level_id: Optional[int] = None


class UserLearningSessionResponse(BaseModel):
    id: int
    user_id: int
    session_type: str
    
    # UPDATED: Both fields available
    total_questions: int = 0        # Total questions asked in session
    words_studied: int = 0          # Words actually studied/practiced
    
    correct_answers: int = 0
    incorrect_answers: int = 0
    duration_seconds: Optional[int] = None
    category_id: Optional[int] = None
    difficulty_level_id: Optional[int] = None
    started_at: datetime
    finished_at: Optional[datetime] = None
    created_at: datetime

    @property
    def accuracy_rate(self) -> Optional[float]:
        """Calculate accuracy based on words_studied"""
        if self.words_studied > 0:
            return round((self.correct_answers / self.words_studied) * 100, 1)
        return None

    @property  
    def completion_rate(self) -> Optional[float]:
        """Calculate completion rate (words_studied vs total_questions)"""
        if self.total_questions > 0:
            return round((self.words_studied / self.total_questions) * 100, 1)
        return None

    class Config:
        from_attributes = True


# Session Detail Schemas
class UserSessionDetailCreate(BaseModel):
    kazakh_word_id: int
    was_correct: bool
    question_type: str
    user_answer: Optional[str] = None
    correct_answer: Optional[str] = None
    response_time_ms: Optional[int] = None
    question_language: Optional[str] = None
    answer_language: Optional[str] = None


class UserSessionDetailResponse(BaseModel):
    id: int
    session_id: int
    kazakh_word_id: int
    was_correct: bool
    response_time_ms: Optional[int] = None
    user_answer: Optional[str] = None
    correct_answer: Optional[str] = None
    question_type: Optional[str] = None
    question_language: Optional[str] = None
    answer_language: Optional[str] = None
    answered_at: datetime

    class Config:
        from_attributes = True


# Learning Goal Schemas
class UserLearningGoalCreate(BaseModel):
    goal_type: str = Field(..., description="Type of goal: daily_words, weekly_practice, etc.")
    target_value: int = Field(..., gt=0, description="Target number to achieve")
    target_date: Optional[datetime] = None
    category_id: Optional[int] = None
    difficulty_level_id: Optional[int] = None


class UserLearningGoalResponse(BaseModel):
    id: int
    user_id: int
    goal_type: str
    target_value: int
    current_value: int
    category_id: Optional[int] = None
    difficulty_level_id: Optional[int] = None
    is_active: bool
    is_completed: bool
    start_date: datetime
    target_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    progress_percentage: Optional[float] = None

    @property
    def progress_percentage(self) -> float:
        if self.target_value > 0:
            return min(100.0, round((self.current_value / self.target_value) * 100, 1))
        return 0.0

    class Config:
        from_attributes = True


# Achievement Schemas
class UserAchievementResponse(BaseModel):
    id: int
    user_id: int
    achievement_type: str
    achievement_name: str
    description: Optional[str] = None
    category_id: Optional[int] = None
    difficulty_level_id: Optional[int] = None
    value: Optional[int] = None
    earned_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


# Streak Schemas
class UserStreakResponse(BaseModel):
    id: int
    user_id: int
    streak_type: str
    current_streak: int
    longest_streak: int
    last_activity_date: Optional[datetime] = None
    streak_start_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Statistics Schemas
class LearningStatsResponse(BaseModel):
    total_words: int
    words_by_status: Dict[str, int]
    sessions_this_week: int
    accuracy_rate: float
    current_streak: int
    words_due_review: int
    total_correct: int
    total_seen: int


class CategoryProgressResponse(BaseModel):
    category_id: int
    category_name: str
    words_learning: int
    words_learned: int
    completion_rate: float


# Practice Schemas
class PracticeSessionRequest(BaseModel):
    session_type: str = "practice"
    word_count: int = Field(default=10, ge=1, le=50)
    category_id: Optional[int] = None
    difficulty_level_id: Optional[int] = None
    include_review: bool = True
    language_code: str = "en"


class PracticeWordItem(BaseModel):
    """Word item for practice sessions"""
    id: int
    kazakh_word: str
    kazakh_cyrillic: Optional[str] = None
    translation: str
    pronunciation: Optional[str] = None
    image_url: Optional[str] = None
    difficulty_level: int
    times_seen: int = 0
    last_practiced: Optional[datetime] = None
    is_review: bool = False
    learning_status: Optional[str] = None  # Add this field


class PracticeSessionResponse(BaseModel):
    session_id: int
    words: List[PracticeWordItem]
    session_type: str
    total_words: int


# Quiz Schemas
class QuizQuestionType(str, Enum):
    TRANSLATION = "translation"
    PRONUNCIATION = "pronunciation"
    MULTIPLE_CHOICE = "multiple_choice"
    LISTENING = "listening"
    SPELLING = "spelling"


class QuizQuestion(BaseModel):
    word_id: int
    question_type: QuizQuestionType
    question_text: str
    question_language: str
    answer_language: str
    options: Optional[List[str]] = None  # For multiple choice
    correct_answer: str


class QuizAnswer(BaseModel):
    word_id: int
    user_answer: str
    response_time_ms: Optional[int] = None


class QuizSubmission(BaseModel):
    session_id: int
    answers: List[QuizAnswer]


class QuizResult(BaseModel):
    session_id: int
    total_questions: int
    correct_answers: int
    accuracy_rate: float
    duration_seconds: Optional[int] = None
    words_results: List[Dict[str, Any]]


# Learning List Management
class AddWordsToListRequest(BaseModel):
    word_ids: List[int] = Field(..., min_items=1, max_items=50)
    status: LearningStatusEnum = LearningStatusEnum.WANT_TO_LEARN


class RemoveWordsFromListRequest(BaseModel):
    word_ids: List[int] = Field(..., min_items=1, max_items=50)


class LearningListFilters(BaseModel):
    status: Optional[LearningStatusEnum] = None
    category_id: Optional[int] = None
    difficulty_level_id: Optional[int] = None
    due_for_review: Optional[bool] = None
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


# Dashboard Schemas
class LearningDashboardResponse(BaseModel):
    """Main dashboard response with user's learning overview"""
    stats: LearningStatsResponse
    streak: Optional[UserStreakResponse] = None
    recent_sessions: List[UserLearningSessionResponse] = []
    active_goals: List[UserLearningGoalResponse] = []
    words_due_today: int
    category_progress: List[CategoryProgressResponse] = []
    recent_achievements: List[UserAchievementResponse] = []


# Spaced Repetition Schemas
class SpacedRepetitionSettings(BaseModel):
    """User's spaced repetition preferences"""
    daily_new_words: int = Field(default=10, ge=1, le=50)
    daily_review_words: int = Field(default=20, ge=10, le=100)
    auto_advance_learned: bool = True
    difficulty_factor: float = Field(default=1.0, ge=0.5, le=2.0)


class ReviewScheduleResponse(BaseModel):
    """Review schedule information"""
    due_now: int
    due_today: int
    due_this_week: int
    overdue: int
    next_review_date: Optional[datetime] = None