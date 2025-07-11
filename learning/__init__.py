"""
Learning module for Kazakh Language Learning API

This module provides all learning progress tracking functionality including:
- Word progress management
- Practice sessions with spaced repetition
- Learning goals and achievements
- Statistics and analytics
- Learning history tracking
"""

from .routes import router

__version__ = "1.0.0"
__author__ = "Kazakh Language Learning Team"

__all__ = ["router"]