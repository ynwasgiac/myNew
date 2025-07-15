# database/auth_models.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Enum, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .connection import Base
import enum


class UserRole(enum.Enum):
    STUDENT = "student"
    WRITER = "writer"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)

    # User info
    full_name = Column(String(100), nullable=True)
    role = Column(Enum(UserRole), default=UserRole.STUDENT, nullable=False)

    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)

    # Language preferences
    main_language_id = Column(Integer, ForeignKey("languages.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    is_superuser = Column(Boolean, default=False)

    # Relationships - ИСПРАВЛЕНО: добавлены все необходимые связи
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    main_language = relationship("Language", foreign_keys=[main_language_id])

    # Learning progress relationships - ДОБАВЛЕНО
    word_progress = relationship("UserWordProgress", back_populates="user", cascade="all, delete-orphan")
    learning_sessions = relationship("UserLearningSession", back_populates="user", cascade="all, delete-orphan")
    learning_goals = relationship("UserLearningGoal", back_populates="user", cascade="all, delete-orphan")
    achievements = relationship("UserAchievement", back_populates="user", cascade="all, delete-orphan")
    streak = relationship("UserStreak", back_populates="user", uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', role='{self.role.value}')>"


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_jti = Column(String(36), unique=True, nullable=False)  # JWT ID for token revocation
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    last_used = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    is_revoked = Column(Boolean, default=False)

    # Optional: track device/browser info
    user_agent = Column(String(500), nullable=True)
    ip_address = Column(String(45), nullable=True)  # Supports IPv6

    # Relationships
    user = relationship("User", back_populates="sessions")

    def __repr__(self):
        return f"<UserSession(id={self.id}, user_id={self.user_id}, token_jti='{self.token_jti}')>"