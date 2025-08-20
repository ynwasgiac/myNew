# ai_models.py
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime

# ===== AI SENTENCE GENERATION SCHEMAS =====

class GenerateExampleSentenceRequest(BaseModel):
    """Schema for generating example sentences with AI"""
    kazakh_word: str = Field(..., min_length=1, max_length=100, description="The Kazakh word to create an example for")
    kazakh_cyrillic: Optional[str] = Field(None, max_length=100, description="Cyrillic version of the word")
    difficulty_level: int = Field(1, ge=1, le=5, description="Difficulty level (1-5)")
    usage_context: Optional[str] = Field("daily conversation", max_length=100, description="Context for the sentence")
    sentence_length: Optional[str] = Field("medium", description="Sentence length preference: short, medium, long")

    class Config:
        json_schema_extra = {
            "example": {
                "kazakh_word": "алма",
                "kazakh_cyrillic": "алма",
                "difficulty_level": 2,
                "usage_context": "daily conversation",
                "sentence_length": "medium"
            }
        }


class TranslateSentenceRequest(BaseModel):
    """Schema for translating sentences with AI"""
    kazakh_sentence: str = Field(..., min_length=3, max_length=500, description="The Kazakh sentence to translate")
    target_language_code: str = Field(..., min_length=2, max_length=5, description="Target language code")
    target_language_name: str = Field(..., min_length=2, max_length=50, description="Target language name")
    context: Optional[str] = Field(None, max_length=100, description="Context for better translation")

    class Config:
        json_schema_extra = {
            "example": {
                "kazakh_sentence": "Мен алма жеймін.",
                "target_language_code": "en",
                "target_language_name": "English",
                "context": "daily conversation"
            }
        }


class BatchTranslateSentenceRequest(BaseModel):
    """Schema for batch translating sentences"""
    kazakh_sentence: str = Field(..., min_length=3, max_length=500, description="The Kazakh sentence to translate")
    target_languages: List[str] = Field(..., min_items=1, max_items=5, description="List of language codes")
    context: Optional[str] = Field(None, max_length=100, description="Context for better translation")

    class Config:
        json_schema_extra = {
            "example": {
                "kazakh_sentence": "Мен алма жеймін.",
                "target_languages": ["en", "ru", "zh"],
                "context": "daily conversation"
            }
        }


class GeneratedSentenceResponse(BaseModel):
    """Response for generated example sentence"""
    kazakh_sentence: str
    difficulty_level: int
    usage_context: str
    confidence: float
    generated_at: datetime

    class Config:
        json_schema_extra = {
            "example": {
                "kazakh_sentence": "Мен таңертең алма жеймін.",
                "difficulty_level": 2,
                "usage_context": "daily conversation",
                "confidence": 0.95,
                "generated_at": "2025-08-20T10:30:00Z"
            }
        }


class TranslatedSentenceResponse(BaseModel):
    """Response for translated sentence"""
    translated_sentence: str
    confidence: float
    language_code: str
    language_name: str
    translated_at: datetime

    class Config:
        json_schema_extra = {
            "example": {
                "translated_sentence": "I eat apples in the morning.",
                "confidence": 0.95,
                "language_code": "en",
                "language_name": "English",
                "translated_at": "2025-08-20T10:30:00Z"
            }
        }


class AIServiceStatus(BaseModel):
    """Response for AI service status"""
    service_available: bool
    test_successful: bool
    available_models: List[str]
    features: Dict[str, bool]
    status: str
    error: Optional[str] = None
    last_checked: str