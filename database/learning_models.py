# database/learning_models.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Enum, UniqueConstraint, Index, \
    Float
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


class UserWordProgress(Base):
    """Track user's progress with individual words"""
    __tablename__ = "user_word_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    kazakh_word_id = Column(Integer, ForeignKey("kazakh_words.id", ondelete="CASCADE"), nullable=False)

    # Learning status
    status = Column(Enum(LearningStatus), default=LearningStatus.WANT_TO_LEARN, nullable=False)

    # Progress tracking
    times_seen = Column(Integer, default=0)  # How many times word was shown
    times_correct = Column(Integer, default=0)  # How many times answered correctly
    times_incorrect = Column(Integer, default=0)  # How many times answered incorrectly

    # User ratings
    difficulty_rating = Column(Enum(DifficultyRating), nullable=True)  # User's perceived difficulty

    # Important dates
    added_at = Column(DateTime, default=datetime.utcnow)  # When added to learning list
    first_learned_at = Column(DateTime, nullable=True)  # When first marked as learned
    last_practiced_at = Column(DateTime, nullable=True)  # Last time practiced
    next_review_at = Column(DateTime, nullable=True)  # When should be reviewed next

    # Spaced repetition data
    repetition_interval = Column(Integer, default=1)  # Days until next review
    ease_factor = Column(Float, default=2.5)  # Spaced repetition ease factor

    # Notes
    user_notes = Column(Text, nullable=True)  # User's personal notes

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", backref="word_progress")
    kazakh_word = relationship("KazakhWord", backref="user_progress")

    __table_args__ = (
        UniqueConstraint('user_id', 'kazakh_word_id', name='unique_user_word'),
        Index('idx_user_word_progress_user', 'user_id'),
        Index('idx_user_word_progress_word', 'kazakh_word_id'),
        Index('idx_user_word_progress_status', 'status'),
        Index('idx_user_word_progress_next_review', 'next_review_at'),
    )


class UserLearningSession(Base):
    """Track user's learning sessions"""
    __tablename__ = "user_learning_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Session info
    session_type = Column(String(50), nullable=False)  # 'practice', 'review', 'quiz', etc.
    words_studied = Column(Integer, default=0)  # Number of words in session
    correct_answers = Column(Integer, default=0)  # Correct answers
    incorrect_answers = Column(Integer, default=0)  # Incorrect answers

    # Session metadata
    duration_seconds = Column(Integer, nullable=True)  # Session duration
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)  # Category focused on
    difficulty_level_id = Column(Integer, ForeignKey("difficulty_levels.id"), nullable=True)

    # Timestamps
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", backref="learning_sessions")
    category = relationship("Category", backref="learning_sessions")
    difficulty_level = relationship("DifficultyLevel", backref="learning_sessions")
    session_details = relationship("UserSessionDetail", back_populates="session", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_learning_sessions_user', 'user_id'),
        Index('idx_learning_sessions_started', 'started_at'),
        Index('idx_learning_sessions_category', 'category_id'),
    )


class UserSessionDetail(Base):
    """Detailed tracking of each word interaction in a session"""
    __tablename__ = "user_session_details"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("user_learning_sessions.id", ondelete="CASCADE"), nullable=False)
    kazakh_word_id = Column(Integer, ForeignKey("kazakh_words.id", ondelete="CASCADE"), nullable=False)

    # Interaction details
    was_correct = Column(Boolean, nullable=False)
    response_time_ms = Column(Integer, nullable=True)  # Time to answer in milliseconds
    user_answer = Column(String(200), nullable=True)  # What user answered
    correct_answer = Column(String(200), nullable=True)  # What the correct answer was

    # Question details
    question_type = Column(String(50), nullable=True)  # 'translation', 'pronunciation', 'multiple_choice', etc.
    question_language = Column(String(5), nullable=True)  # Language code of question
    answer_language = Column(String(5), nullable=True)  # Language code of expected answer

    # Timestamps
    answered_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    session = relationship("UserLearningSession", back_populates="session_details")
    kazakh_word = relationship("KazakhWord", backref="session_details")

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
    goal_type = Column(String(50), nullable=False)  # 'daily_words', 'weekly_practice', 'category_mastery', etc.
    target_value = Column(Integer, nullable=False)  # Target number
    current_value = Column(Integer, default=0)  # Current progress

    # Goal metadata
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)  # If goal is category-specific
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

    # Relationships
    user = relationship("User", backref="learning_goals")
    category = relationship("Category", backref="learning_goals")
    difficulty_level = relationship("DifficultyLevel", backref="learning_goals")

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
    achievement_type = Column(String(50), nullable=False)  # 'first_word', 'streak_7', 'category_complete', etc.
    achievement_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    # Achievement metadata
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    difficulty_level_id = Column(Integer, ForeignKey("difficulty_levels.id"), nullable=True)
    value = Column(Integer, nullable=True)  # Achievement value (e.g., streak length)

    # Timestamps
    earned_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", backref="achievements")
    category = relationship("Category", backref="achievements")
    difficulty_level = relationship("DifficultyLevel", backref="achievements")

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

    # Streak details
    streak_type = Column(String(50), default="daily")  # 'daily', 'weekly'
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)

    # Dates
    last_activity_date = Column(DateTime, nullable=True)
    streak_start_date = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", backref="streaks")

    __table_args__ = (
        UniqueConstraint('user_id', 'streak_type', name='unique_user_streak_type'),
        Index('idx_streaks_user', 'user_id'),
        Index('idx_streaks_last_activity', 'last_activity_date'),
    )