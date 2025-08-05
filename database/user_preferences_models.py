from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Enum, ForeignKey, JSON
from datetime import datetime
from sqlalchemy.orm import relationship
from .connection import Base


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    # Quiz preferences
    quiz_word_count = Column(Integer, default=5)

    # Learning preferences
    daily_goal = Column(Integer, default=10)
    session_length = Column(Integer, default=10)

    # Notification preferences (JSON field for flexibility)
    notification_settings = Column(JSON, default={
        'daily_reminders': True,
        'review_reminders': True,
        'achievement_notifications': True,
        'streak_reminders': True,
        'goal_reminders': True
    })

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    user = relationship("User", back_populates="preferences")
