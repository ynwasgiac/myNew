# database/learning_models.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Enum, UniqueConstraint, Index, Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .connection import Base

# ===== ENUMS - Define all enums FIRST =====

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
    """Status of guide completion"""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class WordSource(enum.Enum):
    """Source of word in practice session"""
    LEARNING_LIST = "learning_list"  # From learning list
    RANDOM = "random"  # Random word
    GUIDE = "guide"  # From guide


# ===== MODELS =====

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

    # Difficulty assessment
    difficulty_rating = Column(Enum(DifficultyRating), nullable=True)
    user_notes = Column(Text, nullable=True)

    # Timestamps
    added_at = Column(DateTime, default=datetime.utcnow)
    first_learned_at = Column(DateTime, nullable=True)
    last_practiced_at = Column(DateTime, nullable=True)
    next_review_at = Column(DateTime, nullable=True)

    # Spaced repetition
    repetition_interval = Column(Integer, default=1)  # Days until next review
    ease_factor = Column(Float, default=2.5)  # Spaced repetition ease factor

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="word_progress")
    kazakh_word = relationship("KazakhWord")

    # Constraints
    __table_args__ = (
        UniqueConstraint('user_id', 'kazakh_word_id', name='unique_user_word'),
        Index('idx_user_word_status', 'user_id', 'status'),
        Index('idx_user_word_next_review', 'user_id', 'next_review_at'),
        Index('idx_word_progress_updated', 'updated_at'),
    )


class UserLearningSession(Base):
    """Learning session tracking"""
    __tablename__ = "user_learning_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Session metadata
    session_type = Column(String(50), nullable=False)
    word_source = Column(String(20), default="learning_list")
    guide_id = Column(Integer, nullable=True)

    # Session stats
    total_questions = Column(Integer, default=0)
    words_studied = Column(Integer, default=0)  # Add via migration
    correct_answers = Column(Integer, default=0)
    incorrect_answers = Column(Integer, default=0)
    learning_words_count = Column(Integer, default=0)
    random_words_count = Column(Integer, default=0)

    # Session timing
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    
    # ADD THESE TIMESTAMP FIELDS:
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Optional filters used
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    difficulty_level_id = Column(Integer, ForeignKey("difficulty_levels.id"), nullable=True)

    # Relationships
    user = relationship("User", back_populates="learning_sessions")
    session_details = relationship("UserSessionDetail", back_populates="session", cascade="all, delete-orphan")
    category = relationship("Category", foreign_keys=[category_id])
    difficulty_level = relationship("DifficultyLevel", foreign_keys=[difficulty_level_id])

    __table_args__ = (
        Index('idx_learning_sessions_user', 'user_id'),
        Index('idx_learning_sessions_started', 'started_at'),
        Index('idx_learning_sessions_type', 'session_type'),
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
    question_type = Column(String(50), nullable=False)  # translation, pronunciation, etc.
    question_language = Column(String(10), nullable=True)  # Language of question
    answer_language = Column(String(10), nullable=True)  # Language of answer

    # Timestamp
    answered_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    session = relationship("UserLearningSession", back_populates="session_details")
    kazakh_word = relationship("KazakhWord")

    __table_args__ = (
        Index('idx_session_details_session', 'session_id'),
        Index('idx_session_details_word', 'kazakh_word_id'),
    )


class UserLearningGoal(Base):
    """User learning goals and targets"""
    __tablename__ = "user_learning_goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Goal details
    goal_type = Column(String(50), nullable=False)  # daily_words, weekly_practice, etc.
    target_value = Column(Integer, nullable=False)
    current_value = Column(Integer, default=0)

    # Optional filters
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    difficulty_level_id = Column(Integer, ForeignKey("difficulty_levels.id"), nullable=True)

    # Goal period
    target_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="learning_goals")
    category = relationship("Category", foreign_keys=[category_id])
    difficulty_level = relationship("DifficultyLevel", foreign_keys=[difficulty_level_id])

    __table_args__ = (
        Index('idx_learning_goals_user', 'user_id'),
        Index('idx_learning_goals_active', 'user_id', 'is_active'),
    )


class UserAchievement(Base):
    """User achievements and milestones"""
    __tablename__ = "user_achievements"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Achievement details
    achievement_type = Column(String(50), nullable=False)  # words_learned, streak_days, etc.
    achievement_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    # Achievement value/level
    achievement_value = Column(Integer, nullable=False)
    
    # Metadata
    earned_at = Column(DateTime, default=datetime.utcnow)
    is_hidden = Column(Boolean, default=False)

    # Relationships
    user = relationship("User", back_populates="achievements")

    __table_args__ = (
        Index('idx_achievements_user', 'user_id'),
        Index('idx_achievements_type', 'achievement_type'),
    )


class UserStreak(Base):
    """User learning streaks"""
    __tablename__ = "user_streaks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # ✅ ADD THIS LINE - Missing streak_type column
    streak_type = Column(String(20), default="daily", nullable=False)  # daily, weekly, monthly

    # Streak data
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_activity_date = Column(DateTime, nullable=True)
    streak_start_date = Column(DateTime, nullable=True)  # Also add this if missing

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="streak")

    __table_args__ = (
        Index('idx_streaks_user', 'user_id'),
        Index('idx_streaks_type', 'streak_type'),  # Add index for streak_type
        UniqueConstraint('user_id', 'streak_type', name='unique_user_streak_type'),  # Update constraint
    )


# ===== GUIDE MODELS =====

class LearningGuide(Base):
    """Learning guides with multilingual support"""
    __tablename__ = "learning_guides"

    id = Column(Integer, primary_key=True, index=True)
    
    # Basic information (default language)
    guide_key = Column(String(50), unique=True, nullable=False)  # greetings, family, etc.
    title = Column(String(200), nullable=False)  # Default title
    description = Column(Text, nullable=True)  # Default description
    icon_name = Column(String(50), nullable=True)  # Icon name
    color = Column(String(20), nullable=True)  # Theme color
    
    # Metadata
    difficulty_level = Column(String(20), nullable=False)  # beginner, intermediate, advanced
    estimated_minutes = Column(Integer, nullable=True)  # Estimated time
    target_word_count = Column(Integer, default=20)  # Target number of words
    
    # Search data
    keywords = Column(JSON, nullable=True)  # Kazakh keywords for search
    topics = Column(JSON, nullable=True)  # Related topics (default language)
    
    # Management
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user_progress = relationship("UserGuideProgress", back_populates="guide")
    translations = relationship("GuideTranslation", back_populates="guide", cascade="all, delete-orphan")
    word_mappings = relationship("GuideWordMapping", back_populates="guide", cascade="all, delete-orphan")

    def get_translated_content(self, language_code: str = 'en'):
        """Get translated content for specific language or fallback to default"""
        # Find translation for requested language
        for translation in self.translations:
            if translation.language.language_code == language_code:
                return {
                    'title': translation.translated_title,
                    'description': translation.translated_description,
                    'topics': translation.translated_topics or self.topics
                }
        
        # Fallback to default content
        return {
            'title': self.title,
            'description': self.description,
            'topics': self.topics
        }

    __table_args__ = (
        Index('idx_learning_guides_active', 'is_active'),
        Index('idx_learning_guides_sort', 'sort_order'),
    )


class GuideTranslation(Base):
    """Translations for learning guides"""
    __tablename__ = "guide_translations"

    id = Column(Integer, primary_key=True, index=True)
    guide_id = Column(Integer, ForeignKey("learning_guides.id", ondelete="CASCADE"), nullable=False)
    language_id = Column(Integer, ForeignKey("languages.id", ondelete="CASCADE"), nullable=False)
    
    # Translated content
    translated_title = Column(String(200), nullable=False)
    translated_description = Column(Text, nullable=True)
    translated_topics = Column(JSON, nullable=True)  # Translated topic list
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    guide = relationship("LearningGuide", back_populates="translations")
    language = relationship("Language")

    # Constraints
    __table_args__ = (
        UniqueConstraint('guide_id', 'language_id', name='unique_guide_language'),
        Index('idx_guide_translations_language', 'language_id'),
    )


class UserGuideProgress(Base):
    """User progress through learning guides"""
    __tablename__ = "user_guide_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    guide_id = Column(Integer, ForeignKey("learning_guides.id", ondelete="CASCADE"), nullable=False)
    
    # Completion status
    status = Column(Enum(GuideStatus), default=GuideStatus.NOT_STARTED, nullable=False)
    
    # Progress
    words_completed = Column(Integer, default=0)  # Number of learned words
    total_words_added = Column(Integer, default=0)  # Total words added from guide
    
    # Timestamps
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    last_accessed_at = Column(DateTime, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User")
    guide = relationship("LearningGuide", back_populates="user_progress")

    # Constraints
    __table_args__ = (
        UniqueConstraint('user_id', 'guide_id', name='unique_user_guide'),
        Index('idx_user_guide_status', 'user_id', 'status'),
    )


class GuideWordMapping(Base):
    """Mapping between guides and words"""
    __tablename__ = "guide_word_mappings"

    id = Column(Integer, primary_key=True, index=True)
    guide_id = Column(Integer, ForeignKey("learning_guides.id", ondelete="CASCADE"), nullable=False)
    kazakh_word_id = Column(Integer, ForeignKey("kazakh_words.id", ondelete="CASCADE"), nullable=False)
    
    # Word metadata within guide
    importance_score = Column(Float, default=1.0)  # Importance of word in guide
    order_in_guide = Column(Integer, nullable=True)  # Learning order
    
    # Management
    is_active = Column(Boolean, default=True)
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    guide = relationship("LearningGuide", back_populates="word_mappings")
    kazakh_word = relationship("KazakhWord")

    # Constraints
    __table_args__ = (
        UniqueConstraint('guide_id', 'kazakh_word_id', name='unique_guide_word'),
        Index('idx_guide_words', 'guide_id', 'is_active'),
        Index('idx_guide_word_order', 'guide_id', 'order_in_guide'),
    )