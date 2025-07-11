# database/schemas.py
from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import List, Optional, Dict, Any, Generic, TypeVar

T = TypeVar('T')

# Language schemas
class LanguageBase(BaseModel):
    language_code: str = Field(..., max_length=5)
    language_name: str = Field(..., max_length=50)
    is_active: bool = True


class LanguageResponse(LanguageBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Category schemas
class CategoryTranslationResponse(BaseModel):
    id: int
    translated_name: str
    translated_description: Optional[str] = None
    language_code: str

    @classmethod
    def from_orm_with_language(cls, translation_obj):
        """Custom method to extract language_code from related Language object"""
        return cls(
            id=translation_obj.id,
            translated_name=translation_obj.translated_name,
            translated_description=translation_obj.translated_description,
            language_code=translation_obj.language.language_code
        )

    class Config:
        from_attributes = True


class CategoryBase(BaseModel):
    category_name: str = Field(..., max_length=50)
    description: Optional[str] = None
    is_active: bool = True


class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime
    translations: List[CategoryTranslationResponse] = []

    class Config:
        from_attributes = True


# Word Type schemas
class WordTypeTranslationResponse(BaseModel):
    id: int
    translated_name: str
    translated_description: Optional[str] = None
    language_code: str

    @classmethod
    def from_orm_with_language(cls, translation_obj):
        """Custom method to extract language_code from related Language object"""
        return cls(
            id=translation_obj.id,
            translated_name=translation_obj.translated_name,
            translated_description=translation_obj.translated_description,
            language_code=translation_obj.language.language_code
        )

    class Config:
        from_attributes = True


class WordTypeBase(BaseModel):
    type_name: str = Field(..., max_length=50)
    description: Optional[str] = None
    is_active: bool = True


class WordTypeResponse(WordTypeBase):
    id: int
    created_at: datetime
    translations: List[WordTypeTranslationResponse] = []

    class Config:
        from_attributes = True


# Difficulty Level schemas
class DifficultyLevelTranslationResponse(BaseModel):
    id: int
    translated_name: str
    translated_description: Optional[str] = None
    language_code: str

    @classmethod
    def from_orm_with_language(cls, translation_obj):
        """Custom method to extract language_code from related Language object"""
        return cls(
            id=translation_obj.id,
            translated_name=translation_obj.translated_name,
            translated_description=translation_obj.translated_description,
            language_code=translation_obj.language.language_code
        )

    class Config:
        from_attributes = True


class DifficultyLevelBase(BaseModel):
    level_number: int
    level_name: str = Field(..., max_length=50)
    description: Optional[str] = None
    is_active: bool = True


class DifficultyLevelResponse(DifficultyLevelBase):
    id: int
    created_at: datetime
    translations: List[DifficultyLevelTranslationResponse] = []

    class Config:
        from_attributes = True


# Translation schemas
class TranslationBase(BaseModel):
    translation: str = Field(..., max_length=200)
    alternative_translations: Optional[List[str]] = None


class TranslationCreate(TranslationBase):
    language_id: int


class TranslationResponse(TranslationBase):
    id: int
    language_code: str
    created_at: datetime

    @classmethod
    def from_orm_with_language(cls, translation_obj):
        """Custom method to extract language_code from related Language object"""
        return cls(
            id=translation_obj.id,
            translation=translation_obj.translation,
            alternative_translations=translation_obj.alternative_translations,
            language_code=translation_obj.language.language_code,
            created_at=translation_obj.created_at
        )

    class Config:
        from_attributes = True


# Pronunciation schemas
class PronunciationBase(BaseModel):
    pronunciation: str = Field(..., max_length=150)
    pronunciation_system: Optional[str] = Field(None, max_length=50)
    audio_file_path: Optional[str] = Field(None, max_length=255)


class PronunciationCreate(PronunciationBase):
    language_id: int


class PronunciationResponse(PronunciationBase):
    id: int
    language_code: str
    created_at: datetime

    @classmethod
    def from_orm_with_language(cls, pronunciation_obj):
        """Custom method to extract language_code from related Language object"""
        return cls(
            id=pronunciation_obj.id,
            pronunciation=pronunciation_obj.pronunciation,
            pronunciation_system=pronunciation_obj.pronunciation_system,
            audio_file_path=pronunciation_obj.audio_file_path,
            language_code=pronunciation_obj.language.language_code,
            created_at=pronunciation_obj.created_at
        )

    class Config:
        from_attributes = True


# Word Image schemas
class WordImageBase(BaseModel):
    image_url: str = Field(..., max_length=500)
    image_url: Optional[str] = Field(None, max_length=500)
    image_type: str = Field(default="illustration", max_length=20)
    alt_text: Optional[str] = Field(None, max_length=200)
    is_primary: bool = False
    source: Optional[str] = Field(None, max_length=100)
    license: Optional[str] = Field(None, max_length=50)


class WordImageResponse(BaseModel):
    id: int
    kazakh_word_id: int
    image_url: str  # Public URL
    image_type: str
    alt_text: Optional[str] = None
    is_primary: bool
    source: Optional[str] = None
    license: Optional[str] = None
    created_at: datetime

    @classmethod
    def from_attributes(cls, image_obj):
        """Custom method to handle WordImage objects"""
        return cls(
            id=image_obj.id,
            kazakh_word_id=image_obj.kazakh_word_id,
            image_url=image_obj.image_url,
            image_type=image_obj.image_type,
            alt_text=image_obj.alt_text,
            is_primary=image_obj.is_primary,
            source=image_obj.source,
            license=image_obj.license,
            created_at=image_obj.created_at
        )

    class Config:
        from_attributes = True


# Example Sentence schemas
class ExampleSentenceTranslationResponse(BaseModel):
    id: int
    translated_sentence: str
    language_code: str
    created_at: datetime

    @classmethod
    def from_orm_with_language(cls, translation_obj):
        """Custom method to extract language_code from related Language object"""
        return cls(
            id=translation_obj.id,
            translated_sentence=translation_obj.translated_sentence,
            language_code=translation_obj.language.language_code,
            created_at=translation_obj.created_at
        )

    class Config:
        from_attributes = True


class ExampleSentenceBase(BaseModel):
    kazakh_sentence: str
    difficulty_level: int = Field(default=1, ge=1, le=5)
    usage_context: Optional[str] = Field(None, max_length=100)


class ExampleSentenceResponse(ExampleSentenceBase):
    id: int
    created_at: datetime
    translations: List[ExampleSentenceTranslationResponse] = []

    class Config:
        from_attributes = True


# Kazakh Word schemas
class KazakhWordBase(BaseModel):
    kazakh_word: str = Field(..., max_length=100)
    kazakh_cyrillic: Optional[str] = Field(None, max_length=100)
    word_type_id: int
    category_id: int
    difficulty_level_id: int = 1


class KazakhWordCreate(KazakhWordBase):
    pass


class KazakhWordSimpleResponse(BaseModel):
    """Simple response for word creation without nested relationships"""
    id: int
    kazakh_word: str
    kazakh_cyrillic: Optional[str] = None
    word_type_id: int
    category_id: int
    difficulty_level_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class KazakhWordResponse(BaseModel):
    id: int
    kazakh_word: str
    kazakh_cyrillic: Optional[str] = None
    created_at: datetime
    word_type: WordTypeResponse
    category: CategoryResponse
    difficulty_level: DifficultyLevelResponse
    translations: List[TranslationResponse] = []
    pronunciations: List[PronunciationResponse] = []
    images: List[WordImageResponse] = []
    example_sentences: List[ExampleSentenceResponse] = []

    class Config:
        from_attributes = True


class KazakhWordSummary(BaseModel):
    """Simplified word response for lists"""
    id: int
    kazakh_word: str
    kazakh_cyrillic: Optional[str] = None
    word_type_name: str
    category_name: str
    difficulty_level: int
    primary_translation: Optional[str] = None
    primary_image: Optional[str] = None

    class Config:
        from_attributes = True


# Search and filter schemas
class WordSearchParams(BaseModel):
    search_term: Optional[str] = None
    category_id: Optional[int] = None
    word_type_id: Optional[int] = None
    difficulty_level_id: Optional[int] = None
    language_code: str = "en"
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=20, ge=1, le=100)


class WordSearchResponse(BaseModel):
    words: List[KazakhWordSummary]
    total_count: int
    has_more: bool


# Practice schemas
class PracticeWordRequest(BaseModel):
    count: int = Field(default=10, ge=1, le=50)
    difficulty_level_id: Optional[int] = None
    category_id: Optional[int] = None
    language_code: str = "en"


class PracticeWordResponse(BaseModel):
    id: int
    kazakh_word: str
    kazakh_cyrillic: Optional[str] = None
    translation: str
    pronunciation: Optional[str] = None
    image_url: Optional[str] = None
    difficulty_level: int

    class Config:
        from_attributes = True


# Statistics schemas
class CategoryStats(BaseModel):
    category_id: int
    category_name: str
    translated_name: str
    word_count: int


class DifficultyStats(BaseModel):
    difficulty_level_id: int
    level_name: str
    translated_name: str
    word_count: int


class DatabaseStats(BaseModel):
    total_words: int
    total_categories: int
    total_languages: int
    categories: List[CategoryStats]
    difficulty_levels: List[DifficultyStats]


class WordSoundBase(BaseModel):
    sound_path: Optional[str] = Field(None, max_length=500)
    sound_url: Optional[str] = Field(None, max_length=500)
    sound_type: Optional[str] = Field(None, max_length=50)
    alt_text: Optional[str] = Field(None, max_length=200)


class WordSoundCreate(WordSoundBase):
    kazakh_word_id: int


class WordSoundResponse(BaseModel):
    id: int
    kazakh_word_id: int
    sound_url: str  # Public URL
    sound_type: Optional[str] = None
    alt_text: Optional[str] = None
    created_at: datetime

    @classmethod
    def from_attributes(cls, sound_obj):
        """Custom method to handle WordSound objects"""
        return cls(
            id=sound_obj.id,
            kazakh_word_id=sound_obj.kazakh_word_id,
            sound_url=sound_obj.sound_url,
            sound_type=sound_obj.sound_type,
            alt_text=sound_obj.alt_text,
            created_at=sound_obj.created_at
        )

    class Config:
        from_attributes = True

# Add this schema to your schemas.py file

class WordImageCreate(WordImageBase):
    """Schema for creating a new word image"""
    kazakh_word_id: int
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "kazakh_word_id": 1,
                "image_url": "D:/python/KazakhLearn/images/apple.jpg",
                "image_url": "https://example.com/images/apple.jpg",
                "image_type": "photo",
                "alt_text": "Red apple on white background",
                "is_primary": True,
                "source": "Unsplash",
                "license": "CC0"
            }
        }

# Add these schemas to your schemas.py file

# Example Sentence Create/Update schemas
class ExampleSentenceCreate(BaseModel):
    """Schema for creating a new example sentence"""
    kazakh_word_id: int = Field(..., gt=0, description="ID of the Kazakh word")
    kazakh_sentence: str = Field(..., min_length=3, max_length=500, description="Kazakh example sentence")
    difficulty_level: int = Field(default=1, ge=1, le=5, description="Difficulty level (1-5)")
    usage_context: Optional[str] = Field(None, max_length=100, description="Context where this sentence is used")

    class Config:
        json_schema_extra = {
            "example": {
                "kazakh_word_id": 1,
                "kazakh_sentence": "Мен алма жеймін.",
                "difficulty_level": 2,
                "usage_context": "daily conversation"
            }
        }


class ExampleSentenceUpdate(BaseModel):
    """Schema for updating an example sentence"""
    kazakh_sentence: Optional[str] = Field(None, min_length=3, max_length=500)
    difficulty_level: Optional[int] = Field(None, ge=1, le=5)
    usage_context: Optional[str] = Field(None, max_length=100)

    class Config:
        json_schema_extra = {
            "example": {
                "kazakh_sentence": "Мен алма жеп жатырмын.",
                "difficulty_level": 3,
                "usage_context": "present continuous"
            }
        }


# Example Sentence Translation schemas
class ExampleSentenceTranslationCreate(BaseModel):
    """Schema for creating a new example sentence translation"""
    example_sentence_id: int = Field(..., gt=0, description="ID of the example sentence")
    language_code: str = Field(..., min_length=2, max_length=5, description="Language code (e.g., 'en', 'ru')")
    translated_sentence: str = Field(..., min_length=3, max_length=500, description="Translated sentence")

    @validator('language_code')
    def validate_language_code(cls, v):
        return v.lower()

    class Config:
        json_schema_extra = {
            "example": {
                "example_sentence_id": 1,
                "language_code": "en",
                "translated_sentence": "I am eating an apple."
            }
        }


class ExampleSentenceTranslationUpdate(BaseModel):
    """Schema for updating an example sentence translation"""
    translated_sentence: str = Field(..., min_length=3, max_length=500)

    class Config:
        json_schema_extra = {
            "example": {
                "translated_sentence": "I am currently eating an apple."
            }
        }


# Detailed response schemas (updating existing ones for consistency)
class ExampleSentenceDetailResponse(ExampleSentenceBase):
    """Detailed example sentence response with word information"""
    id: int
    created_at: datetime
    translations: List[ExampleSentenceTranslationResponse] = []
    kazakh_word: Optional[Dict[str, Any]] = None  # Basic word info

    class Config:
        from_attributes = True


class ExampleSentenceListResponse(BaseModel):
    """Response for listing example sentences with pagination"""
    sentences: List[ExampleSentenceDetailResponse]
    total_count: int
    page: int
    page_size: int
    has_more: bool


# Bulk operations schemas
class BulkExampleSentenceCreate(BaseModel):
    """Schema for creating multiple example sentences at once"""
    kazakh_word_id: int = Field(..., gt=0)
    sentences: List[Dict[str, Any]] = Field(..., min_items=1, max_items=10)
    
    class Config:
        json_schema_extra = {
            "example": {
                "kazakh_word_id": 1,
                "sentences": [
                    {
                        "kazakh_sentence": "Мен алма жеймін.",
                        "difficulty_level": 1,
                        "usage_context": "simple present",
                        "translations": {
                            "en": "I eat an apple.",
                            "ru": "Я ем яблоко."
                        }
                    },
                    {
                        "kazakh_sentence": "Ол алма сатып алды.",
                        "difficulty_level": 2,
                        "usage_context": "past tense",
                        "translations": {
                            "en": "He bought an apple.",
                            "ru": "Он купил яблоко."
                        }
                    }
                ]
            }
        }


class SearchExampleSentencesRequest(BaseModel):
    """Schema for searching example sentences"""
    search_term: Optional[str] = Field(None, min_length=2, max_length=100)
    word_id: Optional[int] = Field(None, gt=0)
    difficulty_level: Optional[int] = Field(None, ge=1, le=5)
    usage_context: Optional[str] = Field(None, max_length=100)
    language_code: str = Field(default="en", min_length=2, max_length=5)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    @validator('language_code')
    def validate_language_code(cls, v):
        return v.lower()


# Statistics schemas
class ExampleSentenceStats(BaseModel):
    """Statistics about example sentences"""
    total_sentences: int
    sentences_by_difficulty: Dict[int, int]
    sentences_by_word_type: Dict[str, int]
    sentences_with_translations: int
    average_difficulty: float
    most_common_contexts: List[Dict[str, Any]]

# Add these schemas to your database/schemas.py

class PaginationInfo(BaseModel):
    """Pagination information for paginated responses"""
    current_page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=50, description="Number of items per page")
    total_pages: int = Field(..., ge=0, description="Total number of pages")
    start_index: int = Field(..., ge=0, description="Start index of current page items")
    end_index: int = Field(..., ge=0, description="End index of current page items")

class PaginatedWordsResponse(BaseModel):
    """Paginated response for words list"""
    words: List[KazakhWordSummary] = Field(..., description="List of words for current page")
    pagination: PaginationInfo = Field(..., description="Pagination information")
    total_count: int = Field(..., ge=0, description="Total number of words")
    has_next: bool = Field(..., description="Whether there are more pages")
    has_previous: bool = Field(..., description="Whether there are previous pages")
    
    class Config:
        json_schema_extra = {
            "example": {
                "words": [
                    {
                        "id": 1,
                        "kazakh_word": "алма",
                        "kazakh_cyrillic": "алма",
                        "word_type_name": "noun",
                        "category_name": "food",
                        "difficulty_level": 1,
                        "primary_translation": "apple",
                        "primary_image": "/images/words/categories/food/apple.jpg"
                    }
                ],
                "pagination": {
                    "current_page": 1,
                    "page_size": 20,
                    "total_pages": 5,
                    "start_index": 1,
                    "end_index": 20
                },
                "total_count": 95,
                "has_next": True,
                "has_previous": False
            }
        }

# Enhanced word filters with pagination
class WordFiltersRequest(BaseModel):
    """Request model for word filtering and pagination"""
    page: int = Field(default=1, ge=1, description="Page number")
    page_size: int = Field(default=20, ge=1, le=50, description="Items per page")
    search: Optional[str] = Field(None, min_length=2, max_length=100, description="Search term")
    category_id: Optional[int] = Field(None, ge=1, description="Filter by category ID")
    word_type_id: Optional[int] = Field(None, ge=1, description="Filter by word type ID")
    difficulty_level_id: Optional[int] = Field(None, ge=1, description="Filter by difficulty level ID")
    language_code: Optional[str] = Field(None, min_length=2, max_length=5, description="Language code for translations")
    
    @validator('language_code')
    def validate_language_code(cls, v):
        if v:
            return v.lower()
        return v

# Generic paginated response for reuse
class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response"""
    items: List[T]
    pagination: PaginationInfo
    total_count: int
    has_next: bool
    has_previous: bool