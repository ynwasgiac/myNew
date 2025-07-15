# database/models.py
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint, Index, Enum, Float
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
import enum
from .connection import Base

# Import auth models and learning models to ensure they're registered with Base
from .auth_models import UserRole, User, UserSession

# Import learning models
from database.learning_models import (
    LearningGuide, UserGuideProgress, GuideWordMapping,
    GuideStatus  # ✅ Add all needed enums
)

class Language(Base):
    __tablename__ = "languages"

    id = Column(Integer, primary_key=True)
    language_code = Column(String(5), nullable=False, unique=True)
    language_name = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    category_translations = relationship("CategoryTranslation", back_populates="language")
    word_type_translations = relationship("WordTypeTranslation", back_populates="language")
    difficulty_level_translations = relationship("DifficultyLevelTranslation", back_populates="language")
    pronunciations = relationship("Pronunciation", back_populates="language")
    translations = relationship("Translation", back_populates="language")
    example_sentence_translations = relationship("ExampleSentenceTranslation", back_populates="language")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)
    category_name = Column(String(50), nullable=False, unique=True)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    translations = relationship("CategoryTranslation", back_populates="category", cascade="all, delete-orphan")
    kazakh_words = relationship("KazakhWord", back_populates="category")


class CategoryTranslation(Base):
    __tablename__ = "category_translations"

    id = Column(Integer, primary_key=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=False)
    translated_name = Column(String(100), nullable=False)
    translated_description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    category = relationship("Category", back_populates="translations")
    language = relationship("Language", back_populates="category_translations")

    __table_args__ = (
        UniqueConstraint('category_id', 'language_id', name='unique_category_language'),
        Index('idx_category_translations_category', 'category_id'),
        Index('idx_category_translations_language', 'language_id'),
    )


class WordType(Base):
    __tablename__ = "word_types"

    id = Column(Integer, primary_key=True)
    type_name = Column(String(50), nullable=False, unique=True)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    translations = relationship("WordTypeTranslation", back_populates="word_type", cascade="all, delete-orphan")
    kazakh_words = relationship("KazakhWord", back_populates="word_type")


class WordTypeTranslation(Base):
    __tablename__ = "word_type_translations"

    id = Column(Integer, primary_key=True)
    word_type_id = Column(Integer, ForeignKey("word_types.id", ondelete="CASCADE"), nullable=False)
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=False)
    translated_name = Column(String(100), nullable=False)
    translated_description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    word_type = relationship("WordType", back_populates="translations")
    language = relationship("Language", back_populates="word_type_translations")

    __table_args__ = (
        UniqueConstraint('word_type_id', 'language_id', name='unique_word_type_language'),
        Index('idx_word_type_translations_type', 'word_type_id'),
        Index('idx_word_type_translations_language', 'language_id'),
    )


class DifficultyLevel(Base):
    __tablename__ = "difficulty_levels"

    id = Column(Integer, primary_key=True)
    level_number = Column(Integer, nullable=False, unique=True)
    level_name = Column(String(50), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    translations = relationship("DifficultyLevelTranslation", back_populates="difficulty_level",
                                cascade="all, delete-orphan")
    kazakh_words = relationship("KazakhWord", back_populates="difficulty_level")


class DifficultyLevelTranslation(Base):
    __tablename__ = "difficulty_level_translations"

    id = Column(Integer, primary_key=True)
    difficulty_level_id = Column(Integer, ForeignKey("difficulty_levels.id", ondelete="CASCADE"), nullable=False)
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=False)
    translated_name = Column(String(100), nullable=False)
    translated_description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    difficulty_level = relationship("DifficultyLevel", back_populates="translations")
    language = relationship("Language", back_populates="difficulty_level_translations")

    __table_args__ = (
        UniqueConstraint('difficulty_level_id', 'language_id', name='unique_difficulty_language'),
        Index('idx_difficulty_translations_level', 'difficulty_level_id'),
        Index('idx_difficulty_translations_language', 'language_id'),
    )


class KazakhWord(Base):
    __tablename__ = "kazakh_words"

    id = Column(Integer, primary_key=True)
    kazakh_word = Column(String(100), nullable=False)
    kazakh_cyrillic = Column(String(100))
    word_type_id = Column(Integer, ForeignKey("word_types.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    difficulty_level_id = Column(Integer, ForeignKey("difficulty_levels.id"), default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    word_type = relationship("WordType", back_populates="kazakh_words")
    category = relationship("Category", back_populates="kazakh_words")
    difficulty_level = relationship("DifficultyLevel", back_populates="kazakh_words")
    pronunciations = relationship("Pronunciation", back_populates="kazakh_word", cascade="all, delete-orphan")
    translations = relationship("Translation", back_populates="kazakh_word", cascade="all, delete-orphan")
    images = relationship("WordImage", back_populates="kazakh_word", cascade="all, delete-orphan")
    example_sentences = relationship("ExampleSentence", back_populates="kazakh_word", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_kazakh_words_category', 'category_id'),
        Index('idx_kazakh_words_type', 'word_type_id'),
        Index('idx_kazakh_words_difficulty', 'difficulty_level_id'),
    )


class Pronunciation(Base):
    __tablename__ = "pronunciations"

    id = Column(Integer, primary_key=True)
    kazakh_word_id = Column(Integer, ForeignKey("kazakh_words.id", ondelete="CASCADE"), nullable=False)
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=False)
    pronunciation = Column(String(150), nullable=False)
    pronunciation_system = Column(String(50))
    audio_file_path = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    kazakh_word = relationship("KazakhWord", back_populates="pronunciations")
    language = relationship("Language", back_populates="pronunciations")

    __table_args__ = (
        UniqueConstraint('kazakh_word_id', 'language_id', 'pronunciation_system',
                         name='unique_word_language_pronunciation'),
        Index('idx_pronunciations_word', 'kazakh_word_id'),
        Index('idx_pronunciations_language', 'language_id'),
    )


class Translation(Base):
    __tablename__ = "translations"

    id = Column(Integer, primary_key=True)
    kazakh_word_id = Column(Integer, ForeignKey("kazakh_words.id", ondelete="CASCADE"), nullable=False)
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=False)
    translation = Column(String(200), nullable=False)
    alternative_translations = Column(JSONB)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    kazakh_word = relationship("KazakhWord", back_populates="translations")
    language = relationship("Language", back_populates="translations")

    __table_args__ = (
        UniqueConstraint('kazakh_word_id', 'language_id', name='unique_word_language'),
        Index('idx_translations_word', 'kazakh_word_id'),
        Index('idx_translations_language', 'language_id'),
    )


class WordImage(Base):
    __tablename__ = "word_images"

    id = Column(Integer, primary_key=True)
    kazakh_word_id = Column(Integer, ForeignKey("kazakh_words.id", ondelete="CASCADE"), nullable=False)
    
    # Store only the public URL, not the file path
    image_url = Column(String(500), nullable=False)  # Public URL like /images/words/categories/1/word.jpg
    
    # Metadata
    image_type = Column(String(20), default='photo')  # 'photo', 'illustration', 'diagram', etc.
    alt_text = Column(String(200))
    is_primary = Column(Boolean, default=False)
    
    # Source information
    source = Column(String(100))  # Where the image came from
    license = Column(String(50))  # License information
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    kazakh_word = relationship("KazakhWord", back_populates="images")

    __table_args__ = (
        Index('idx_word_images_word', 'kazakh_word_id'),
        Index('idx_word_images_primary', 'is_primary'),
    )

class WordSound(Base):
    __tablename__ = "word_sounds"

    id = Column(Integer, primary_key=True)
    kazakh_word_id = Column(Integer, ForeignKey("kazakh_words.id", ondelete="CASCADE"), nullable=False)
    
    # Store only the public URL, not the file path
    sound_url = Column(String(500), nullable=False)  # Make sure this exists and is not null
    
    # Metadata
    sound_type = Column(String(50), default='pronunciation')
    alt_text = Column(String(200))
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    kazakh_word = relationship("KazakhWord", backref="sounds")

    __table_args__ = (
        Index('idx_word_sounds_word', 'kazakh_word_id'),
    )

class ExampleSentence(Base):
    __tablename__ = "example_sentences"

    id = Column(Integer, primary_key=True)
    kazakh_word_id = Column(Integer, ForeignKey("kazakh_words.id", ondelete="CASCADE"), nullable=False)
    kazakh_sentence = Column(Text, nullable=False)
    difficulty_level = Column(Integer, default=1)
    usage_context = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    kazakh_word = relationship("KazakhWord", back_populates="example_sentences")
    translations = relationship("ExampleSentenceTranslation", back_populates="example_sentence",
                                cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_example_sentences_word', 'kazakh_word_id'),
    )


class ExampleSentenceTranslation(Base):
    __tablename__ = "example_sentences_translations"

    id = Column(Integer, primary_key=True)
    example_sentence_id = Column(Integer, ForeignKey("example_sentences.id", ondelete="CASCADE"), nullable=False)
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=False)
    translated_sentence = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    example_sentence = relationship("ExampleSentence", back_populates="translations")
    language = relationship("Language", back_populates="example_sentence_translations")

    __table_args__ = (
        UniqueConstraint('example_sentence_id', 'language_id', name='unique_example_language'),
        Index('idx_example_translations_sentence', 'example_sentence_id'),
        Index('idx_example_translations_language', 'language_id'),
    )

