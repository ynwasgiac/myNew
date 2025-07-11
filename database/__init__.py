# database/__init__.py
"""
Kazakh Language Learning Database Package

This package contains all database models, CRUD operations, and schemas
for the Kazakh language learning application with user authentication
and learning progress tracking.
"""

# Core database components
from .connection import engine, AsyncSessionLocal, get_db, Base

# === MODELS ===

# Authentication models
from .auth_models import User, UserSession, UserRole

# Core language learning models
from .models import (
    Language, Category, CategoryTranslation,
    WordType, WordTypeTranslation,
    DifficultyLevel, DifficultyLevelTranslation,
    KazakhWord, Pronunciation, Translation,
    WordImage, ExampleSentence, ExampleSentenceTranslation
)

# Learning progress models
from .learning_models import (
    LearningStatus, DifficultyRating,
    UserWordProgress, UserLearningSession, UserSessionDetail,
    UserLearningGoal, UserAchievement, UserStreak
)

# === CRUD OPERATIONS ===

# Authentication CRUD
from .auth_crud import UserCRUD, UserSessionCRUD

# Core language learning CRUD
from .crud import (
    LanguageCRUD, CategoryCRUD, WordTypeCRUD, DifficultyLevelCRUD,
    KazakhWordCRUD, TranslationCRUD, PronunciationCRUD,
    WordImageCRUD, ExampleSentenceCRUD
)

# Learning progress CRUD
from .learning_crud import (
    UserWordProgressCRUD, UserLearningSessionCRUD,
    UserLearningGoalCRUD, UserStreakCRUD, UserLearningStatsCRUD
)

# === SCHEMAS ===

# Authentication schemas
from .auth_schemas import (
    UserCreate, UserLogin, UserUpdate, UserResponse,
    Token, TokenData, PasswordChange, UserRoleEnum
)

# Core language learning schemas
from .schemas import (
    # Language schemas
    LanguageResponse,

    # Category schemas
    CategoryResponse, CategoryTranslationResponse,

    # Word type schemas
    WordTypeResponse, WordTypeTranslationResponse,

    # Difficulty level schemas
    DifficultyLevelResponse, DifficultyLevelTranslationResponse,

    # Word schemas
    KazakhWordCreate, KazakhWordResponse, KazakhWordSimpleResponse,
    KazakhWordSummary, WordSearchParams, WordSearchResponse,

    # Translation and pronunciation schemas
    TranslationResponse, PronunciationResponse,

    # Image and example schemas
    WordImageResponse, ExampleSentenceResponse, ExampleSentenceTranslationResponse,

    # Practice schemas
    PracticeWordRequest, PracticeWordResponse,

    # Statistics schemas
    CategoryStats, DifficultyStats, DatabaseStats
)

# Learning progress schemas
from .learning_schemas import (
    # Enums
    LearningStatusEnum, DifficultyRatingEnum,

    # Word progress schemas
    UserWordProgressCreate, UserWordProgressUpdate,
    UserWordProgressResponse, UserWordProgressWithWord,

    # Session schemas
    UserLearningSessionCreate, UserLearningSessionResponse,
    UserSessionDetailCreate, UserSessionDetailResponse,

    # Goal schemas
    UserLearningGoalCreate, UserLearningGoalResponse,

    # Achievement and streak schemas
    UserAchievementResponse, UserStreakResponse,

    # Statistics schemas
    LearningStatsResponse, CategoryProgressResponse,

    # Practice and quiz schemas
    PracticeSessionRequest, PracticeWordItem, PracticeSessionResponse,
    QuizQuestionType, QuizQuestion, QuizAnswer, QuizSubmission, QuizResult,

    # Management schemas
    AddWordsToListRequest, RemoveWordsFromListRequest, LearningListFilters,

    # Dashboard schemas
    LearningDashboardResponse, SpacedRepetitionSettings, ReviewScheduleResponse
)


# === DATABASE FUNCTIONS ===

async def create_tables():
    """Create all database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_tables():
    """Drop all database tables (use with caution!)"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def init_database():
    """Initialize database with all tables"""
    await create_tables()
    print("✅ Kazakh Language Learning Database initialized successfully!")
    print("📚 Language learning tables created")
    print("🔐 Authentication tables created")
    print("📊 Learning progress tables created")


async def seed_database():
    """Seed database with initial data"""
    from .seed_data import DatabaseSeeder

    async with AsyncSessionLocal() as db:
        await DatabaseSeeder.seed_all(db)
        print("🌱 Database seeded with initial data!")


async def migrate_learning_features():
    """Add learning progress features to existing database"""
    from .migrate_learning import run_migration

    success = await run_migration()
    if success:
        print("✅ Learning features migration completed!")
    else:
        print("❌ Learning features migration failed!")

    return success


# === VERSION INFO ===
__version__ = "1.0.0"
__author__ = "Kazakh Language Learning Team"
__description__ = "Database package for Kazakh language learning application"

# === EXPORTS ===
__all__ = [
    # === CORE DATABASE ===
    "engine",
    "AsyncSessionLocal",
    "get_db",
    "Base",

    # === AUTH MODELS ===
    "User",
    "UserSession",
    "UserRole",

    # === LANGUAGE LEARNING MODELS ===
    "Language",
    "Category",
    "CategoryTranslation",
    "WordType",
    "WordTypeTranslation",
    "DifficultyLevel",
    "DifficultyLevelTranslation",
    "KazakhWord",
    "Pronunciation",
    "Translation",
    "WordImage",
    "ExampleSentence",
    "ExampleSentenceTranslation",

    # === LEARNING PROGRESS MODELS ===
    "LearningStatus",
    "DifficultyRating",
    "UserWordProgress",
    "UserLearningSession",
    "UserSessionDetail",
    "UserLearningGoal",
    "UserAchievement",
    "UserStreak",

    # === AUTH CRUD ===
    "UserCRUD",
    "UserSessionCRUD",

    # === LANGUAGE LEARNING CRUD ===
    "LanguageCRUD",
    "CategoryCRUD",
    "WordTypeCRUD",
    "DifficultyLevelCRUD",
    "KazakhWordCRUD",
    "TranslationCRUD",
    "PronunciationCRUD",
    "WordImageCRUD",
    "ExampleSentenceCRUD",

    # === LEARNING PROGRESS CRUD ===
    "UserWordProgressCRUD",
    "UserLearningSessionCRUD",
    "UserLearningGoalCRUD",
    "UserStreakCRUD",
    "UserLearningStatsCRUD",

    # === AUTH SCHEMAS ===
    "UserCreate",
    "UserLogin",
    "UserUpdate",
    "UserResponse",
    "Token",
    "TokenData",
    "PasswordChange",
    "UserRoleEnum",

    # === LANGUAGE LEARNING SCHEMAS ===
    "LanguageResponse",
    "CategoryResponse",
    "CategoryTranslationResponse",
    "WordTypeResponse",
    "WordTypeTranslationResponse",
    "DifficultyLevelResponse",
    "DifficultyLevelTranslationResponse",
    "KazakhWordCreate",
    "KazakhWordResponse",
    "KazakhWordSimpleResponse",
    "KazakhWordSummary",
    "WordSearchParams",
    "WordSearchResponse",
    "TranslationResponse",
    "PronunciationResponse",
    "WordImageResponse",
    "ExampleSentenceResponse",
    "ExampleSentenceTranslationResponse",
    "PracticeWordRequest",
    "PracticeWordResponse",
    "CategoryStats",
    "DifficultyStats",
    "DatabaseStats",

    # === LEARNING PROGRESS SCHEMAS ===
    "LearningStatusEnum",
    "DifficultyRatingEnum",
    "UserWordProgressCreate",
    "UserWordProgressUpdate",
    "UserWordProgressResponse",
    "UserWordProgressWithWord",
    "UserLearningSessionCreate",
    "UserLearningSessionResponse",
    "UserSessionDetailCreate",
    "UserSessionDetailResponse",
    "UserLearningGoalCreate",
    "UserLearningGoalResponse",
    "UserAchievementResponse",
    "UserStreakResponse",
    "LearningStatsResponse",
    "CategoryProgressResponse",
    "PracticeSessionRequest",
    "PracticeWordItem",
    "PracticeSessionResponse",
    "QuizQuestionType",
    "QuizQuestion",
    "QuizAnswer",
    "QuizSubmission",
    "QuizResult",
    "AddWordsToListRequest",
    "RemoveWordsFromListRequest",
    "LearningListFilters",
    "LearningDashboardResponse",
    "SpacedRepetitionSettings",
    "ReviewScheduleResponse",

    # === DATABASE FUNCTIONS ===
    "create_tables",
    "drop_tables",
    "init_database",
    "seed_database",
    "migrate_learning_features",

    # === METADATA ===
    "__version__",
    "__author__",
    "__description__"
]

# === MODULE DOCUMENTATION ===
"""
Usage Examples:

1. Initialize database:
    ```python
    from database import init_database
    await init_database()
    ```

2. Seed with initial data:
    ```python
    from database import seed_database
    await seed_database()
    ```

3. Get database session:
    ```python
    from database import get_db
    from fastapi import Depends

    async def my_endpoint(db: AsyncSession = Depends(get_db)):
        # Use db session
        pass
    ```

4. Use CRUD operations:
    ```python
    from database import KazakhWordCRUD, UserWordProgressCRUD

    # Get words
    words = await KazakhWordCRUD.get_all_paginated(db, skip=0, limit=20)

    # Track user progress
    progress = await UserWordProgressCRUD.add_word_to_learning_list(
        db, user_id=1, word_id=5
    )
    ```

5. Learning progress tracking:
    ```python
    from database import UserLearningStatsCRUD, LearningStatus

    # Get user statistics
    stats = await UserLearningStatsCRUD.get_user_learning_stats(db, user_id=1)

    # Update word progress
    await UserWordProgressCRUD.update_word_progress(
        db, user_id=1, word_id=5, was_correct=True, 
        status=LearningStatus.LEARNED
    )
    ```

6. Migration for existing databases:
    ```python
    from database import migrate_learning_features
    success = await migrate_learning_features()
    ```

Database Structure:
- 🔐 Authentication: users, user_sessions
- 📚 Language Learning: languages, categories, word_types, difficulty_levels, 
      kazakh_words, translations, pronunciations, word_images, example_sentences
- 📊 Learning Progress: user_word_progress, user_learning_sessions, 
      user_session_details, user_learning_goals, user_achievements, user_streaks
"""