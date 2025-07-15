# database/learning_models.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Enum, UniqueConstraint, Index, \
    Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .connection import Base


class LearningStatus(enum.Enum):
    """Status of word learning progress"""
    WANT_TO_LEARN = "want_to_learn"  # User added to learning list
    LEARNING = "learning"  # User is actively learning
    LEARNED = "learned"  # User has learned the word
    MASTERED = "mastered"  # User has mastered the word
    REVIEW = "review"  # Needs review/practice


class DifficultyRating(enum.Enum):
    """User's difficulty rating for a word"""
    VERY_EASY = "very_easy"
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    VERY_HARD = "very_hard"

class GuideStatus(enum.Enum):
    """Статус прохождения путеводителя"""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

class WordSource(enum.Enum):
    """Источник слова в практике"""
    LEARNING_LIST = "learning_list"  # Из списка изучения
    RANDOM = "random"  # Случайное слово
    GUIDE = "guide"  # Из путеводителя


class UserWordProgress(Base):
    """Track user's progress with individual words"""
    __tablename__ = "user_word_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    kazakh_word_id = Column(Integer, ForeignKey("kazakh_words.id", ondelete="CASCADE"), nullable=False)

    # Learning status
    status = Column(Enum(LearningStatus), default=LearningStatus.WANT_TO_LEARN, nullable=False)

    # Progress tracking
    times_seen = Column(Integer, default=0)
    times_correct = Column(Integer, default=0)
    times_incorrect = Column(Integer, default=0)

    # User ratings
    difficulty_rating = Column(Enum(DifficultyRating), nullable=True)

    # Избранное - ДОБАВЛЕНО
    is_favorite = Column(Boolean, default=False)
    user_notes = Column(Text, nullable=True)

    # Important dates
    added_at = Column(DateTime, default=datetime.utcnow)
    first_learned_at = Column(DateTime, nullable=True)
    last_practiced_at = Column(DateTime, nullable=True)
    next_review_at = Column(DateTime, nullable=True)
    marked_favorite_at = Column(DateTime, nullable=True)

    # Spaced repetition data
    repetition_interval = Column(Integer, default=1)
    ease_factor = Column(Float, default=2.5)
    consecutive_correct = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships - ИСПРАВЛЕНО
    user = relationship("User", back_populates="word_progress")
    kazakh_word = relationship("KazakhWord")

    __table_args__ = (
        UniqueConstraint('user_id', 'kazakh_word_id', name='unique_user_word'),
        Index('idx_user_word_progress_user', 'user_id'),
        Index('idx_user_word_progress_word', 'kazakh_word_id'),
        Index('idx_user_word_progress_status', 'status'),
        Index('idx_user_word_progress_next_review', 'next_review_at'),
        Index('idx_user_word_progress_favorite', 'user_id', 'is_favorite'),
    )


class UserLearningSession(Base):
    """Track user's learning sessions"""
    __tablename__ = "user_learning_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Session info
    session_type = Column(String(50), nullable=False)

    # Источник слов - ДОБАВЛЕНО
    word_source = Column(String(20), default="learning_list")  # learning_list, random, guide
    guide_id = Column(Integer, nullable=True)  # Ссылка на путеводитель

    # Session stats
    total_questions = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    learning_words_count = Column(Integer, default=0)  # ДОБАВЛЕНО
    random_words_count = Column(Integer, default=0)  # ДОБАВЛЕНО

    # Session timing
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)

    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    difficulty_level_id = Column(Integer, ForeignKey("difficulty_levels.id"), nullable=True)

    # Relationships - ИСПРАВЛЕНО
    user = relationship("User", back_populates="learning_sessions")
    session_details = relationship("UserSessionDetail", back_populates="session", cascade="all, delete-orphan")

    # Add these relationships
    category = relationship("Category", foreign_keys=[category_id])
    difficulty_level = relationship("DifficultyLevel", foreign_keys=[difficulty_level_id])
                                    
    __table_args__ = (
        Index('idx_learning_sessions_user', 'user_id'),
        Index('idx_learning_sessions_started', 'started_at'),
        Index('idx_learning_sessions_type', 'session_type'),
    )

# НОВАЯ модель: Путеводители
class LearningGuide(Base):
    """Тематические путеводители для изучения"""
    __tablename__ = "learning_guides"

    id = Column(Integer, primary_key=True, index=True)
    
    # Основная информация
    guide_key = Column(String(50), unique=True, nullable=False)  # greetings, family, etc.
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    icon_name = Column(String(50), nullable=True)  # Название иконки
    color = Column(String(20), nullable=True)  # Цвет темы
    
    # Метаданные
    difficulty_level = Column(String(20), nullable=False)  # beginner, intermediate, advanced
    estimated_minutes = Column(Integer, nullable=True)  # Примерное время изучения
    target_word_count = Column(Integer, default=20)  # Целевое количество слов
    
    # Поисковые данные
    keywords = Column(JSON, nullable=True)  # Ключевые слова для поиска
    topics = Column(JSON, nullable=True)  # Связанные темы
    
    # Управление
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    
    # Даты
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Связи
    user_progress = relationship("UserGuideProgress", back_populates="guide")

# НОВАЯ модель: Прогресс по путеводителям
class UserGuideProgress(Base):
    """Прогресс пользователя по путеводителям"""
    __tablename__ = "user_guide_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    guide_id = Column(Integer, ForeignKey("learning_guides.id", ondelete="CASCADE"), nullable=False)
    
    # Статус прохождения
    status = Column(Enum(GuideStatus), default=GuideStatus.NOT_STARTED, nullable=False)
    
    # Прогресс
    words_completed = Column(Integer, default=0)  # Количество изученных слов
    total_words_added = Column(Integer, default=0)  # Всего слов добавлено из путеводителя
    
    # Даты
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    last_accessed_at = Column(DateTime, nullable=True)
    
    # Метаданные
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Связи
    user = relationship("User")
    guide = relationship("LearningGuide", back_populates="user_progress")

    # Ограничения
    __table_args__ = (
        UniqueConstraint('user_id', 'guide_id', name='unique_user_guide'),
        Index('idx_user_guide_status', 'user_id', 'status'),
    )

# НОВАЯ модель: Связь слов с путеводителями
class GuideWordMapping(Base):
    """Связь слов с путеводителями"""
    __tablename__ = "guide_word_mappings"

    id = Column(Integer, primary_key=True, index=True)
    guide_id = Column(Integer, ForeignKey("learning_guides.id", ondelete="CASCADE"), nullable=False)
    kazakh_word_id = Column(Integer, ForeignKey("kazakh_words.id", ondelete="CASCADE"), nullable=False)
    
    # Метаданные для слова в путеводителе
    importance_score = Column(Float, default=1.0)  # Важность слова в путеводителе
    order_in_guide = Column(Integer, nullable=True)  # Порядок изучения
    
    # Управление
    is_active = Column(Boolean, default=True)
    
    # Даты
    created_at = Column(DateTime, default=datetime.utcnow)

    # Связи
    guide = relationship("LearningGuide")
    kazakh_word = relationship("KazakhWord")

    # Ограничения
    __table_args__ = (
        UniqueConstraint('guide_id', 'kazakh_word_id', name='unique_guide_word'),
        Index('idx_guide_words', 'guide_id', 'is_active'),
    )


class UserSessionDetail(Base):
    """Detailed results for each word in a session"""
    __tablename__ = "user_session_details"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("user_learning_sessions.id", ondelete="CASCADE"), nullable=False)
    kazakh_word_id = Column(Integer, ForeignKey("kazakh_words.id", ondelete="CASCADE"), nullable=False)

    # Answer details
    was_correct = Column(Boolean, nullable=False)
    user_answer = Column(Text, nullable=True)
    correct_answer = Column(Text, nullable=True)
    response_time_ms = Column(Integer, nullable=True)

    # Question metadata
    question_type = Column(String(50), nullable=True)
    question_language = Column(String(5), nullable=True)
    answer_language = Column(String(5), nullable=True)

    # Timestamp
    answered_at = Column(DateTime, default=datetime.utcnow)

    # Relationships - ИСПРАВЛЕНО
    session = relationship("UserLearningSession", back_populates="session_details")
    kazakh_word = relationship("KazakhWord")

    __table_args__ = (
        Index('idx_session_details_session', 'session_id'),
        Index('idx_session_details_word', 'kazakh_word_id'),
        Index('idx_session_details_answered', 'answered_at'),
    )


class UserLearningGoal(Base):
    """User's learning goals and targets"""
    __tablename__ = "user_learning_goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Goal details
    goal_type = Column(String(50), nullable=False)
    target_value = Column(Integer, nullable=False)
    current_value = Column(Integer, default=0)

    # Goal metadata
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    difficulty_level_id = Column(Integer, ForeignKey("difficulty_levels.id"), nullable=True)

    # Status
    is_active = Column(Boolean, default=True)
    is_completed = Column(Boolean, default=False)

    # Dates
    start_date = Column(DateTime, default=datetime.utcnow)
    target_date = Column(DateTime, nullable=True)
    completed_date = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships - ИСПРАВЛЕНО
    user = relationship("User", back_populates="learning_goals")
    category = relationship("Category")
    difficulty_level = relationship("DifficultyLevel")

    __table_args__ = (
        Index('idx_learning_goals_user', 'user_id'),
        Index('idx_learning_goals_active', 'is_active'),
        Index('idx_learning_goals_type', 'goal_type'),
    )


class UserAchievement(Base):
    """Track user achievements and milestones"""
    __tablename__ = "user_achievements"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Achievement details
    achievement_type = Column(String(50), nullable=False)
    achievement_data = Column(Text, nullable=True)  # JSON data for achievement details

    # Timestamps
    earned_at = Column(DateTime, default=datetime.utcnow)

    # Relationships - ИСПРАВЛЕНО
    user = relationship("User", back_populates="achievements")

    __table_args__ = (
        Index('idx_achievements_user', 'user_id'),
        Index('idx_achievements_type', 'achievement_type'),
        Index('idx_achievements_earned', 'earned_at'),
    )

class UserStreak(Base):
    """Track user's learning streaks"""
    __tablename__ = "user_streaks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Add the missing streak_type field
    streak_type = Column(String(20), default="daily", nullable=False)
    
    # Streak data
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_activity_date = Column(DateTime, nullable=True)
    streak_start_date = Column(DateTime, nullable=True)  # Added this field too as it's used in CRUD

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships - ИСПРАВЛЕНО
    user = relationship("User", back_populates="streak")

    __table_args__ = (
        Index('idx_streaks_user', 'user_id'),
        Index('idx_streaks_type', 'streak_type'),  # Index for streak_type
        Index('idx_streaks_last_activity', 'last_activity_date'),
        # Make user_id + streak_type unique together
        UniqueConstraint('user_id', 'streak_type', name='uq_user_streak_type'),
    )