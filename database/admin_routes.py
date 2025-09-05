# Add these endpoints to your main.py or create a new admin_routes.py file
import asyncio
import subprocess
import sys
import traceback
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, HTTPException, BackgroundTasks, \
    Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, or_, and_, asc, desc
from typing import Dict, List, Optional, Union, Any

from sqlalchemy.sql.elements import or_

from auth.utils import create_access_token
from database import get_db
from database.models import (Category, CategoryTranslation, Language, KazakhWord, WordSound,
                             KazakhWord, WordImage, Translation, Pronunciation, WordType, DifficultyLevel,
                             ExampleSentence)
from database.crud import CategoryCRUD, LanguageCRUD
from auth.dependencies import get_current_admin
from database.auth_models import User
from database.crud import KazakhWordCRUD, TranslationCRUD, PronunciationCRUD
from database.schemas import KazakhWordCreate, KazakhWordSummary, KazakhWordSimpleResponse
from sqlalchemy.orm import joinedload, selectinload
from pathlib import Path
from PIL import Image
import logging
import os
from pydantic import BaseModel
from typing import List, Optional
from jose import jwt, JWTError  # Use jose instead of jwt

from database.learning_models import (
    LearningGuide, UserGuideProgress, GuideWordMapping,
    GuideStatus  
)


from services.translation_service import (
    translation_service, 
    TranslationRequest, 
    TranslationResult,
    translate_kazakh_word, 
    quick_translate_to_common_languages,
    translate_to_languages,
    test_translation_service
)

# Create admin router
admin_router = APIRouter(prefix="/admin", tags=["admin"])

# Pydantic models for admin endpoints
from pydantic import BaseModel


class AdminCategoryCreate(BaseModel):
    category_name: str
    description: Optional[str] = None
    is_active: bool = True
    translations: List[dict]  # [{"language_code": "en", "translated_name": "...", "translated_description": "..."}]


class AdminCategoryUpdate(BaseModel):
    category_name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    translations: Optional[List[dict]] = None


class AdminCategoryResponse(BaseModel):
    id: int
    category_name: str
    description: Optional[str]
    is_active: bool
    created_at: str
    word_count: int = 0
    translations: List[dict] = []

    class Config:
        from_attributes = True


class AdminStatsResponse(BaseModel):
    total_categories: int
    active_categories: int
    inactive_categories: int
    categories_by_word_count: List[dict]
    recent_categories: List[dict]

# Translation API schemas (updated)
class TranslateWordRequest(BaseModel):
    kazakh_word: str
    kazakh_cyrillic: Optional[str] = None
    target_language_code: str
    target_language_name: str
    context: Optional[str] = None

class QuickTranslateRequest(BaseModel):
    kazakh_word: str
    kazakh_cyrillic: Optional[str] = None
    context: Optional[str] = None

class BatchTranslateRequest(BaseModel):
    kazakh_word: str
    kazakh_cyrillic: Optional[str] = None
    target_language_codes: List[str]  # List of language codes to translate to
    context: Optional[str] = None

class TranslationResponse(BaseModel):
    primary_translation: str
    alternative_translations: List[str]
    confidence: float
    language_code: str
    language_name: str
    notes: Optional[str] = None

class QuickTranslationResponse(BaseModel):
    translations: dict[str, TranslationResponse]
    success_count: int
    total_count: int
    kazakh_word: str
    processing_time_seconds: Optional[float] = None

class BatchTranslationResponse(BaseModel):
    translations: dict[str, TranslationResponse]
    success_count: int
    total_count: int
    kazakh_word: str
    failed_languages: List[str]
    processing_time_seconds: Optional[float] = None

class TranslationServiceStatus(BaseModel):
    service_available: bool
    api_key_configured: bool
    current_model: str
    supported_languages_count: int
    available_models: List[str]
    test_results: Optional[Dict[str, Union[str, int, float, bool]]] = None
    last_test_time: Optional[str] = None

# Translation API Response Schemas (Fixed)
class TranslationServiceResponse(BaseModel):
    """Response from translation service (not database)"""
    primary_translation: str
    alternative_translations: List[str]
    confidence: float
    language_code: str
    language_name: str

class QuickTranslationServiceResponse(BaseModel):
    """Response for quick translation service"""
    translations: Dict[str, TranslationServiceResponse]
    success_count: int
    total_count: int
    kazakh_word: str
    processing_time_seconds: Optional[float] = None

class BatchTranslationServiceResponse(BaseModel):
    """Response for batch translation service"""
    translations: Dict[str, TranslationServiceResponse]
    success_count: int
    total_count: int
    kazakh_word: str
    failed_languages: List[str]
    processing_time_seconds: Optional[float] = None

class DatabaseTranslationResponse(BaseModel):
    """Response for database translation records"""
    id: int
    kazakh_word_id: int
    language_id: int
    language_code: str
    language_name: str
    translation: str
    alternative_translations: List[str]
    created_at: str

    class Config:
        from_attributes = True

# Translation Schemas
class TranslationCreateRequest(BaseModel):
    kazakh_word_id: int
    language_id: int
    translation: str
    alternative_translations: Optional[List[str]] = []

class TranslationUpdateRequest(BaseModel):
    translation: str
    alternative_translations: Optional[List[str]] = []

class TranslationResponse(BaseModel):
    id: int
    kazakh_word_id: int
    language_id: int
    language_code: str
    language_name: str
    translation: str
    alternative_translations: List[str]
    created_at: str

    class Config:
        from_attributes = True
# ===== GUIDE WORD MANAGEMENT SCHEMAS =====

class GuideWordMappingResponse(BaseModel):
    id: int
    guide_id: int
    kazakh_word_id: int
    importance_score: float
    order_in_guide: Optional[int]
    is_active: bool
    created_at: str
    
    # Word details
    kazakh_word: str
    kazakh_cyrillic: Optional[str]
    category_name: str
    difficulty_level: int
    primary_translation: Optional[str]
    
    class Config:
        from_attributes = True

class GuideWordMappingCreate(BaseModel):
    guide_id: int
    kazakh_word_id: int
    importance_score: float = 1.0
    order_in_guide: Optional[int] = None

class GuideWordMappingUpdate(BaseModel):
    importance_score: Optional[float] = None
    order_in_guide: Optional[int] = None
    is_active: Optional[bool] = None

class AddWordsToGuideRequest(BaseModel):
    word_ids: List[int]
    importance_score: float = 1.0
    auto_order: bool = True  # Automatically assign order_in_guide

class GuideWithWordsResponse(BaseModel):
    id: int
    guide_key: str
    title: str
    description: Optional[str]
    difficulty_level: str
    target_word_count: int
    current_word_count: int
    is_active: bool
    words: List[GuideWordMappingResponse]
    
    class Config:
        from_attributes = True

# ===== GUIDE WORD MANAGEMENT ENDPOINTS =====

# ===== ADMIN CATEGORY ENDPOINTS =====

# Also add an endpoint to get filter options
@admin_router.get("/words/filter-options")
async def get_word_filter_options(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Get available filter options for words (admin only)"""

    try:
        # Get categories
        categories_result = await db.execute(
            select(Category.id, Category.category_name)
            .where(Category.is_active == True)
            .order_by(Category.category_name)
        )
        categories = [
            {"id": cat.id, "name": cat.category_name}
            for cat in categories_result.all()
        ]

        # Get word types
        word_types_result = await db.execute(
            select(WordType.id, WordType.type_name)
            .where(WordType.is_active == True)
            .order_by(WordType.type_name)
        )
        word_types = [
            {"id": wt.id, "name": wt.type_name}
            for wt in word_types_result.all()
        ]

        # Get difficulty levels
        difficulty_levels_result = await db.execute(
            select(DifficultyLevel.id, DifficultyLevel.level_number, DifficultyLevel.level_name)
            .where(DifficultyLevel.is_active == True)
            .order_by(DifficultyLevel.level_number)
        )
        difficulty_levels = [
            {
                "id": dl.id,
                "level_number": dl.level_number,
                "name": f"Level {dl.level_number} - {dl.level_name}"
            }
            for dl in difficulty_levels_result.all()
        ]

        return {
            "categories": categories,
            "word_types": word_types,
            "difficulty_levels": difficulty_levels
        }

    except Exception as e:
        logger.error(f"Error getting filter options: {e}")
        raise HTTPException(status_code=500, detail="Failed to get filter options")


# Add an endpoint to get total count for pagination
@admin_router.get("/words/count")
async def get_words_count(
    category_id: Optional[int] = Query(None),
    word_type_id: Optional[int] = Query(None),
    difficulty_level_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    language_code: str = Query("en"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Get total count of words matching filters (admin only)"""

    try:
        # Build the same query as get_admin_words but just count
        query = select(func.count(KazakhWord.id))

        # Apply the same filters
        conditions = []

        if category_id:
            conditions.append(KazakhWord.category_id == category_id)

        if word_type_id:
            conditions.append(KazakhWord.word_type_id == word_type_id)

        if difficulty_level_id:
            conditions.append(KazakhWord.difficulty_level_id == difficulty_level_id)

        if search:
            search_term = f"%{search.lower()}%"
            search_conditions = [
                KazakhWord.kazakh_word.ilike(search_term),
                KazakhWord.kazakh_cyrillic.ilike(search_term)
            ]

            # Search in translations
            translation_subquery = (
                select(Translation.kazakh_word_id)
                .join(Language)
                .where(
                    and_(
                        Translation.translation.ilike(search_term),
                        Language.language_code == language_code
                    )
                )
            )
            search_conditions.append(KazakhWord.id.in_(translation_subquery))

            # Search in category names
            search_conditions.append(
                KazakhWord.category_id.in_(
                    select(Category.id).where(Category.category_name.ilike(search_term))
                )
            )

            # Search in word type names
            search_conditions.append(
                KazakhWord.word_type_id.in_(
                    select(WordType.id).where(WordType.type_name.ilike(search_term))
                )
            )

            conditions.append(or_(*search_conditions))

        if conditions:
            query = query.where(and_(*conditions))

        result = await db.execute(query)
        total_count = result.scalar() or 0

        return {"total_count": total_count}

    except Exception as e:
        logger.error(f"Error getting words count: {e}")
        raise HTTPException(status_code=500, detail="Failed to get words count")

@admin_router.post("/categories", response_model=AdminCategoryResponse)
async def create_category_with_translations(
        category_data: AdminCategoryCreate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Create a new category with translations (admin only)"""

    # Create the base category
    from database.models import Category
    new_category = Category(
        category_name=category_data.category_name,
        description=category_data.description,
        is_active=category_data.is_active
    )

    db.add(new_category)
    await db.flush()  # Get the ID without committing

    # Create translations
    for translation_data in category_data.translations:
        if translation_data.get('translated_name'):  # Only create if name provided
            # Get language by code
            language = await LanguageCRUD.get_by_code(db, translation_data['language_code'])
            if language:
                from database.models import CategoryTranslation
                translation = CategoryTranslation(
                    category_id=new_category.id,
                    language_id=language.id,
                    translated_name=translation_data['translated_name'],
                    translated_description=translation_data.get('translated_description')
                )
                db.add(translation)

    await db.commit()
    await db.refresh(new_category)

    # Get category with translations for response
    result = await db.execute(
        select(Category)
        .options(selectinload(Category.translations).joinedload(CategoryTranslation.language))
        .where(Category.id == new_category.id)
    )
    category_with_translations = result.scalar_one()

    # Get word count
    word_count_result = await db.execute(
        select(func.count(KazakhWord.id)).where(KazakhWord.category_id == new_category.id)
    )
    word_count = word_count_result.scalar() or 0

    return AdminCategoryResponse(
        id=category_with_translations.id,
        category_name=category_with_translations.category_name,
        description=category_with_translations.description,
        is_active=category_with_translations.is_active,
        created_at=category_with_translations.created_at.isoformat(),
        word_count=word_count,
        translations=[
            {
                "id": t.id,
                "language_code": t.language.language_code,
                "translated_name": t.translated_name,
                "translated_description": t.translated_description
            } for t in category_with_translations.translations
        ]
    )


@admin_router.put("/categories/{category_id}", response_model=AdminCategoryResponse)
async def update_category_with_translations(
        category_id: int,
        category_data: AdminCategoryUpdate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Update category with translations (admin only)"""

    # Get existing category
    result = await db.execute(
        select(Category)
        .options(selectinload(Category.translations).joinedload(CategoryTranslation.language))
        .where(Category.id == category_id)
    )
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Update basic category fields
    if category_data.category_name is not None:
        category.category_name = category_data.category_name
    if category_data.description is not None:
        category.description = category_data.description
    if category_data.is_active is not None:
        category.is_active = category_data.is_active

    # Update translations if provided
    if category_data.translations is not None:
        for translation_data in category_data.translations:
            language = await LanguageCRUD.get_by_code(db, translation_data['language_code'])
            if not language:
                continue

            # Find existing translation
            existing_translation = next(
                (t for t in category.translations if t.language_id == language.id),
                None
            )

            if existing_translation:
                # Update existing translation
                existing_translation.translated_name = translation_data.get('translated_name', '')
                existing_translation.translated_description = translation_data.get('translated_description', '')
            else:
                # Create new translation if name provided
                if translation_data.get('translated_name'):
                    new_translation = CategoryTranslation(
                        category_id=category_id,
                        language_id=language.id,
                        translated_name=translation_data['translated_name'],
                        translated_description=translation_data.get('translated_description')
                    )
                    db.add(new_translation)

    await db.commit()
    await db.refresh(category)

    # Get word count
    word_count_result = await db.execute(
        select(func.count(KazakhWord.id)).where(KazakhWord.category_id == category_id)
    )
    word_count = word_count_result.scalar() or 0

    return AdminCategoryResponse(
        id=category.id,
        category_name=category.category_name,
        description=category.description,
        is_active=category.is_active,
        created_at=category.created_at.isoformat(),
        word_count=word_count,
        translations=[
            {
                "id": t.id,
                "language_code": t.language.language_code,
                "translated_name": t.translated_name,
                "translated_description": t.translated_description
            } for t in category.translations
        ]
    )


@admin_router.delete("/categories/{category_id}")
async def delete_category(
        category_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Delete category (admin only)"""

    # Check if category has words
    word_count_result = await db.execute(
        select(func.count(KazakhWord.id)).where(KazakhWord.category_id == category_id)
    )
    word_count = word_count_result.scalar() or 0

    if word_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete category with {word_count} words. Move or delete words first."
        )

    # Delete category (translations will be deleted via cascade)
    result = await db.execute(
        delete(Category).where(Category.id == category_id)
    )

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Category not found")

    await db.commit()
    return {"success": True, "message": "Category deleted successfully"}


@admin_router.patch("/categories/{category_id}/status")
async def toggle_category_status(
        category_id: int,
        is_active: bool = Query(...),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Toggle category active status (admin only)"""

    result = await db.execute(
        update(Category)
        .where(Category.id == category_id)
        .values(is_active=is_active)
        .returning(Category)
    )

    updated_category = result.scalar_one_or_none()
    if not updated_category:
        raise HTTPException(status_code=404, detail="Category not found")

    await db.commit()

    return {
        "id": updated_category.id,
        "category_name": updated_category.category_name,
        "is_active": updated_category.is_active
    }


@admin_router.patch("/categories/bulk")
async def bulk_update_categories(
        update_data: dict,  # {"category_ids": [1, 2, 3], "is_active": true}
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Bulk update categories (admin only)"""

    category_ids = update_data.get('category_ids', [])
    updates = {k: v for k, v in update_data.items() if k != 'category_ids'}

    if not category_ids or not updates:
        raise HTTPException(status_code=400, detail="Invalid update data")

    result = await db.execute(
        update(Category)
        .where(Category.id.in_(category_ids))
        .values(**updates)
    )

    await db.commit()

    return {
        "success": True,
        "updated_count": result.rowcount,
        "message": f"Updated {result.rowcount} categories"
    }


@admin_router.delete("/categories/bulk")
async def bulk_delete_categories(
        delete_data: dict,  # {"category_ids": [1, 2, 3]}
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Bulk delete categories (admin only)"""

    category_ids = delete_data.get('category_ids', [])

    if not category_ids:
        raise HTTPException(status_code=400, detail="No category IDs provided")

    # Check if any categories have words
    word_count_result = await db.execute(
        select(
            KazakhWord.category_id,
            func.count(KazakhWord.id).label('word_count')
        )
        .where(KazakhWord.category_id.in_(category_ids))
        .group_by(KazakhWord.category_id)
    )

    categories_with_words = word_count_result.all()
    if categories_with_words:
        return {
            "success": False,
            "message": "Cannot delete categories that contain words",
            "categories_with_words": [
                {"category_id": row.category_id, "word_count": row.word_count}
                for row in categories_with_words
            ]
        }

    # Delete categories
    result = await db.execute(
        delete(Category).where(Category.id.in_(category_ids))
    )

    await db.commit()

    return {
        "success": True,
        "deleted_count": result.rowcount,
        "message": f"Deleted {result.rowcount} categories"
    }


# ===== ADMIN STATISTICS ENDPOINTS =====

@admin_router.get("/stats/categories", response_model=AdminStatsResponse)
async def get_admin_category_stats(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Get admin dashboard statistics (admin only)"""

    # Total categories
    total_result = await db.execute(select(func.count(Category.id)))
    total_categories = total_result.scalar() or 0

    # Active/Inactive categories
    active_result = await db.execute(
        select(func.count(Category.id)).where(Category.is_active == True)
    )
    active_categories = active_result.scalar() or 0

    inactive_categories = total_categories - active_categories

    # Categories by word count
    word_count_result = await db.execute(
        select(
            Category.id,
            Category.category_name,
            func.count(KazakhWord.id).label('word_count')
        )
        .outerjoin(KazakhWord, Category.id == KazakhWord.category_id)
        .group_by(Category.id, Category.category_name)
        .order_by(func.count(KazakhWord.id).desc())
        .limit(10)
    )

    categories_by_word_count = [
        {
            "category_id": row.id,
            "category_name": row.category_name,
            "word_count": row.word_count
        }
        for row in word_count_result.all()
    ]

    # Recent categories
    recent_result = await db.execute(
        select(Category)
        .order_by(Category.created_at.desc())
        .limit(5)
    )

    recent_categories = [
        {
            "id": cat.id,
            "category_name": cat.category_name,
            "created_at": cat.created_at.isoformat(),
            "is_active": cat.is_active
        }
        for cat in recent_result.scalars().all()
    ]

    return AdminStatsResponse(
        total_categories=total_categories,
        active_categories=active_categories,
        inactive_categories=inactive_categories,
        categories_by_word_count=categories_by_word_count,
        recent_categories=recent_categories
    )


class AdminWordUpdate(BaseModel):
    kazakh_word: Optional[str] = None
    kazakh_cyrillic: Optional[str] = None
    word_type_id: Optional[int] = None
    category_id: Optional[int] = None
    difficulty_level_id: Optional[int] = None


class AdminWordResponse(BaseModel):
    id: int
    kazakh_word: str
    kazakh_cyrillic: Optional[str]
    word_type_id: int
    category_id: int
    difficulty_level_id: int
    word_type_name: str
    category_name: str
    difficulty_level: int
    primary_translation: Optional[str]
    translation_count: int = 0
    created_at: str

    class Config:
        from_attributes = True


class AdminWordStatsResponse(BaseModel):
    total_words: int
    words_by_category: List[dict]
    words_by_difficulty: List[dict]
    words_by_type: List[dict]
    words_without_translations: int
    words_without_images: int
    recent_words: List[dict]


# ===== ADMIN WORD ENDPOINTS =====

@admin_router.get("/words", response_model=List[AdminWordResponse])
async def get_admin_words(
        skip: int = Query(0, ge=0),
        limit: int = Query(100, ge=1, le=1000),
        category_id: Optional[int] = Query(None),
        word_type_id: Optional[int] = Query(None),
        difficulty_level_id: Optional[int] = Query(None),
        search: Optional[str] = Query(None),
        language_code: str = Query("en"),
        sort_by: str = Query("kazakh_word"),
        sort_direction: str = Query("asc"),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Get all words with admin details and server-side filtering (admin only)"""
    
    try:
        # Build the base query with all necessary joins
        query = (
            select(KazakhWord)
            .options(
                joinedload(KazakhWord.word_type),
                joinedload(KazakhWord.category),
                joinedload(KazakhWord.difficulty_level),
                selectinload(KazakhWord.translations).joinedload(Translation.language),
                selectinload(KazakhWord.images)
            )
        )
        
        # Apply filters
        conditions = []
        
        # Category filter
        if category_id:
            conditions.append(KazakhWord.category_id == category_id)
        
        # Word type filter
        if word_type_id:
            conditions.append(KazakhWord.word_type_id == word_type_id)
        
        # Difficulty level filter
        if difficulty_level_id:
            conditions.append(KazakhWord.difficulty_level_id == difficulty_level_id)
        
        # Search filter - search in Kazakh word, Cyrillic, and translations
        if search:
            search_term = f"%{search.lower()}%"
            search_conditions = [
                KazakhWord.kazakh_word.ilike(search_term),
                KazakhWord.kazakh_cyrillic.ilike(search_term)
            ]
            
            # Also search in translations
            translation_subquery = (
                select(Translation.kazakh_word_id)
                .join(Language)
                .where(
                    and_(
                        Translation.translation.ilike(search_term),
                        Language.language_code == language_code
                    )
                )
            )
            search_conditions.append(KazakhWord.id.in_(translation_subquery))
            
            # Also search in category names
            search_conditions.append(
                KazakhWord.category_id.in_(
                    select(Category.id).where(Category.category_name.ilike(search_term))
                )
            )
            
            # Also search in word type names
            search_conditions.append(
                KazakhWord.word_type_id.in_(
                    select(WordType.id).where(WordType.type_name.ilike(search_term))
                )
            )
            
            conditions.append(or_(*search_conditions))
        
        # Apply all conditions
        if conditions:
            query = query.where(and_(*conditions))
        
        # Apply sorting
        sort_column = None
        if sort_by == "kazakh_word":
            sort_column = KazakhWord.kazakh_word
        elif sort_by == "category_name":
            query = query.join(Category, KazakhWord.category_id == Category.id)
            sort_column = Category.category_name
        elif sort_by == "word_type_name":
            query = query.join(WordType, KazakhWord.word_type_id == WordType.id)
            sort_column = WordType.type_name
        elif sort_by == "difficulty_level":
            query = query.join(DifficultyLevel, KazakhWord.difficulty_level_id == DifficultyLevel.id)
            sort_column = DifficultyLevel.level_number
        elif sort_by == "created_at":
            sort_column = KazakhWord.created_at
        else:
            # Default to kazakh_word
            sort_column = KazakhWord.kazakh_word
        
        if sort_column is not None:
            if sort_direction.lower() == "desc":
                query = query.order_by(sort_column.desc())
            else:
                query = query.order_by(sort_column.asc())
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        # Execute query
        result = await db.execute(query)
        words = result.scalars().all()
        
        # Convert to admin response format
        admin_words = []
        for word in words:
            # Get primary translation for the specified language
            primary_translation = None
            translation_count = 0
            
            if word.translations:
                # Filter translations by language
                filtered_translations = [
                    t for t in word.translations 
                    if t.language.language_code == language_code
                ]
                if filtered_translations:
                    primary_translation = filtered_translations[0].translation
                translation_count = len(word.translations)
            
            admin_word = AdminWordResponse(
                id=word.id,
                kazakh_word=word.kazakh_word,
                kazakh_cyrillic=word.kazakh_cyrillic,
                word_type_id=word.word_type_id,
                category_id=word.category_id,
                difficulty_level_id=word.difficulty_level_id,
                word_type_name=word.word_type.type_name if word.word_type else 'Unknown',
                category_name=word.category.category_name if word.category else 'Unknown',
                difficulty_level=word.difficulty_level.level_number if word.difficulty_level else 1,
                primary_translation=primary_translation,
                translation_count=translation_count,
                created_at=word.created_at.isoformat()
            )
            admin_words.append(admin_word)
        
        return admin_words
        
    except Exception as e:
        logger.error(f"Error in get_admin_words: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to fetch words: {str(e)}")


@admin_router.get("/words/{word_id}", response_model=AdminWordResponse)
async def get_admin_word(
        word_id: int,
        language_code: str = Query("en"),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Get word details for admin (admin only)"""

    word = await KazakhWordCRUD.get_by_id_full(db, word_id, language_code)
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    primary_translation = word.translations[0].translation if word.translations else None

    return AdminWordResponse(
        id=word.id,
        kazakh_word=word.kazakh_word,
        kazakh_cyrillic=word.kazakh_cyrillic,
        word_type_id=word.word_type_id,
        category_id=word.category_id,
        difficulty_level_id=word.difficulty_level_id,
        word_type_name=word.word_type.type_name,
        category_name=word.category.category_name,
        difficulty_level=word.difficulty_level.level_number,
        primary_translation=primary_translation,
        translation_count=len(word.translations),
        created_at=word.created_at.isoformat()
    )


@admin_router.put("/words/{word_id}", response_model=AdminWordResponse)
async def update_word(
        word_id: int,
        word_data: AdminWordUpdate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Update word (admin only)"""

    # Check if word exists
    existing_word = await KazakhWordCRUD.get_by_id(db, word_id)
    if not existing_word:
        raise HTTPException(status_code=404, detail="Word not found")

    # Update word fields
    update_data = {}
    if word_data.kazakh_word is not None:
        update_data["kazakh_word"] = word_data.kazakh_word
    if word_data.kazakh_cyrillic is not None:
        update_data["kazakh_cyrillic"] = word_data.kazakh_cyrillic
    if word_data.word_type_id is not None:
        update_data["word_type_id"] = word_data.word_type_id
    if word_data.category_id is not None:
        update_data["category_id"] = word_data.category_id
    if word_data.difficulty_level_id is not None:
        update_data["difficulty_level_id"] = word_data.difficulty_level_id

    if update_data:
        result = await db.execute(
            update(KazakhWord)
            .where(KazakhWord.id == word_id)
            .values(**update_data)
            .returning(KazakhWord)
        )
        updated_word = result.scalar_one()
        await db.commit()
    else:
        updated_word = existing_word

    # Get full word details for response
    full_word = await KazakhWordCRUD.get_by_id_full(db, word_id, "en")
    primary_translation = full_word.translations[0].translation if full_word.translations else None

    return AdminWordResponse(
        id=full_word.id,
        kazakh_word=full_word.kazakh_word,
        kazakh_cyrillic=full_word.kazakh_cyrillic,
        word_type_id=full_word.word_type_id,
        category_id=full_word.category_id,
        difficulty_level_id=full_word.difficulty_level_id,
        word_type_name=full_word.word_type.type_name,
        category_name=full_word.category.category_name,
        difficulty_level=full_word.difficulty_level.level_number,
        primary_translation=primary_translation,
        translation_count=len(full_word.translations),
        created_at=full_word.created_at.isoformat()
    )


@admin_router.delete("/words/{word_id}")
async def delete_word(
        word_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Delete word (admin only)"""

    # Check if word exists
    existing_word = await KazakhWordCRUD.get_by_id(db, word_id)
    if not existing_word:
        raise HTTPException(status_code=404, detail="Word not found")

    # Check if word has learning progress (optional - you might want to prevent deletion)
    progress_result = await db.execute(
        select(func.count(UserWordProgress.id))
        .where(UserWordProgress.kazakh_word_id == word_id)
    )
    progress_count = progress_result.scalar() or 0

    if progress_count > 0:
        return {
            "success": False,
            "message": f"Cannot delete word with {progress_count} user progress records. Consider archiving instead.",
            "progress_count": progress_count
        }

    # Delete word (cascade will handle related records)
    result = await db.execute(
        delete(KazakhWord).where(KazakhWord.id == word_id)
    )

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Word not found")

    await db.commit()
    return {"success": True, "message": "Word deleted successfully"}


@admin_router.patch("/words/{word_id}/status")
async def toggle_word_status(
        word_id: int,
        is_active: bool = Query(...),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Toggle word active status (admin only)"""

    # Note: Your current KazakhWord model doesn't have is_active field
    # This is a placeholder for when you add it

    result = await db.execute(
        select(KazakhWord).where(KazakhWord.id == word_id)
    )
    word = result.scalar_one_or_none()

    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    # For now, just return success since is_active field doesn't exist yet
    return {
        "success": True,
        "message": f"Word status update not implemented yet. Add is_active field to KazakhWord model.",
        "word_id": word_id,
        "requested_status": is_active
    }


@admin_router.patch("/words/bulk")
async def bulk_update_words(
        update_data: dict,  # {"word_ids": [1, 2, 3], "category_id": 5}
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Bulk update words (admin only)"""

    word_ids = update_data.get('word_ids', [])
    updates = {k: v for k, v in update_data.items() if k != 'word_ids'}

    if not word_ids or not updates:
        raise HTTPException(status_code=400, detail="Invalid update data")

    # Validate that updates contain only allowed fields
    allowed_fields = ['category_id', 'word_type_id', 'difficulty_level_id']
    invalid_fields = [k for k in updates.keys() if k not in allowed_fields]
    if invalid_fields:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid fields for bulk update: {invalid_fields}"
        )

    result = await db.execute(
        update(KazakhWord)
        .where(KazakhWord.id.in_(word_ids))
        .values(**updates)
    )

    await db.commit()

    return {
        "success": True,
        "updated_count": result.rowcount,
        "message": f"Updated {result.rowcount} words"
    }


@admin_router.delete("/words/bulk")
async def bulk_delete_words(
        delete_data: dict,  # {"word_ids": [1, 2, 3]}
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Bulk delete words (admin only)"""

    word_ids = delete_data.get('word_ids', [])

    if not word_ids:
        raise HTTPException(status_code=400, detail="No word IDs provided")

    # Check for learning progress
    progress_result = await db.execute(
        select(
            UserWordProgress.kazakh_word_id,
            func.count(UserWordProgress.id).label('progress_count')
        )
        .where(UserWordProgress.kazakh_word_id.in_(word_ids))
        .group_by(UserWordProgress.kazakh_word_id)
    )

    words_with_progress = progress_result.all()
    if words_with_progress:
        return {
            "success": False,
            "message": "Cannot delete words with user progress",
            "words_with_progress": [
                {"word_id": row.kazakh_word_id, "progress_count": row.progress_count}
                for row in words_with_progress
            ]
        }

    # Delete words
    result = await db.execute(
        delete(KazakhWord).where(KazakhWord.id.in_(word_ids))
    )

    await db.commit()

    return {
        "success": True,
        "deleted_count": result.rowcount,
        "message": f"Deleted {result.rowcount} words"
    }


# ===== ADMIN WORD STATISTICS =====

@admin_router.get("/words/statistics", response_model=AdminWordStatsResponse)
async def get_word_statistics(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Get word statistics (admin only)"""

    # Total words
    total_result = await db.execute(select(func.count(KazakhWord.id)))
    total_words = total_result.scalar() or 0

    # Words by category
    category_result = await db.execute(
        select(
            Category.id,
            Category.category_name,
            func.count(KazakhWord.id).label('word_count')
        )
        .outerjoin(KazakhWord, Category.id == KazakhWord.category_id)
        .group_by(Category.id, Category.category_name)
        .order_by(func.count(KazakhWord.id).desc())
    )

    words_by_category = [
        {
            "category_id": row.id,
            "category_name": row.category_name,
            "word_count": row.word_count
        }
        for row in category_result.all()
    ]

    # Words by difficulty
    difficulty_result = await db.execute(
        select(
            DifficultyLevel.level_number,
            DifficultyLevel.level_name,
            func.count(KazakhWord.id).label('word_count')
        )
        .outerjoin(KazakhWord, DifficultyLevel.id == KazakhWord.difficulty_level_id)
        .group_by(DifficultyLevel.level_number, DifficultyLevel.level_name)
        .order_by(DifficultyLevel.level_number)
    )

    words_by_difficulty = [
        {
            "difficulty_level": row.level_number,
            "level_name": row.level_name,
            "word_count": row.word_count
        }
        for row in difficulty_result.all()
    ]

    # Words by type
    type_result = await db.execute(
        select(
            WordType.type_name,
            func.count(KazakhWord.id).label('word_count')
        )
        .outerjoin(KazakhWord, WordType.id == KazakhWord.word_type_id)
        .group_by(WordType.type_name)
        .order_by(func.count(KazakhWord.id).desc())
    )

    words_by_type = [
        {
            "word_type": row.type_name,
            "word_count": row.word_count
        }
        for row in type_result.all()
    ]

    # Words without translations
    no_translations_result = await db.execute(
        select(func.count(KazakhWord.id))
        .outerjoin(Translation, KazakhWord.id == Translation.kazakh_word_id)
        .where(Translation.id.is_(None))
    )
    words_without_translations = no_translations_result.scalar() or 0

    # Words without images
    no_images_result = await db.execute(
        select(func.count(KazakhWord.id))
        .outerjoin(WordImage, KazakhWord.id == WordImage.kazakh_word_id)
        .where(WordImage.id.is_(None))
    )
    words_without_images = no_images_result.scalar() or 0

    # Recent words
    recent_result = await db.execute(
        select(KazakhWord)
        .options(
            joinedload(KazakhWord.category),
            selectinload(KazakhWord.translations)
        )
        .order_by(KazakhWord.created_at.desc())
        .limit(5)
    )

    recent_words = [
        {
            "id": word.id,
            "kazakh_word": word.kazakh_word,
            "category_name": word.category.category_name if word.category else "Unknown",
            "created_at": word.created_at.isoformat(),
            "translation_count": len(word.translations) if word.translations else 0
        }
        for word in recent_result.scalars().all()
    ]

    return AdminWordStatsResponse(
        total_words=total_words,
        words_by_category=words_by_category,
        words_by_difficulty=words_by_difficulty,
        words_by_type=words_by_type,
        words_without_translations=words_without_translations,
        words_without_images=words_without_images,
        recent_words=recent_words
    )


@admin_router.get("/words/needs-attention")
async def get_words_needing_attention(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Get words that need admin attention (admin only)"""

    # Words without translations
    no_translations = await db.execute(
        select(KazakhWord)
        .options(joinedload(KazakhWord.category))
        .outerjoin(Translation, KazakhWord.id == Translation.kazakh_word_id)
        .where(Translation.id.is_(None))
        .limit(10)
    )

    # Words without images
    no_images = await db.execute(
        select(KazakhWord)
        .options(joinedload(KazakhWord.category))
        .outerjoin(WordImage, KazakhWord.id == WordImage.kazakh_word_id)
        .where(WordImage.id.is_(None))
        .limit(10)
    )

    # Words without pronunciations
    no_pronunciations = await db.execute(
        select(KazakhWord)
        .options(joinedload(KazakhWord.category))
        .outerjoin(Pronunciation, KazakhWord.id == Pronunciation.kazakh_word_id)
        .where(Pronunciation.id.is_(None))
        .limit(10)
    )

    def format_word_list(words):
        return [
            {
                "id": word.id,
                "kazakh_word": word.kazakh_word,
                "category_name": word.category.category_name if word.category else "Unknown",
                "created_at": word.created_at.isoformat()
            }
            for word in words
        ]

    return {
        "missing_translations": format_word_list(no_translations.scalars().all()),
        "missing_images": format_word_list(no_images.scalars().all()),
        "missing_pronunciations": format_word_list(no_pronunciations.scalars().all())
    }

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Media file management configuration
MEDIA_BASE_PATH = Path("../kazakh-learn-frontend/public")
IMAGES_PATH = MEDIA_BASE_PATH / "images" / "words" / "categories"
AUDIO_PATH = MEDIA_BASE_PATH / "audio" / "words" / "categories"

# Allowed file types
ALLOWED_IMAGE_TYPES = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
ALLOWED_AUDIO_TYPES = {'.mp3', '.wav', '.ogg', '.m4a'}


class MediaFileManager:
    @staticmethod
    def is_valid_audio(file_extension: str) -> bool:
        """Check if file extension is valid for audio - THIS WAS MISSING!"""
        return file_extension in ALLOWED_AUDIO_TYPES
    def ensure_directory_exists(path: Path):
        """Create directory if it doesn't exist"""
        try:
            path.mkdir(parents=True, exist_ok=True)
            logger.info(f"Directory ensured: {path}")
        except Exception as e:
            logger.error(f"Failed to create directory {path}: {e}")
            raise

    @staticmethod
    def get_file_extension(filename: str) -> str:
        """Get file extension in lowercase"""
        return Path(filename).suffix.lower()

    @staticmethod
    def is_valid_image(file_extension: str) -> bool:
        """Check if file extension is valid for images"""
        return file_extension in ALLOWED_IMAGE_TYPES

    @staticmethod
    def generate_filename(word_id: int, original_filename: str, is_audio: bool = False) -> str:
        """Generate standardized filename"""
        extension = MediaFileManager.get_file_extension(original_filename)
        return f"{word_id}{extension}"

    @staticmethod
    def get_category_path(category_id: int, is_audio: bool = False) -> Path:
        """Get the directory path for a category"""
        base_path = AUDIO_PATH if is_audio else IMAGES_PATH
        return base_path / str(category_id)

    @staticmethod
    async def save_image_file(
            file: UploadFile,
            word_id: int,
            category_id: int,
            max_size: tuple = (1200, 1200),
            quality: int = 85
    ) -> tuple[str, str]:
        """Save image file with optimization"""

        logger.info(f"=== IMAGE UPLOAD DEBUG ===")
        logger.info(f"File: {file.filename}, content_type: {file.content_type}")

        try:
            # Validate file type
            file_extension = MediaFileManager.get_file_extension(file.filename or "")
            logger.info(f"File extension: {file_extension}")

            if not MediaFileManager.is_valid_image(file_extension):
                logger.error(f"Invalid image type: {file_extension}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid image type. Allowed types: {', '.join(ALLOWED_IMAGE_TYPES)}"
                )

            # Read file content
            logger.info("Reading image file content...")
            content = await file.read()
            logger.info(f"Image file size: {len(content)} bytes")

            # Validate file size (5MB max)
            if len(content) > 5 * 1024 * 1024:
                logger.error(f"Image file too large: {len(content)} bytes")
                raise HTTPException(status_code=400, detail="Image file too large (max 5MB)")

            # Generate paths
            category_dir = MediaFileManager.get_category_path(category_id, is_audio=False)
            logger.info(f"Image category directory: {category_dir}")
            logger.info(f"Image category directory absolute: {category_dir.absolute()}")

            MediaFileManager.ensure_directory_exists(category_dir)

            filename = MediaFileManager.generate_filename(word_id, file.filename or "", is_audio=False)
            file_path = category_dir / filename
            logger.info(f"Image file path: {file_path}")
            logger.info(f"Image file path absolute: {file_path.absolute()}")

            # Process and save image
            try:
                from PIL import Image
                import io

                # Open and process image
                image = Image.open(io.BytesIO(content))

                # Convert to RGB if necessary (for JPEG compatibility)
                if image.mode in ('RGBA', 'LA', 'P'):
                    background = Image.new('RGB', image.size, (255, 255, 255))
                    if image.mode == 'P':
                        image = image.convert('RGBA')
                    background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                    image = background

                # Resize if too large
                if image.size[0] > max_size[0] or image.size[1] > max_size[1]:
                    image.thumbnail(max_size, Image.Resampling.LANCZOS)
                    logger.info(f"Image resized to: {image.size}")

                # Save optimized image
                if file_extension.lower() == '.png':
                    image.save(file_path, 'PNG', optimize=True)
                else:
                    # Save as JPEG for other formats
                    if file_path.suffix.lower() != '.jpg':
                        file_path = file_path.with_suffix('.jpg')
                        filename = file_path.name
                    image.save(file_path, 'JPEG', quality=quality, optimize=True)

                logger.info(f"✅ Image file saved successfully")

                # Verify file was saved
                if file_path.exists():
                    saved_size = file_path.stat().st_size
                    logger.info(f"Image file verification: exists={file_path.exists()}, size={saved_size}")
                else:
                    logger.error(f"❌ Image file not found after save")

            except ImportError:
                # Fallback: save without processing if PIL not available
                logger.warning("PIL not available, saving image without processing")
                with open(file_path, 'wb') as f:
                    f.write(content)
            except Exception as save_error:
                logger.error(f"❌ Image file save failed: {save_error}")
                raise HTTPException(status_code=500, detail=f"Failed to save image file: {str(save_error)}")

            # Generate URL
            file_url = MediaFileManager.get_file_url(category_id, filename, is_audio=False)
            logger.info(f"Generated image URL: {file_url}")

            return str(file_path), file_url

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error in save_image_file: {e}")
            logger.error(traceback.format_exc())
            raise HTTPException(status_code=500, detail=f"Failed to process image file: {str(e)}")


    @staticmethod
    def get_file_url(category_id: int, filename: str, is_audio: bool = False) -> str:
        """Generate the public URL for a file"""
        media_type = "audio" if is_audio else "images"
        return f"/{media_type}/words/categories/{category_id}/{filename}"

    @staticmethod
    async def save_audio_file(
        file: UploadFile,
        word_id: int,
        category_id: int
    ) -> tuple[str, str]:
        """Save audio file with better error handling"""
        
        logger.info(f"=== AUDIO UPLOAD DEBUG ===")
        logger.info(f"File: {file.filename}, content_type: {file.content_type}")
        
        try:
            # Validate file type
            file_extension = MediaFileManager.get_file_extension(file.filename or "")
            logger.info(f"File extension: {file_extension}")
            
            if not MediaFileManager.is_valid_audio(file_extension):
                logger.error(f"Invalid audio type: {file_extension}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid audio type. Allowed types: {', '.join(ALLOWED_AUDIO_TYPES)}"
                )

            # Read file content
            logger.info("Reading audio file content...")
            content = await file.read()
            logger.info(f"Audio file size: {len(content)} bytes")
            
            # Validate file size (10MB max)
            if len(content) > 10 * 1024 * 1024:
                logger.error(f"Audio file too large: {len(content)} bytes")
                raise HTTPException(status_code=400, detail="Audio file too large (max 10MB)")

            # Generate paths
            category_dir = MediaFileManager.get_category_path(category_id, is_audio=True)
            logger.info(f"Audio category directory: {category_dir}")
            logger.info(f"Audio category directory absolute: {category_dir.absolute()}")
            
            MediaFileManager.ensure_directory_exists(category_dir)
            
            filename = MediaFileManager.generate_filename(word_id, file.filename or "", is_audio=True)
            file_path = category_dir / filename
            logger.info(f"Audio file path: {file_path}")
            logger.info(f"Audio file path absolute: {file_path.absolute()}")
            
            # Save audio file
            try:
                with open(file_path, 'wb') as f:
                    f.write(content)
                logger.info(f"✅ Audio file saved successfully")
                
                # Verify file was saved
                if file_path.exists():
                    saved_size = file_path.stat().st_size
                    logger.info(f"Audio file verification: exists={file_path.exists()}, size={saved_size}")
                else:
                    logger.error(f"❌ Audio file not found after save")
                    
            except Exception as save_error:
                logger.error(f"❌ Audio file save failed: {save_error}")
                raise HTTPException(status_code=500, detail=f"Failed to save audio file: {str(save_error)}")

            # Generate URL
            file_url = MediaFileManager.get_file_url(category_id, filename, is_audio=True)
            logger.info(f"Generated audio URL: {file_url}")
            
            return str(file_path), file_url
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error in save_audio_file: {e}")
            logger.error(traceback.format_exc())
            raise HTTPException(status_code=500, detail=f"Failed to process audio file: {str(e)}")

    @staticmethod
    async def save_audio_file(
        file: UploadFile,
        word_id: int,
        category_id: int
    ) -> tuple[str, str]:
        """Save audio file"""
        # Validate file type
        file_extension = MediaFileManager.get_file_extension(file.filename or "")
        if not MediaFileManager.is_valid_audio(file_extension):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid audio type. Allowed types: {', '.join(ALLOWED_AUDIO_TYPES)}"
            )

        # Validate file size (10MB max)
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Audio file too large (max 10MB)")

        # Generate paths
        category_dir = MediaFileManager.get_category_path(category_id, is_audio=True)
        MediaFileManager.ensure_directory_exists(category_dir)
        
        filename = MediaFileManager.generate_filename(word_id, file.filename or "", is_audio=True)
        file_path = category_dir / filename
        
        # Save audio file
        try:
            with open(file_path, 'wb') as f:
                f.write(content)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to save audio file: {str(e)}")

        # Generate URL
        file_url = MediaFileManager.get_file_url(category_id, filename, is_audio=True)
        
        return str(file_path), file_url

    @staticmethod
    def delete_file(file_path: str) -> bool:
        """Delete a file from filesystem"""
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                return True
            return False
        except Exception:
            return False


# Add these new endpoints to admin_routes.py

@admin_router.post("/words/{word_id}/images/upload")
async def upload_word_image(
        word_id: int,
        file: UploadFile = File(...),
        alt_text: Optional[str] = Form(None),
        is_primary: bool = Form(False),
        source: Optional[str] = Form(None),
        license: Optional[str] = Form(None),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Upload image file for a word (admin only) with detailed error handling"""

    logger.info(f"Upload request for word {word_id}")
    logger.info(f"User: {current_user.username}")
    logger.info(f"File: {file.filename}, size: {file.size if hasattr(file, 'size') else 'unknown'}")

    try:
        # Get word and category info
        logger.info("Fetching word from database...")
        word_result = await db.execute(
            select(KazakhWord)
            .options(joinedload(KazakhWord.category))
            .where(KazakhWord.id == word_id)
        )
        word = word_result.scalar_one_or_none()

        if not word:
            logger.error(f"Word {word_id} not found")
            raise HTTPException(status_code=404, detail="Word not found")

        logger.info(f"Word found: {word.kazakh_word}, category: {word.category.category_name} (ID: {word.category_id})")

        # Save file
        logger.info("Saving file...")
        file_path, file_url = await MediaFileManager.save_image_file(
            file, word_id, word.category_id
        )
        logger.info(f"File saved successfully: {file_url}")

        # If this is set as primary, remove primary status from other images
        if is_primary:
            logger.info("Setting as primary image, removing primary status from others...")
            await db.execute(
                update(WordImage)
                .where(WordImage.kazakh_word_id == word_id)
                .values(is_primary=False)
            )

        # Create database record - store only URL
        logger.info("Creating database record...")
        new_image = WordImage(
            kazakh_word_id=word_id,
            image_url=file_url,  # Store URL instead of file path
            image_type="photo",
            alt_text=alt_text or f"Image for {word.kazakh_word}",
            is_primary=is_primary,
            source=source,
            license=license
        )

        db.add(new_image)
        await db.commit()
        await db.refresh(new_image)

        logger.info(f"Database record created with ID: {new_image.id}")

        return {
            "success": True,
            "message": "Image uploaded successfully",
            "image": {
                "id": new_image.id,
                "image_url": new_image.image_url,
                "is_primary": new_image.is_primary,
                "alt_text": new_image.alt_text
            }
        }

    except HTTPException:
        logger.error("HTTPException occurred")
        raise
    except Exception as e:
        logger.error(f"Unexpected error in upload_word_image: {e}")
        logger.error(traceback.format_exc())
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")


@admin_router.post("/words/{word_id}/sounds/upload")
async def upload_word_sound(
    word_id: int,
    file: UploadFile = File(...),
    sound_type: Optional[str] = Form("pronunciation"),
    alt_text: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Upload audio file for a word (admin only) with enhanced error handling"""
    
    logger.info(f"=== AUDIO UPLOAD REQUEST ===")
    logger.info(f"Word ID: {word_id}")
    logger.info(f"User: {current_user.username}")
    logger.info(f"File: {file.filename}")
    logger.info(f"Sound type: {sound_type}")
    
    try:
        # Get word and category info
        logger.info("Fetching word from database...")
        word_result = await db.execute(
            select(KazakhWord)
            .options(joinedload(KazakhWord.category))
            .where(KazakhWord.id == word_id)
        )
        word = word_result.scalar_one_or_none()
        
        if not word:
            logger.error(f"Word {word_id} not found")
            raise HTTPException(status_code=404, detail="Word not found")
        
        logger.info(f"Word found: {word.kazakh_word}, category: {word.category.category_name} (ID: {word.category_id})")
        
        # Save file
        logger.info("Saving audio file...")
        file_path, file_url = await MediaFileManager.save_audio_file(
            file, word_id, word.category_id
        )
        logger.info(f"Audio file saved - Path: {file_path}, URL: {file_url}")
        
        # Create database record
        logger.info("Creating audio database record...")
        new_sound = WordSound(
            kazakh_word_id=word_id,
            sound_url=file_url,  # Store URL (primary field)
            sound_type=sound_type,
            alt_text=alt_text or f"Audio for {word.kazakh_word}"
        )
        
        db.add(new_sound)
        await db.commit()
        await db.refresh(new_sound)
        
        logger.info(f"✅ Audio upload completed successfully!")
        logger.info(f"Database record ID: {new_sound.id}")
        
        return {
            "success": True,
            "message": "Audio uploaded successfully",
            "sound": {
                "id": new_sound.id,
                "sound_url": new_sound.sound_url,
                "sound_type": new_sound.sound_type,
                "alt_text": new_sound.alt_text
            }
        }
        
    except HTTPException:
        logger.error("HTTPException occurred in audio upload")
        raise
    except Exception as e:
        logger.error(f"Unexpected error in upload_word_sound: {e}")
        logger.error(traceback.format_exc())
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to upload audio: {str(e)}")
    
@admin_router.post("/words/{word_id}/sounds/upload-debug")
async def upload_word_sound_debug(
    word_id: int,
    file: UploadFile = File(...),
    sound_type: Optional[str] = Form("pronunciation"),
    alt_text: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Debug version of audio upload with detailed information"""
    
    debug_info = {
        "request_info": {
            "word_id": word_id,
            "filename": file.filename,
            "content_type": file.content_type,
            "sound_type": sound_type,
            "alt_text": alt_text
        },
        "validation": {},
        "paths": {},
        "database": {},
        "error": None
    }
    
    try:
        # File validation
        file_extension = MediaFileManager.get_file_extension(file.filename or "")
        debug_info["validation"] = {
            "file_extension": file_extension,
            "is_valid_audio": MediaFileManager.is_valid_audio(file_extension),
            "allowed_types": list(ALLOWED_AUDIO_TYPES)
        }
        
        if not MediaFileManager.is_valid_audio(file_extension):
            debug_info["error"] = f"Invalid audio type: {file_extension}"
            return {"success": False, "debug_info": debug_info}
        
        # Read file
        content = await file.read()
        debug_info["validation"]["file_size"] = len(content)
        debug_info["validation"]["file_size_mb"] = round(len(content) / 1024 / 1024, 2)
        
        if len(content) > 10 * 1024 * 1024:
            debug_info["error"] = "File too large"
            return {"success": False, "debug_info": debug_info}
        
        # Get word info
        word_result = await db.execute(
            select(KazakhWord)
            .options(joinedload(KazakhWord.category))
            .where(KazakhWord.id == word_id)
        )
        word = word_result.scalar_one_or_none()
        
        if not word:
            debug_info["error"] = "Word not found"
            return {"success": False, "debug_info": debug_info}
        
        debug_info["database"]["word"] = {
            "id": word.id,
            "kazakh_word": word.kazakh_word,
            "category_id": word.category_id,
            "category_name": word.category.category_name
        }
        
        # Path calculations
        category_dir = MediaFileManager.get_category_path(word.category_id, is_audio=True)
        filename = MediaFileManager.generate_filename(word_id, file.filename or "", is_audio=True)
        file_path = category_dir / filename
        file_url = MediaFileManager.get_file_url(word.category_id, filename, is_audio=True)
        
        debug_info["paths"] = {
            "category_dir": str(category_dir),
            "category_dir_absolute": str(category_dir.absolute()),
            "category_dir_exists": category_dir.exists(),
            "filename": filename,
            "file_path": str(file_path),
            "file_path_absolute": str(file_path.absolute()),
            "file_url": file_url
        }
        
        # Try to create directory
        try:
            MediaFileManager.ensure_directory_exists(category_dir)
            debug_info["paths"]["directory_created"] = True
        except Exception as dir_error:
            debug_info["error"] = f"Failed to create directory: {str(dir_error)}"
            return {"success": False, "debug_info": debug_info}
        
        # Try to save file
        try:
            with open(file_path, 'wb') as f:
                f.write(content)
            
            debug_info["paths"]["file_saved"] = file_path.exists()
            if file_path.exists():
                debug_info["paths"]["saved_file_size"] = file_path.stat().st_size
                
        except Exception as save_error:
            debug_info["error"] = f"Failed to save file: {str(save_error)}"
            return {"success": False, "debug_info": debug_info}
        
        # Try database operation
        try:
            new_sound = WordSound(
                kazakh_word_id=word_id,
                sound_url=file_url,
                sound_type=sound_type,
                alt_text=alt_text or f"Audio for {word.kazakh_word}"
            )
            
            db.add(new_sound)
            await db.commit()
            await db.refresh(new_sound)
            
            debug_info["database"]["record_created"] = True
            debug_info["database"]["record_id"] = new_sound.id
            
        except Exception as db_error:
            debug_info["error"] = f"Database error: {str(db_error)}"
            await db.rollback()
            return {"success": False, "debug_info": debug_info}
        
        return {
            "success": True,
            "message": "Audio uploaded successfully with debug info",
            "debug_info": debug_info,
            "sound": {
                "id": new_sound.id,
                "sound_url": new_sound.sound_url,
                "sound_type": new_sound.sound_type,
                "alt_text": new_sound.alt_text
            }
        }
        
    except Exception as e:
        debug_info["error"] = f"Unexpected error: {str(e)}"
        debug_info["traceback"] = traceback.format_exc()
        return {"success": False, "debug_info": debug_info}


@admin_router.delete("/words/{word_id}/images/{image_id}")
async def delete_word_image(
    word_id: int,
    image_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Delete word image and file (admin only)"""
    
    # Get image record
    result = await db.execute(
        select(WordImage)
        .options(selectinload(WordImage.kazakh_word).selectinload(KazakhWord.category))
        .where(
            and_(
                WordImage.id == image_id,
                WordImage.kazakh_word_id == word_id
            )
        )
    )
    image = result.scalar_one_or_none()
    
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Delete file from filesystem
    try:
        category_id = image.kazakh_word.category_id
        filename = Path(image.image_url).name
        file_path = MediaFileManager.get_category_path(category_id, is_audio=False) / filename
        MediaFileManager.delete_file(str(file_path))
    except Exception:
        pass  # Continue even if file deletion fails
    
    # Delete database record
    await db.execute(delete(WordImage).where(WordImage.id == image_id))
    await db.commit()
    
    return {"success": True, "message": "Image deleted successfully"}


@admin_router.delete("/words/{word_id}/sounds/{sound_id}")
async def delete_word_sound(
    word_id: int,
    sound_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Delete word sound and file (admin only)"""
    
    # Get sound record
    result = await db.execute(
        select(WordSound)
        .options(selectinload(WordSound.kazakh_word).selectinload(KazakhWord.category))
        .where(
            and_(
                WordSound.id == sound_id,
                WordSound.kazakh_word_id == word_id
            )
        )
    )
    sound = result.scalar_one_or_none()
    
    if not sound:
        raise HTTPException(status_code=404, detail="Sound not found")
    
    # Delete file from filesystem
    try:
        category_id = sound.kazakh_word.category_id
        filename = Path(sound.sound_url).name
        file_path = MediaFileManager.get_category_path(category_id, is_audio=True) / filename
        MediaFileManager.delete_file(str(file_path))
    except Exception:
        pass  # Continue even if file deletion fails
    
    # Delete database record
    await db.execute(delete(WordSound).where(WordSound.id == sound_id))
    await db.commit()
    
    return {"success": True, "message": "Sound deleted successfully"}


# Update existing endpoints to work with the new structure

@admin_router.delete("/words/{word_id}")
async def delete_word_with_media(
        word_id: int,
        force_delete: bool = Query(False, description="Force delete even if user progress exists"),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Delete word with all associated media files (admin only)"""

    # Check if word exists and get media files
    word_result = await db.execute(
        select(KazakhWord)
        .options(
            selectinload(KazakhWord.images),
            selectinload(KazakhWord.sounds),
            selectinload(KazakhWord.category)
        )
        .where(KazakhWord.id == word_id)
    )
    word = word_result.scalar_one_or_none()
    
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    # Check for user progress unless force delete
    if not force_delete:
        progress_result = await db.execute(
            select(func.count(UserWordProgress.id))
            .where(UserWordProgress.kazakh_word_id == word_id)
        )
        progress_count = progress_result.scalar() or 0

        if progress_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete word with {progress_count} user progress records. Use force_delete=true to override."
            )

    # Delete media files from filesystem
    category_id = word.category_id
    
    # Delete image files
    for image in word.images:
        try:
            filename = Path(image.image_url).name
            file_path = MediaFileManager.get_category_path(category_id, is_audio=False) / filename
            MediaFileManager.delete_file(str(file_path))
        except Exception:
            pass  # Continue even if file deletion fails
    
    # Delete audio files
    for sound in word.sounds:
        try:
            filename = Path(sound.sound_url).name
            file_path = MediaFileManager.get_category_path(category_id, is_audio=True) / filename
            MediaFileManager.delete_file(str(file_path))
        except Exception:
            pass  # Continue even if file deletion fails

    # Delete word from database (cascade will handle related records)
    result = await db.execute(
        delete(KazakhWord).where(KazakhWord.id == word_id)
    )

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Word not found")

    await db.commit()
    return {"success": True, "message": "Word and all associated media deleted successfully"}


@admin_router.get("/words/{word_id}/debug")
async def debug_word_info(
        word_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Debug endpoint to check word and category info"""
    try:
        word_result = await db.execute(
            select(KazakhWord)
            .options(joinedload(KazakhWord.category))
            .where(KazakhWord.id == word_id)
        )
        word = word_result.scalar_one_or_none()

        if not word:
            return {"error": "Word not found", "word_id": word_id}

        # Check if directories exist
        category_dir = IMAGES_PATH / str(word.category_id)
        audio_dir = AUDIO_PATH / str(word.category_id)

        return {
            "word_id": word.id,
            "kazakh_word": word.kazakh_word,
            "category_id": word.category_id,
            "category_name": word.category.category_name,
            "image_directory": str(category_dir),
            "image_dir_exists": category_dir.exists(),
            "audio_directory": str(audio_dir),
            "audio_dir_exists": audio_dir.exists(),
            "media_base_path": str(MEDIA_BASE_PATH),
            "media_base_exists": MEDIA_BASE_PATH.exists()
        }
    except Exception as e:
        logger.error(f"Debug endpoint error: {e}")
        return {"error": str(e), "traceback": traceback.format_exc()}


# Add this endpoint to create directories manually
@admin_router.post("/setup-directories")
async def setup_directories(
        current_user: User = Depends(get_current_admin)
):
    """Setup media directories"""
    try:
        # Create base directories
        IMAGES_PATH.mkdir(parents=True, exist_ok=True)
        AUDIO_PATH.mkdir(parents=True, exist_ok=True)

        # Get all categories and create their directories
        from database.connection import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            categories_result = await db.execute(select(Category))
            categories = categories_result.scalars().all()

            created_dirs = []
            for category in categories:
                img_dir = IMAGES_PATH / str(category.id)
                audio_dir = AUDIO_PATH / str(category.id)

                img_dir.mkdir(exist_ok=True)
                audio_dir.mkdir(exist_ok=True)

                created_dirs.extend([str(img_dir), str(audio_dir)])

        return {
            "success": True,
            "message": "Directories created successfully",
            "created_directories": created_dirs
        }
    except Exception as e:
        logger.error(f"Setup directories error: {e}")
        return {"success": False, "error": str(e)}


# Add this debug endpoint to your admin_routes.py
@admin_router.get("/debug/paths")
async def debug_paths(
        current_user: User = Depends(get_current_admin)
):
    """Debug endpoint to check all paths and directory structure"""

    # Get current working directory
    cwd = os.getcwd()

    # Check if the expected paths exist
    expected_media_base = Path("kazakh-learn-frontend/public")
    expected_images = expected_media_base / "images" / "words" / "categories"

    # Alternative path possibilities
    alt_media_base1 = Path("./kazakh-learn-frontend/public")
    alt_media_base2 = Path("../kazakh-learn-frontend/public")
    alt_media_base3 = Path(cwd) / "kazakh-learn-frontend" / "public"

    debug_info = {
        "current_working_directory": cwd,
        "expected_media_base": str(expected_media_base),
        "expected_media_base_exists": expected_media_base.exists(),
        "expected_media_base_absolute": str(expected_media_base.absolute()),

        "expected_images_path": str(expected_images),
        "expected_images_exists": expected_images.exists(),
        "expected_images_absolute": str(expected_images.absolute()),

        "MEDIA_BASE_PATH_config": str(MEDIA_BASE_PATH),
        "MEDIA_BASE_PATH_exists": MEDIA_BASE_PATH.exists(),
        "MEDIA_BASE_PATH_absolute": str(MEDIA_BASE_PATH.absolute()),

        "IMAGES_PATH_config": str(IMAGES_PATH),
        "IMAGES_PATH_exists": IMAGES_PATH.exists(),
        "IMAGES_PATH_absolute": str(IMAGES_PATH.absolute()),

        "alternative_paths": {
            "alt1": {
                "path": str(alt_media_base1),
                "exists": alt_media_base1.exists(),
                "absolute": str(alt_media_base1.absolute())
            },
            "alt2": {
                "path": str(alt_media_base2),
                "exists": alt_media_base2.exists(),
                "absolute": str(alt_media_base2.absolute())
            },
            "alt3": {
                "path": str(alt_media_base3),
                "exists": alt_media_base3.exists(),
                "absolute": str(alt_media_base3.absolute())
            }
        }
    }

    # Check category 7 specifically
    category_7_paths = []
    possible_bases = [
        MEDIA_BASE_PATH,
        expected_media_base,
        alt_media_base1,
        alt_media_base2,
        alt_media_base3
    ]

    for base in possible_bases:
        cat7_path = base / "images" / "words" / "categories" / "7"
        category_7_paths.append({
            "base": str(base),
            "category_7_path": str(cat7_path),
            "exists": cat7_path.exists(),
            "absolute": str(cat7_path.absolute()),
            "files": list(cat7_path.glob("*")) if cat7_path.exists() else []
        })

    debug_info["category_7_checks"] = category_7_paths

    return debug_info


# Enhanced MediaFileManager with better logging
class EnhancedMediaFileManager:
    @staticmethod
    def ensure_directory_exists(path: Path):
        """Create directory if it doesn't exist with detailed logging"""
        try:
            # Log the full absolute path
            abs_path = path.absolute()
            logger.info(f"Ensuring directory exists: {path}")
            logger.info(f"Absolute path: {abs_path}")

            # Check if parent directories exist
            logger.info(f"Parent directory: {path.parent}")
            logger.info(f"Parent exists: {path.parent.exists()}")

            # Create the directory
            path.mkdir(parents=True, exist_ok=True)

            # Verify it was created
            if path.exists():
                logger.info(f"✅ Directory created successfully: {abs_path}")

                # List contents if any
                contents = list(path.glob("*"))
                logger.info(f"Directory contents: {contents}")
            else:
                logger.error(f"❌ Directory creation failed: {abs_path}")

        except Exception as e:
            logger.error(f"Failed to create directory {path}: {e}")
            logger.error(f"Absolute path was: {path.absolute()}")
            raise

    @staticmethod
    async def save_image_file_enhanced(
            file: UploadFile,
            word_id: int,
            category_id: int,
            max_size: tuple = (1200, 1200),
            quality: int = 85
    ) -> tuple[str, str]:
        """Enhanced save with detailed path logging"""

        logger.info(f"=== ENHANCED IMAGE SAVE DEBUG ===")
        logger.info(f"Current working directory: {os.getcwd()}")
        logger.info(f"Word ID: {word_id}, Category ID: {category_id}")
        logger.info(f"File: {file.filename}, content_type: {file.content_type}")

        try:
            # Validate file type
            file_extension = MediaFileManager.get_file_extension(file.filename or "")
            logger.info(f"File extension: {file_extension}")

            if not MediaFileManager.is_valid_image(file_extension):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid image type. Allowed types: {', '.join(ALLOWED_IMAGE_TYPES)}"
                )

            # Read file content
            logger.info("Reading file content...")
            content = await file.read()
            logger.info(f"File size: {len(content)} bytes")

            # Generate paths with enhanced logging
            category_dir = MediaFileManager.get_category_path(category_id, is_audio=False)
            logger.info(f"Category directory (relative): {category_dir}")
            logger.info(f"Category directory (absolute): {category_dir.absolute()}")
            logger.info(f"Category directory exists: {category_dir.exists()}")

            # Ensure directory exists
            EnhancedMediaFileManager.ensure_directory_exists(category_dir)

            filename = MediaFileManager.generate_filename(word_id, file.filename or "", is_audio=False)
            file_path = category_dir / filename
            logger.info(f"Target file path (relative): {file_path}")
            logger.info(f"Target file path (absolute): {file_path.absolute()}")

            # Save file with detailed logging
            logger.info("Saving file to disk...")
            try:
                with open(file_path, 'wb') as f:
                    f.write(content)

                # Verify file was written
                if file_path.exists():
                    file_size = file_path.stat().st_size
                    logger.info(f"✅ File saved successfully!")
                    logger.info(f"   Path: {file_path.absolute()}")
                    logger.info(f"   Size: {file_size} bytes")
                else:
                    logger.error(f"❌ File not found after save: {file_path.absolute()}")

            except Exception as save_error:
                logger.error(f"❌ File save failed: {save_error}")
                raise

            # Generate URL
            file_url = MediaFileManager.get_file_url(category_id, filename, is_audio=False)
            logger.info(f"Generated URL: {file_url}")

            # Final verification
            logger.info("=== FINAL VERIFICATION ===")
            logger.info(f"File exists: {file_path.exists()}")
            logger.info(f"Directory contents: {list(category_dir.glob('*'))}")
            logger.info(f"Full directory tree:")

            # Show directory tree
            base_path = MEDIA_BASE_PATH / "images" / "words" / "categories"
            if base_path.exists():
                for root, dirs, files in os.walk(base_path):
                    level = root.replace(str(base_path), '').count(os.sep)
                    indent = ' ' * 2 * level
                    logger.info(f"{indent}{os.path.basename(root)}/")
                    subindent = ' ' * 2 * (level + 1)
                    for file in files:
                        logger.info(f"{subindent}{file}")

            return str(file_path), file_url

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error in enhanced save: {e}")
            logger.error(traceback.format_exc())
            raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}")

# Updated upload endpoint with enhanced debugging
@admin_router.post("/words/{word_id}/images/upload-debug")
async def upload_word_image_debug(
        word_id: int,
        file: UploadFile = File(...),
        alt_text: Optional[str] = Form(None),
        is_primary: bool = Form(False),
        source: Optional[str] = Form(None),
        license: Optional[str] = Form(None),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Debug version of image upload with detailed logging"""

    logger.info(f"=== DEBUG UPLOAD START ===")
    logger.info(f"Upload request for word {word_id}")
    logger.info(f"User: {current_user.username}")
    logger.info(f"File: {file.filename}")

    try:
        # Get word and category info
        logger.info("Fetching word from database...")
        word_result = await db.execute(
            select(KazakhWord)
            .options(joinedload(KazakhWord.category))
            .where(KazakhWord.id == word_id)
        )
        word = word_result.scalar_one_or_none()

        if not word:
            logger.error(f"Word {word_id} not found")
            raise HTTPException(status_code=404, detail="Word not found")

        logger.info(f"Word found: {word.kazakh_word}, category: {word.category.category_name} (ID: {word.category_id})")

        # Save file with enhanced debugging
        logger.info("Saving file with enhanced debugging...")
        file_path, file_url = await EnhancedMediaFileManager.save_image_file_enhanced(
            file, word_id, word.category_id
        )
        logger.info(f"File saved - Path: {file_path}, URL: {file_url}")

        # Database operations...
        if is_primary:
            logger.info("Setting as primary image...")
            await db.execute(
                update(WordImage)
                .where(WordImage.kazakh_word_id == word_id)
                .values(is_primary=False)
            )

        # Create database record
        logger.info("Creating database record...")
        new_image = WordImage(
            kazakh_word_id=word_id,
            image_url=file_url,
            image_type="photo",
            alt_text=alt_text or f"Image for {word.kazakh_word}",
            is_primary=is_primary,
            source=source,
            license=license
        )

        db.add(new_image)
        await db.commit()
        await db.refresh(new_image)

        logger.info(f"✅ Upload completed successfully!")
        logger.info(f"Database record ID: {new_image.id}")

        return {
            "success": True,
            "message": "Image uploaded successfully with debug info",
            "debug_info": {
                "file_path": file_path,
                "file_url": file_url,
                "absolute_path": str(Path(file_path).absolute()),
                "file_exists": Path(file_path).exists(),
                "directory_contents": list(Path(file_path).parent.glob("*"))
            },
            "image": {
                "id": new_image.id,
                "image_url": new_image.image_url,
                "is_primary": new_image.is_primary,
                "alt_text": new_image.alt_text
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in debug upload: {e}")
        logger.error(traceback.format_exc())
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")


# Check if the expected directory structure exists
@admin_router.get("/debug/directory-structure")
async def check_directory_structure(
        current_user: User = Depends(get_current_admin)
):
    """Check the entire directory structure"""

    def scan_directory(path: Path, max_depth: int = 3, current_depth: int = 0):
        """Recursively scan directory structure"""
        if not path.exists() or current_depth > max_depth:
            return None

        result = {
            "name": path.name,
            "type": "directory" if path.is_dir() else "file",
            "exists": True,
            "absolute_path": str(path.absolute()),
            "children": []
        }

        if path.is_dir() and current_depth < max_depth:
            try:
                for child in sorted(path.iterdir()):
                    child_result = scan_directory(child, max_depth, current_depth + 1)
                    if child_result:
                        result["children"].append(child_result)
            except PermissionError:
                result["children"] = ["Permission denied"]

        return result

    # Scan from current working directory
    cwd = Path.cwd()
    structure = scan_directory(cwd)

    return {
        "current_working_directory": str(cwd),
        "structure": structure
    }

# ===== TRANSLATION MANAGEMENT ENDPOINTS =====

@admin_router.post("/translations/", response_model=TranslationResponse)
async def create_translation(
    translation_data: TranslationCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Create a new translation (admin only)"""
    
    # Verify word exists
    word_result = await db.execute(
        select(KazakhWord).where(KazakhWord.id == translation_data.kazakh_word_id)
    )
    word = word_result.scalar_one_or_none()
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    
    # Verify language exists
    language_result = await db.execute(
        select(Language).where(Language.id == translation_data.language_id)
    )
    language = language_result.scalar_one_or_none()
    if not language:
        raise HTTPException(status_code=404, detail="Language not found")
    
    # Check if translation already exists for this word and language
    existing_result = await db.execute(
        select(Translation).where(
            and_(
                Translation.kazakh_word_id == translation_data.kazakh_word_id,
                Translation.language_id == translation_data.language_id
            )
        )
    )
    existing_translation = existing_result.scalar_one_or_none()
    if existing_translation:
        raise HTTPException(
            status_code=400, 
            detail="Translation already exists for this word and language"
        )
    
    # Create new translation
    new_translation = Translation(
        kazakh_word_id=translation_data.kazakh_word_id,
        language_id=translation_data.language_id,
        translation=translation_data.translation,
        alternative_translations=translation_data.alternative_translations or []
    )
    
    db.add(new_translation)
    await db.commit()
    await db.refresh(new_translation)
    
    return TranslationResponse(
        id=new_translation.id,
        kazakh_word_id=new_translation.kazakh_word_id,
        language_id=new_translation.language_id,
        language_code=language.language_code,
        language_name=language.language_name,
        translation=new_translation.translation,
        alternative_translations=new_translation.alternative_translations or [],
        created_at=new_translation.created_at.isoformat()
    )


@admin_router.put("/translations/{translation_id}", response_model=TranslationResponse)
async def update_translation(
    translation_id: int,
    translation_data: TranslationUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Update translation (admin only)"""
    
    # Get translation with language info
    translation_result = await db.execute(
        select(Translation)
        .options(joinedload(Translation.language))
        .where(Translation.id == translation_id)
    )
    translation = translation_result.scalar_one_or_none()
    
    if not translation:
        raise HTTPException(status_code=404, detail="Translation not found")
    
    # Update translation
    translation.translation = translation_data.translation
    translation.alternative_translations = translation_data.alternative_translations or []
    
    await db.commit()
    await db.refresh(translation)
    
    return TranslationResponse(
        id=translation.id,
        kazakh_word_id=translation.kazakh_word_id,
        language_id=translation.language_id,
        language_code=translation.language.language_code,
        language_name=translation.language.language_name,
        translation=translation.translation,
        alternative_translations=translation.alternative_translations or [],
        created_at=translation.created_at.isoformat()
    )


@admin_router.delete("/translations/{translation_id}")
async def delete_translation(
    translation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Delete translation (admin only)"""
    
    result = await db.execute(
        delete(Translation).where(Translation.id == translation_id)
    )
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Translation not found")
    
    await db.commit()
    return {"success": True, "message": "Translation deleted successfully"}


@admin_router.get("/translations/word/{word_id}", response_model=List[TranslationResponse])
async def get_word_translations(
    word_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Get all translations for a word (admin only)"""
    
    # Verify word exists
    word_result = await db.execute(
        select(KazakhWord).where(KazakhWord.id == word_id)
    )
    word = word_result.scalar_one_or_none()
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    
    # Get translations with language info
    translations_result = await db.execute(
        select(Translation)
        .options(joinedload(Translation.language))
        .where(Translation.kazakh_word_id == word_id)
        .order_by(Translation.language_id)
    )
    translations = translations_result.scalars().all()
    
    return [
        TranslationResponse(
            id=trans.id,
            kazakh_word_id=trans.kazakh_word_id,
            language_id=trans.language_id,
            language_code=trans.language.language_code,
            language_name=trans.language.language_name,
            translation=trans.translation,
            alternative_translations=trans.alternative_translations or [],
            created_at=trans.created_at.isoformat()
        )
        for trans in translations
    ]


@admin_router.get("/translations/{translation_id}", response_model=TranslationResponse)
async def get_translation(
    translation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Get translation by ID (admin only)"""
    
    translation_result = await db.execute(
        select(Translation)
        .options(joinedload(Translation.language))
        .where(Translation.id == translation_id)
    )
    translation = translation_result.scalar_one_or_none()
    
    if not translation:
        raise HTTPException(status_code=404, detail="Translation not found")
    
    return TranslationResponse(
        id=translation.id,
        kazakh_word_id=translation.kazakh_word_id,
        language_id=translation.language_id,
        language_code=translation.language.language_code,
        language_name=translation.language.language_name,
        translation=translation.translation,
        alternative_translations=translation.alternative_translations or [],
        created_at=translation.created_at.isoformat()
    )


# ===== BULK TRANSLATION OPERATIONS =====

class BulkTranslationCreateRequest(BaseModel):
    kazakh_word_id: int
    translations: List[dict]  # [{"language_id": 1, "translation": "...", "alternative_translations": [...]}]

class BulkTranslationResponse(BaseModel):
    success: bool
    created_count: int
    updated_count: int
    skipped_count: int
    translations: List[TranslationResponse]
    errors: List[dict] = []

@admin_router.post("/translations/bulk", response_model=BulkTranslationResponse)
async def bulk_create_translations(
    bulk_data: BulkTranslationCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Create multiple translations for a word (admin only)"""
    
    # Verify word exists
    word_result = await db.execute(
        select(KazakhWord).where(KazakhWord.id == bulk_data.kazakh_word_id)
    )
    word = word_result.scalar_one_or_none()
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    
    created_translations = []
    created_count = 0
    updated_count = 0
    skipped_count = 0
    errors = []
    
    for i, trans_data in enumerate(bulk_data.translations):
        try:
            language_id = trans_data.get('language_id')
            translation_text = trans_data.get('translation', '').strip()
            alternative_translations = trans_data.get('alternative_translations', [])
            
            if not language_id or not translation_text:
                skipped_count += 1
                errors.append({
                    "index": i,
                    "error": "Missing language_id or translation text"
                })
                continue
            
            # Verify language exists
            language_result = await db.execute(
                select(Language).where(Language.id == language_id)
            )
            language = language_result.scalar_one_or_none()
            if not language:
                skipped_count += 1
                errors.append({
                    "index": i,
                    "error": f"Language with ID {language_id} not found"
                })
                continue
            
            # Check if translation already exists
            existing_result = await db.execute(
                select(Translation).where(
                    and_(
                        Translation.kazakh_word_id == bulk_data.kazakh_word_id,
                        Translation.language_id == language_id
                    )
                )
            )
            existing_translation = existing_result.scalar_one_or_none()
            
            if existing_translation:
                # Update existing translation
                existing_translation.translation = translation_text
                existing_translation.alternative_translations = alternative_translations
                await db.flush()
                
                created_translations.append(TranslationResponse(
                    id=existing_translation.id,
                    kazakh_word_id=existing_translation.kazakh_word_id,
                    language_id=existing_translation.language_id,
                    language_code=language.language_code,
                    language_name=language.language_name,
                    translation=existing_translation.translation,
                    alternative_translations=existing_translation.alternative_translations or [],
                    created_at=existing_translation.created_at.isoformat()
                ))
                updated_count += 1
            else:
                # Create new translation
                new_translation = Translation(
                    kazakh_word_id=bulk_data.kazakh_word_id,
                    language_id=language_id,
                    translation=translation_text,
                    alternative_translations=alternative_translations
                )
                db.add(new_translation)
                await db.flush()
                
                created_translations.append(TranslationResponse(
                    id=new_translation.id,
                    kazakh_word_id=new_translation.kazakh_word_id,
                    language_id=new_translation.language_id,
                    language_code=language.language_code,
                    language_name=language.language_name,
                    translation=new_translation.translation,
                    alternative_translations=new_translation.alternative_translations or [],
                    created_at=new_translation.created_at.isoformat()
                ))
                created_count += 1
                
        except Exception as e:
            errors.append({
                "index": i,
                "error": str(e)
            })
            skipped_count += 1
    
    await db.commit()
    
    return BulkTranslationResponse(
        success=True,
        created_count=created_count,
        updated_count=updated_count,
        skipped_count=skipped_count,
        translations=created_translations,
        errors=errors
    )


# ===== TRANSLATION STATISTICS =====

@admin_router.get("/translations/statistics")
async def get_translation_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Get translation statistics (admin only)"""
    
    # Total translations
    total_result = await db.execute(select(func.count(Translation.id)))
    total_translations = total_result.scalar() or 0
    
    # Translations by language
    language_result = await db.execute(
        select(
            Language.language_code,
            Language.language_name,
            func.count(Translation.id).label('translation_count')
        )
        .join(Translation, Language.id == Translation.language_id)
        .group_by(Language.id, Language.language_code, Language.language_name)
        .order_by(func.count(Translation.id).desc())
    )
    
    translations_by_language = [
        {
            "language_code": row.language_code,
            "language_name": row.language_name,
            "translation_count": row.translation_count
        }
        for row in language_result.all()
    ]
    
    # Words without translations
    words_without_translations_result = await db.execute(
        select(func.count(KazakhWord.id))
        .outerjoin(Translation, KazakhWord.id == Translation.kazakh_word_id)
        .where(Translation.id.is_(None))
    )
    words_without_translations = words_without_translations_result.scalar() or 0
    
    # Words with multiple translations
    words_with_multiple_result = await db.execute(
        select(func.count(func.distinct(Translation.kazakh_word_id)))
        .select_from(Translation)
        .group_by(Translation.kazakh_word_id)
        .having(func.count(Translation.id) > 1)
    )
    words_with_multiple = len(words_with_multiple_result.all())
    
    # Coverage by language (words that have translations in each language)
    total_words_result = await db.execute(select(func.count(KazakhWord.id)))
    total_words = total_words_result.scalar() or 0
    
    coverage_by_language = []
    for lang_data in translations_by_language:
        if total_words > 0:
            coverage_percentage = round((lang_data['translation_count'] / total_words) * 100, 2)
        else:
            coverage_percentage = 0
        
        coverage_by_language.append({
            "language_code": lang_data['language_code'],
            "language_name": lang_data['language_name'],
            "translation_count": lang_data['translation_count'],
            "coverage_percentage": coverage_percentage
        })
    
    return {
        "total_translations": total_translations,
        "total_words": total_words,
        "words_without_translations": words_without_translations,
        "words_with_multiple_translations": words_with_multiple,
        "translations_by_language": translations_by_language,
        "coverage_by_language": coverage_by_language,
        "average_translations_per_word": round(total_translations / total_words, 2) if total_words > 0 else 0
    }

# Add this endpoint to your admin_routes.py

class AdminWordCreate(BaseModel):
    kazakh_word: str
    kazakh_cyrillic: Optional[str] = None
    word_type_id: int
    category_id: int
    difficulty_level_id: int

@admin_router.post("/words", response_model=AdminWordResponse)
async def create_word(
        word_data: AdminWordCreate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Create a new word (admin only)"""

    # Validate that category exists
    category_result = await db.execute(
        select(Category).where(Category.id == word_data.category_id)
    )
    category = category_result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=400, detail="Category not found")

    # Validate that word type exists
    word_type_result = await db.execute(
        select(WordType).where(WordType.id == word_data.word_type_id)
    )
    word_type = word_type_result.scalar_one_or_none()
    if not word_type:
        raise HTTPException(status_code=400, detail="Word type not found")

    # Validate that difficulty level exists
    difficulty_result = await db.execute(
        select(DifficultyLevel).where(DifficultyLevel.id == word_data.difficulty_level_id)
    )
    difficulty = difficulty_result.scalar_one_or_none()
    if not difficulty:
        raise HTTPException(status_code=400, detail="Difficulty level not found")

    # Check if word already exists
    existing_word_result = await db.execute(
        select(KazakhWord).where(KazakhWord.kazakh_word == word_data.kazakh_word)
    )
    existing_word = existing_word_result.scalar_one_or_none()
    if existing_word:
        raise HTTPException(
            status_code=400, 
            detail=f"Word '{word_data.kazakh_word}' already exists"
        )

    # Create new word
    new_word = KazakhWord(
        kazakh_word=word_data.kazakh_word,
        kazakh_cyrillic=word_data.kazakh_cyrillic,
        word_type_id=word_data.word_type_id,
        category_id=word_data.category_id,
        difficulty_level_id=word_data.difficulty_level_id
    )

    db.add(new_word)
    await db.commit()
    await db.refresh(new_word)

    # Get full word details for response
    full_word = await KazakhWordCRUD.get_by_id_full(db, new_word.id, "en")

    return AdminWordResponse(
        id=full_word.id,
        kazakh_word=full_word.kazakh_word,
        kazakh_cyrillic=full_word.kazakh_cyrillic,
        word_type_id=full_word.word_type_id,
        category_id=full_word.category_id,
        difficulty_level_id=full_word.difficulty_level_id,
        word_type_name=full_word.word_type.type_name,
        category_name=full_word.category.category_name,
        difficulty_level=full_word.difficulty_level.level_number,
        primary_translation=None,  # No translations yet
        translation_count=0,
        created_at=full_word.created_at.isoformat()
    )

# ===== TRANSLATION ENDPOINTS =====

@admin_router.post("/translate/word", response_model=TranslationServiceResponse)
async def translate_word_endpoint(
    request: TranslateWordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Translate a Kazakh word to target language using GPT-4 (admin only)"""
    
    try:
        # Validate input
        if not request.kazakh_word.strip():
            raise HTTPException(status_code=400, detail="Kazakh word cannot be empty")
        
        if len(request.kazakh_word) > 100:
            raise HTTPException(status_code=400, detail="Kazakh word too long (max 100 characters)")
        
        # Check if translation service is available
        if not translation_service.validate_api_key():
            raise HTTPException(
                status_code=503, 
                detail="Translation service not available. Please check OpenAI API key configuration."
            )
        
        # Record start time for performance monitoring
        import time
        start_time = time.time()
        
        # Perform translation
        result = await translate_kazakh_word(
            kazakh_word=request.kazakh_word.strip(),
            target_language_code=request.target_language_code,
            target_language_name=request.target_language_name,
            kazakh_cyrillic=request.kazakh_cyrillic.strip() if request.kazakh_cyrillic else None,
            context=request.context
        )
        
        # Log performance
        processing_time = time.time() - start_time
        logger.info(f"Translation completed in {processing_time:.2f} seconds")
        
        # Return the correct response format
        return TranslationServiceResponse(
            primary_translation=result.primary_translation,
            alternative_translations=result.alternative_translations,
            confidence=result.confidence,
            language_code=result.language_code,
            language_name=result.language_name
        )
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Translation validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Translation endpoint error: {e}")
        raise HTTPException(status_code=500, detail="Translation service temporarily unavailable")


@admin_router.post("/translate/quick", response_model=QuickTranslationServiceResponse)
async def quick_translate_endpoint(
    request: QuickTranslateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Quick translate to Russian, English, and Chinese (admin only)"""
    
    try:
        # Validate input
        if not request.kazakh_word.strip():
            raise HTTPException(status_code=400, detail="Kazakh word cannot be empty")
        
        # Check if translation service is available
        if not translation_service.validate_api_key():
            raise HTTPException(
                status_code=503, 
                detail="Translation service not available. Please check OpenAI API key configuration."
            )
        
        # Record start time
        import time
        start_time = time.time()
        
        # Perform translations
        results = await quick_translate_to_common_languages(
            kazakh_word=request.kazakh_word.strip(),
            kazakh_cyrillic=request.kazakh_cyrillic.strip() if request.kazakh_cyrillic else None
        )
        
        # Calculate processing time
        processing_time = time.time() - start_time
        
        # Convert results to response format using the correct schema
        translations = {}
        success_count = 0
        
        for lang_code, result in results.items():
            translations[lang_code] = TranslationServiceResponse(
                primary_translation=result.primary_translation,
                alternative_translations=result.alternative_translations,
                confidence=result.confidence,
                language_code=result.language_code,
                language_name=result.language_name
            )
            
            if result.primary_translation:  # Count successful translations
                success_count += 1
        
        logger.info(f"Quick translation completed in {processing_time:.2f} seconds: {success_count}/{len(results)} successful")
        
        return QuickTranslationServiceResponse(
            translations=translations,
            success_count=success_count,
            total_count=len(results),
            kazakh_word=request.kazakh_word.strip(),
            processing_time_seconds=round(processing_time, 2)
        )
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Quick translation validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Quick translation endpoint error: {e}")
        raise HTTPException(status_code=500, detail="Translation service temporarily unavailable")

@admin_router.post("/translate/batch", response_model=BatchTranslationServiceResponse)
async def batch_translate_endpoint(
    request: BatchTranslateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Translate to multiple specified languages (admin only)"""
    
    try:
        # Validate input
        if not request.kazakh_word.strip():
            raise HTTPException(status_code=400, detail="Kazakh word cannot be empty")
        
        if not request.target_language_codes:
            raise HTTPException(status_code=400, detail="At least one target language code is required")
        
        if len(request.target_language_codes) > 10:
            raise HTTPException(status_code=400, detail="Maximum 10 languages per batch request")
        
        # Check if translation service is available
        if not translation_service.validate_api_key():
            raise HTTPException(
                status_code=503, 
                detail="Translation service not available. Please check OpenAI API key configuration."
            )
        
        # Record start time
        import time
        start_time = time.time()
        
        # Perform translations
        results = await translate_to_languages(
            kazakh_word=request.kazakh_word.strip(),
            target_language_codes=request.target_language_codes,
            kazakh_cyrillic=request.kazakh_cyrillic.strip() if request.kazakh_cyrillic else None,
            context=request.context
        )
        
        # Calculate processing time
        processing_time = time.time() - start_time
        
        # Convert results to response format using the correct schema
        translations = {}
        success_count = 0
        failed_languages = []
        
        for lang_code, result in results.items():
            translations[lang_code] = TranslationServiceResponse(
                primary_translation=result.primary_translation,
                alternative_translations=result.alternative_translations,
                confidence=result.confidence,
                language_code=result.language_code,
                language_name=result.language_name
            )
            
            if result.primary_translation:
                success_count += 1
            else:
                failed_languages.append(lang_code)
        
        logger.info(f"Batch translation completed in {processing_time:.2f} seconds: {success_count}/{len(results)} successful")
        
        return BatchTranslationServiceResponse(
            translations=translations,
            success_count=success_count,
            total_count=len(results),
            kazakh_word=request.kazakh_word.strip(),
            failed_languages=failed_languages,
            processing_time_seconds=round(processing_time, 2)
        )
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Batch translation validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Batch translation endpoint error: {e}")
        raise HTTPException(status_code=500, detail="Translation service temporarily unavailable")


@admin_router.get("/translate/test")
async def test_translation_service_endpoint(
    run_comprehensive_test: bool = Query(False, description="Run comprehensive service test"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Test the translation service status and functionality (admin only)"""
    
    try:
        import time
        from datetime import datetime
        
        # Basic validation
        api_key_configured = translation_service.validate_api_key()
        
        # Get service information
        available_models = await translation_service.get_translation_models()
        supported_languages = await translation_service.get_supported_languages()
        current_model = translation_service.preferred_model
        
        # Basic test
        service_available = False
        test_results = None
        
        if api_key_configured:
            try:
                service_available = await translation_service.test_translation()
                
                if run_comprehensive_test and service_available:
                    logger.info("Running comprehensive translation service test...")
                    # Use a simpler test result format
                    test_results = {
                        "basic_test": "passed" if service_available else "failed",
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    
            except Exception as test_error:
                logger.error(f"Translation service test failed: {test_error}")
                service_available = False
        
        # Return a simple dictionary instead of a Pydantic model
        return {
            "service_available": service_available,
            "api_key_configured": api_key_configured,
            "current_model": current_model,
            "supported_languages_count": len(supported_languages),
            "available_models": available_models,
            "test_results": test_results,
            "last_test_time": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Translation service status check failed: {e}")
        return {
            "service_available": False,
            "api_key_configured": False,
            "current_model": "unknown",
            "supported_languages_count": 0,
            "available_models": [],
            "test_results": {"error": str(e)},
            "last_test_time": datetime.utcnow().isoformat()
        }


@admin_router.post("/translate/word/{word_id}")
async def translate_existing_word_enhanced(
    word_id: int,
    request: TranslateWordRequest,
    save_translation: bool = Query(False, description="Save translation to database"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Translate an existing word with option to save (admin only)"""
    
    try:
        # Get the word
        word_result = await db.execute(
            select(KazakhWord)
            .options(joinedload(KazakhWord.category))
            .where(KazakhWord.id == word_id)
        )
        word = word_result.scalar_one_or_none()
        
        if not word:
            raise HTTPException(status_code=404, detail="Word not found")
        
        # Use the word's data if not provided in request
        kazakh_word = request.kazakh_word or word.kazakh_word
        kazakh_cyrillic = request.kazakh_cyrillic or word.kazakh_cyrillic
        
        # Add context from category and word type
        context_parts = []
        if word.category:
            context_parts.append(f"Category: {word.category.category_name}")
        if request.context:
            context_parts.append(request.context)
        
        context = ". ".join(context_parts) if context_parts else None
        
        # Perform translation
        result = await translate_kazakh_word(
            kazakh_word=kazakh_word,
            target_language_code=request.target_language_code,
            target_language_name=request.target_language_name,
            kazakh_cyrillic=kazakh_cyrillic,
            context=context
        )
        
        translation_saved = False
        translation_id = None
        
        # Save translation if requested
        if save_translation and result.primary_translation:
            try:
                # Get language by code
                language_result = await db.execute(
                    select(Language).where(Language.language_code == request.target_language_code)
                )
                language = language_result.scalar_one_or_none()
                
                if language:
                    # Check if translation already exists
                    existing_result = await db.execute(
                        select(Translation).where(
                            and_(
                                Translation.kazakh_word_id == word_id,
                                Translation.language_id == language.id
                            )
                        )
                    )
                    existing_translation = existing_result.scalar_one_or_none()
                    
                    if existing_translation:
                        # Update existing translation
                        existing_translation.translation = result.primary_translation
                        existing_translation.alternative_translations = result.alternative_translations
                        translation_id = existing_translation.id
                    else:
                        # Create new translation
                        new_translation = Translation(
                            kazakh_word_id=word_id,
                            language_id=language.id,
                            translation=result.primary_translation,
                            alternative_translations=result.alternative_translations
                        )
                        db.add(new_translation)
                        await db.flush()
                        translation_id = new_translation.id
                    
                    await db.commit()
                    translation_saved = True
                    logger.info(f"Translation saved to database: word_id={word_id}, language={request.target_language_code}")
                    
            except Exception as save_error:
                logger.error(f"Failed to save translation: {save_error}")
                await db.rollback()
        
        return {
            "word_id": word_id,
            "kazakh_word": kazakh_word,
            "translation": {
                "primary_translation": result.primary_translation,
                "alternative_translations": result.alternative_translations,
                "confidence": result.confidence,
                "language_code": result.language_code,
                "language_name": result.language_name
            },
            "context_used": context,
            "translation_saved": translation_saved,
            "translation_id": translation_id,
            "word_info": {
                "id": word.id,
                "kazakh_word": word.kazakh_word,
                "kazakh_cyrillic": word.kazakh_cyrillic,
                "category_name": word.category.category_name if word.category else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Word translation error: {e}")
        raise HTTPException(status_code=500, detail="Translation failed")


@admin_router.get("/translate/supported-languages")
async def get_supported_languages_enhanced(
    include_stats: bool = Query(False, description="Include translation statistics"),
    current_user: User = Depends(get_current_admin)
):
    """Get list of supported languages for translation with optional stats (admin only)"""
    
    try:
        # Get supported languages from translation service
        supported_languages_dict = await translation_service.get_supported_languages()
        
        # Get languages from database that are active
        from database.crud import LanguageCRUD
        
        try:
            db_languages = await LanguageCRUD.get_all(db, active_only=True)
        except:
            # If database call fails, use empty list
            db_languages = []
        
        # Build response
        supported_languages = []
        
        for code, name in supported_languages_dict.items():
            # Skip Kazakh itself
            if code.lower() == 'kk':
                continue
                
            # Check if language exists in database
            db_language = next((lang for lang in db_languages if lang.language_code.lower() == code.lower()), None)
            
            language_info = {
                "language_code": code,
                "language_name": name,
                "is_common": code.lower() in ['en', 'ru', 'zh', 'zh-cn'],
                "in_database": bool(db_language),
                "database_id": db_language.id if db_language else None,
                "database_name": db_language.language_name if db_language else None
            }
            
            # Add translation statistics if requested
            if include_stats and db_language:
                try:
                    # Get translation count for this language
                    from database.connection import AsyncSessionLocal
                    async with AsyncSessionLocal() as stats_db:
                        translation_count_result = await stats_db.execute(
                            select(func.count(Translation.id))
                            .where(Translation.language_id == db_language.id)
                        )
                        translation_count = translation_count_result.scalar() or 0
                        
                        language_info["translation_count"] = translation_count
                        
                except Exception as stats_error:
                    logger.warning(f"Failed to get translation stats for {code}: {stats_error}")
                    language_info["translation_count"] = 0
            
            supported_languages.append(language_info)
        
        # Sort by common languages first, then alphabetically
        supported_languages.sort(key=lambda x: (not x["is_common"], x["language_name"]))
        
        return {
            "supported_languages": supported_languages,
            "total_count": len(supported_languages),
            "common_languages": [lang for lang in supported_languages if lang["is_common"]],
            "service_available": translation_service.validate_api_key(),
            "database_languages_count": len(db_languages),
            "translation_service_info": {
                "current_model": translation_service.preferred_model,
                "available_models": await translation_service.get_translation_models()
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting supported languages: {e}")
        raise HTTPException(status_code=500, detail="Failed to get supported languages")


@admin_router.get("/translate/models")
async def get_available_translation_models(
    current_user: User = Depends(get_current_admin)
):
    """Get available translation models and their capabilities (admin only)"""
    
    try:
        available_models = await translation_service.get_translation_models()
        current_model = translation_service.preferred_model
        
        model_info = []
        for model in available_models:
            info = {
                "model_name": model,
                "is_current": model == current_model,
                "supports_json": True,  # All models in the list support JSON
                "description": "",
                "recommended_for": []
            }
            
            # Add model-specific information
            if "gpt-4-turbo" in model:
                info["description"] = "Latest GPT-4 Turbo with enhanced capabilities"
                info["recommended_for"] = ["high_accuracy", "complex_translations", "cultural_context"]
            elif "gpt-4" in model:
                info["description"] = "GPT-4 model with excellent translation quality"
                info["recommended_for"] = ["high_accuracy", "cultural_context"]
            elif "gpt-3.5-turbo" in model:
                info["description"] = "Fast and efficient GPT-3.5 Turbo"
                info["recommended_for"] = ["speed", "batch_processing", "cost_effective"]
            
            model_info.append(info)
        
        return {
            "available_models": model_info,
            "current_model": current_model,
            "service_available": translation_service.validate_api_key(),
            "model_count": len(available_models)
        }
        
    except Exception as e:
        logger.error(f"Error getting translation models: {e}")
        raise HTTPException(status_code=500, detail="Failed to get translation models")


# ===== TRANSLATION MONITORING AND ANALYTICS =====

@admin_router.get("/translate/analytics")
async def get_translation_analytics(
    days: int = Query(7, ge=1, le=90, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Get translation usage analytics (admin only)"""
    
    try:
        from datetime import datetime, timedelta
        
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get translation statistics
        # Note: This assumes you have a translation_log table for tracking usage
        # You may need to implement this based on your needs
        
        analytics = {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": days
            },
            "service_status": {
                "available": translation_service.validate_api_key(),
                "current_model": translation_service.preferred_model
            },
            "database_stats": {
                "total_translations": 0,
                "translations_by_language": [],
                "recent_activity": []
            },
            "recommendations": []
        }
        
        # Get database translation statistics
        try:
            # Total translations
            total_result = await db.execute(select(func.count(Translation.id)))
            analytics["database_stats"]["total_translations"] = total_result.scalar() or 0
            
            # Translations by language
            language_stats_result = await db.execute(
                select(
                    Language.language_code,
                    Language.language_name,
                    func.count(Translation.id).label('count')
                )
                .join(Translation, Language.id == Translation.language_id)
                .group_by(Language.id, Language.language_code, Language.language_name)
                .order_by(func.count(Translation.id).desc())
                .limit(10)
            )
            
            analytics["database_stats"]["translations_by_language"] = [
                {
                    "language_code": row.language_code,
                    "language_name": row.language_name,
                    "translation_count": row.count
                }
                for row in language_stats_result.all()
            ]
            
            # Recent translations
            recent_result = await db.execute(
                select(Translation, Language.language_code, KazakhWord.kazakh_word)
                .join(Language, Translation.language_id == Language.id)
                .join(KazakhWord, Translation.kazakh_word_id == KazakhWord.id)
                .where(Translation.created_at >= start_date)
                .order_by(Translation.created_at.desc())
                .limit(5)
            )
            
            analytics["database_stats"]["recent_activity"] = [
                {
                    "kazakh_word": row.kazakh_word,
                    "translation": row.Translation.translation,
                    "language_code": row.language_code,
                    "created_at": row.Translation.created_at.isoformat(),
                    "confidence": getattr(row.Translation, 'confidence', None)
                }
                for row in recent_result.all()
            ]
            
        except Exception as db_error:
            logger.warning(f"Failed to get database analytics: {db_error}")
        
        # Add recommendations
        if analytics["database_stats"]["total_translations"] == 0:
            analytics["recommendations"].append("No translations found. Consider adding translations to improve language learning experience.")
        elif analytics["database_stats"]["total_translations"] < 100:
            analytics["recommendations"].append("Low translation count. Consider using bulk translation features to expand content.")
        
        if len(analytics["database_stats"]["translations_by_language"]) < 3:
            analytics["recommendations"].append("Limited language coverage. Consider adding translations for more languages.")
        
        if not analytics["service_status"]["available"]:
            analytics["recommendations"].append("Translation service unavailable. Check OpenAI API key configuration.")
        
        return analytics
        
    except Exception as e:
        logger.error(f"Error getting translation analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get translation analytics")

# ===== GUIDE WORD MANAGEMENT ENDPOINTS =====

@admin_router.get("/guides", response_model=List[Dict[str, Any]])
async def get_admin_guides(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    difficulty: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Get all learning guides for admin management"""
    try:
        query = select(LearningGuide)
        
        # Apply filters
        if difficulty:
            query = query.where(LearningGuide.difficulty_level == difficulty)
        if is_active is not None:
            query = query.where(LearningGuide.is_active == is_active)
        if search:
            query = query.where(
                or_(
                    LearningGuide.title.ilike(f"%{search}%"),
                    LearningGuide.description.ilike(f"%{search}%"),
                    LearningGuide.guide_key.ilike(f"%{search}%")
                )
            )
        
        # Get count for each guide
        word_count_subquery = (
            select(
                GuideWordMapping.guide_id,
                func.count(GuideWordMapping.id).label('word_count')
            )
            .where(GuideWordMapping.is_active == True)
            .group_by(GuideWordMapping.guide_id)
            .subquery()
        )
        
        query = (
            query
            .outerjoin(word_count_subquery, LearningGuide.id == word_count_subquery.c.guide_id)
            .add_columns(func.coalesce(word_count_subquery.c.word_count, 0).label('current_word_count'))
            .order_by(LearningGuide.sort_order, LearningGuide.id)
            .offset(skip)
            .limit(limit)
        )
        
        result = await db.execute(query)
        guides_data = result.all()
        
        guides = []
        for guide, word_count in guides_data:
            guides.append({
                'id': guide.id,
                'guide_key': guide.guide_key,
                'title': guide.title,
                'description': guide.description,
                'difficulty_level': guide.difficulty_level,
                'estimated_minutes': guide.estimated_minutes,
                'target_word_count': guide.target_word_count,
                'current_word_count': word_count,
                'is_active': guide.is_active,
                'created_at': guide.created_at.isoformat(),
                'updated_at': guide.updated_at.isoformat()
            })
        
        return guides
        
    except Exception as e:
        logger.error(f"Error getting admin guides: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch guides")

@admin_router.get("/guides/{guide_id}/words", response_model=List[GuideWordMappingResponse])
async def get_guide_words(
    guide_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    sort_by: str = Query("order_in_guide"),
    sort_direction: str = Query("asc"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Get words assigned to a specific guide"""
    try:
        # Check if guide exists
        guide = await db.get(LearningGuide, guide_id)
        if not guide:
            raise HTTPException(status_code=404, detail="Guide not found")
        
        # Build query with joins
        query = (
            select(GuideWordMapping, KazakhWord, Category, DifficultyLevel)
            .join(KazakhWord, GuideWordMapping.kazakh_word_id == KazakhWord.id)
            .join(Category, KazakhWord.category_id == Category.id)
            .join(DifficultyLevel, KazakhWord.difficulty_level_id == DifficultyLevel.id)
            .where(GuideWordMapping.guide_id == guide_id)
        )
        
        # Apply search filter
        if search:
            query = query.where(
                or_(
                    KazakhWord.kazakh_word.ilike(f"%{search}%"),
                    KazakhWord.kazakh_cyrillic.ilike(f"%{search}%"),
                    Category.category_name.ilike(f"%{search}%")
                )
            )
        
        # Apply sorting
        if sort_by == "order_in_guide":
            sort_column = GuideWordMapping.order_in_guide
        elif sort_by == "importance_score":
            sort_column = GuideWordMapping.importance_score
        elif sort_by == "kazakh_word":
            sort_column = KazakhWord.kazakh_word
        elif sort_by == "difficulty":
            sort_column = DifficultyLevel.level_number
        else:
            sort_column = GuideWordMapping.order_in_guide
        
        if sort_direction == "desc":
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(asc(sort_column))
        
        query = query.offset(skip).limit(limit)
        
        result = await db.execute(query)
        mappings_data = result.all()
        
        # Get primary translations
        word_ids = [mapping.kazakh_word_id for mapping, _, _, _ in mappings_data]
        translations_query = (
            select(Translation)
            .join(Language, Translation.language_id == Language.id)
            .where(
                and_(
                    Translation.kazakh_word_id.in_(word_ids),
                    Language.language_code == 'en'  # Default to English
                )
            )
        )
        translations_result = await db.execute(translations_query)
        translations = {t.kazakh_word_id: t.translation for t in translations_result.scalars().all()}
        
        # Build response
        guide_words = []
        for mapping, word, category, difficulty in mappings_data:
            guide_words.append(GuideWordMappingResponse(
                id=mapping.id,
                guide_id=mapping.guide_id,
                kazakh_word_id=mapping.kazakh_word_id,
                importance_score=mapping.importance_score,
                order_in_guide=mapping.order_in_guide,
                is_active=mapping.is_active,
                created_at=mapping.created_at.isoformat(),
                kazakh_word=word.kazakh_word,
                kazakh_cyrillic=word.kazakh_cyrillic,
                category_name=category.category_name,
                difficulty_level=difficulty.level_number,
                primary_translation=translations.get(word.id)
            ))
        
        return guide_words
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting guide words: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch guide words")

@admin_router.post("/guides/{guide_id}/words", response_model=Dict[str, Any])
async def add_words_to_guide(
    guide_id: int,
    request: AddWordsToGuideRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Add multiple words to a guide"""
    try:
        # Check if guide exists
        guide = await db.get(LearningGuide, guide_id)
        if not guide:
            raise HTTPException(status_code=404, detail="Guide not found")
        
        # Check if words exist
        words_query = select(KazakhWord).where(KazakhWord.id.in_(request.word_ids))
        words_result = await db.execute(words_query)
        existing_words = {w.id for w in words_result.scalars().all()}
        
        missing_words = set(request.word_ids) - existing_words
        if missing_words:
            raise HTTPException(
                status_code=400, 
                detail=f"Words not found: {list(missing_words)}"
            )
        
        # Check for existing mappings
        existing_mappings_query = (
            select(GuideWordMapping.kazakh_word_id)
            .where(
                and_(
                    GuideWordMapping.guide_id == guide_id,
                    GuideWordMapping.kazakh_word_id.in_(request.word_ids)
                )
            )
        )
        existing_mappings_result = await db.execute(existing_mappings_query)
        already_mapped = {m for m in existing_mappings_result.scalars().all()}
        
        new_word_ids = set(request.word_ids) - already_mapped
        
        if not new_word_ids:
            return {
                "message": "All words are already in the guide",
                "added_count": 0,
                "skipped_count": len(already_mapped),
                "total_requested": len(request.word_ids)
            }
        
        # Get current max order if auto_order is enabled
        current_max_order = 0
        if request.auto_order:
            max_order_query = (
                select(func.max(GuideWordMapping.order_in_guide))
                .where(GuideWordMapping.guide_id == guide_id)
            )
            max_order_result = await db.execute(max_order_query)
            current_max_order = max_order_result.scalar() or 0
        
        # Create new mappings
        new_mappings = []
        for i, word_id in enumerate(new_word_ids):
            order_in_guide = current_max_order + i + 1 if request.auto_order else None
            
            mapping = GuideWordMapping(
                guide_id=guide_id,
                kazakh_word_id=word_id,
                importance_score=request.importance_score,
                order_in_guide=order_in_guide,
                is_active=True
            )
            new_mappings.append(mapping)
        
        db.add_all(new_mappings)
        await db.commit()
        
        return {
            "message": f"Successfully added {len(new_mappings)} words to guide",
            "added_count": len(new_mappings),
            "skipped_count": len(already_mapped),
            "total_requested": len(request.word_ids),
            "guide_id": guide_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error adding words to guide: {e}")
        raise HTTPException(status_code=500, detail="Failed to add words to guide")

@admin_router.put("/guides/{guide_id}/words/{mapping_id}", response_model=GuideWordMappingResponse)
async def update_guide_word_mapping(
    guide_id: int,
    mapping_id: int,
    request: GuideWordMappingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Update a word mapping in a guide"""
    try:
        # Get the mapping
        mapping = await db.get(GuideWordMapping, mapping_id)
        if not mapping or mapping.guide_id != guide_id:
            raise HTTPException(status_code=404, detail="Mapping not found")
        
        # Update fields
        if request.importance_score is not None:
            mapping.importance_score = request.importance_score
        if request.order_in_guide is not None:
            mapping.order_in_guide = request.order_in_guide
        if request.is_active is not None:
            mapping.is_active = request.is_active
        
        await db.commit()
        await db.refresh(mapping)
        
        # Get additional data for response
        word_query = (
            select(KazakhWord, Category, DifficultyLevel, Translation)
            .join(Category, KazakhWord.category_id == Category.id)
            .join(DifficultyLevel, KazakhWord.difficulty_level_id == DifficultyLevel.id)
            .outerjoin(Translation, 
                and_(
                    Translation.kazakh_word_id == KazakhWord.id,
                    Translation.language_id == 1  # Assuming English is language_id 1
                )
            )
            .where(KazakhWord.id == mapping.kazakh_word_id)
        )
        word_result = await db.execute(word_query)
        word_data = word_result.first()
        
        if not word_data:
            raise HTTPException(status_code=404, detail="Word not found")
        
        word, category, difficulty, translation = word_data
        
        return GuideWordMappingResponse(
            id=mapping.id,
            guide_id=mapping.guide_id,
            kazakh_word_id=mapping.kazakh_word_id,
            importance_score=mapping.importance_score,
            order_in_guide=mapping.order_in_guide,
            is_active=mapping.is_active,
            created_at=mapping.created_at.isoformat(),
            kazakh_word=word.kazakh_word,
            kazakh_cyrillic=word.kazakh_cyrillic,
            category_name=category.category_name,
            difficulty_level=difficulty.level_number,
            primary_translation=translation.translation if translation else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating guide word mapping: {e}")
        raise HTTPException(status_code=500, detail="Failed to update mapping")

@admin_router.delete("/guides/{guide_id}/words/{mapping_id}")
async def remove_word_from_guide(
    guide_id: int,
    mapping_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Remove a word from a guide"""
    try:
        # Get the mapping
        mapping = await db.get(GuideWordMapping, mapping_id)
        if not mapping or mapping.guide_id != guide_id:
            raise HTTPException(status_code=404, detail="Mapping not found")
        
        await db.delete(mapping)
        await db.commit()
        
        return {"message": "Word removed from guide successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error removing word from guide: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove word from guide")

@admin_router.post("/guides/{guide_id}/words/reorder")
async def reorder_guide_words(
    guide_id: int,
    word_orders: List[Dict[str, int]],  # [{"mapping_id": 1, "order": 1}, ...]
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Reorder words in a guide"""
    try:
        # Validate guide exists
        guide = await db.get(LearningGuide, guide_id)
        if not guide:
            raise HTTPException(status_code=404, detail="Guide not found")
        
        # Get mapping IDs
        mapping_ids = [item["mapping_id"] for item in word_orders]
        
        # Get existing mappings
        mappings_query = (
            select(GuideWordMapping)
            .where(
                and_(
                    GuideWordMapping.guide_id == guide_id,
                    GuideWordMapping.id.in_(mapping_ids)
                )
            )
        )
        mappings_result = await db.execute(mappings_query)
        mappings = {m.id: m for m in mappings_result.scalars().all()}
        
        # Update orders
        for item in word_orders:
            mapping_id = item["mapping_id"]
            new_order = item["order"]
            
            if mapping_id in mappings:
                mappings[mapping_id].order_in_guide = new_order
        
        await db.commit()
        
        return {"message": f"Reordered {len(word_orders)} words successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error reordering guide words: {e}")
        raise HTTPException(status_code=500, detail="Failed to reorder words")

# Add the admin router to your main app
# In your main.py, add:
# app.include_router(admin_router)

@admin_router.post("/run-sentence-generation")
async def run_sentence_generation(
        background_tasks: BackgroundTasks,
        authorization: Optional[str] = Header(None),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Run the sentence generation script with the current user's token"""

    # Extract token from Authorization header
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
    else:
        # Create a new token for the script if not provided
        token = create_access_token(
            data={
                "sub": current_user.username,
                "user_id": current_user.id,
                "role": current_user.role.value,
            },
            expires_delta=timedelta(hours=24)
        )

    async def run_script():
        try:
            # Get Python executable and script path
            python_exe = sys.executable
            script_path = '..\\scripts\\run_sentence_generation.py'

            logger.info(f"=" * 50)
            logger.info(f"Starting sentence generation script")
            logger.info(f"Python executable: {python_exe}")
            logger.info(f"Script path: {script_path}")
            logger.info(f"Current directory: {os.getcwd()}")
            logger.info(f"Script exists: {os.path.exists(script_path)}")

            # Create script if it doesn't exist
            if not os.path.exists(script_path):
                logger.warning(f"Script not found, creating at: {script_path}")
                logger.info(f"Directory contents before: {os.listdir(os.getcwd())}")

            # Prepare command based on OS
            cmd_args = [
                python_exe,
                script_path,
                '--api-url', 'http://localhost:8000',
                '--token', token,
                '--max-words', '50',
                '--delay', '2'
            ]

            logger.info(f"Command: {' '.join(cmd_args)}")

            # Run the script
            if sys.platform == 'win32':
                # Windows
                process = await asyncio.create_subprocess_exec(
                    *cmd_args,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    creationflags=subprocess.CREATE_NO_WINDOW
                )
            else:
                # Unix/Linux/Mac
                process = await asyncio.create_subprocess_exec(
                    *cmd_args,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )

            # Wait for completion
            stdout, stderr = await process.communicate()

            if stdout:
                logger.info(f"Script output: {stdout.decode('utf-8', errors='ignore')}")
            if stderr:
                logger.error(f"Script errors: {stderr.decode('utf-8', errors='ignore')}")

            if process.returncode == 0:
                logger.info("Sentence generation completed successfully")
            else:
                logger.error(f"Sentence generation failed with code: {process.returncode}")

        except Exception as e:
            logger.error(f"Error running sentence generation: {e}")
            import traceback
            logger.error(traceback.format_exc())

    # Run in background
    background_tasks.add_task(run_script)

    return {
        "message": "Sentence generation started in background",
        "status": "processing",
        "details": {
            "user": current_user.username,
            "max_words": 50
        }
    }


@admin_router.get("/words-without-sentences")
async def get_words_without_sentences(
        limit: int = Query(100, ge=1, le=1000),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Get words that don't have example sentences"""

    # Query for words without sentences
    query = select(KazakhWord).outerjoin(
        ExampleSentence,
        KazakhWord.id == ExampleSentence.kazakh_word_id
    ).where(
        ExampleSentence.id.is_(None)
    ).limit(limit)

    result = await db.execute(query)
    words = result.scalars().all()

    # Format response
    word_list = []
    for word in words:
        word_data = {
            "id": word.id,
            "kazakh_word": word.kazakh_word,
            "kazakh_cyrillic": word.kazakh_cyrillic if hasattr(word, 'kazakh_cyrillic') else None,
            "difficulty_level": 2  # Default difficulty
        }

        # Try to get difficulty level if it exists
        if hasattr(word, 'difficulty_level_id'):
            word_data["difficulty_level"] = word.difficulty_level_id
        elif hasattr(word, 'difficulty_level') and word.difficulty_level:
            word_data["difficulty_level"] = word.difficulty_level.level

        word_list.append(word_data)

    return {
        "words": word_list,
        "total": len(word_list),
        "limit": limit
    }


@admin_router.get("/sentence-generation-status")
async def get_sentence_generation_status(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)
):
    """Check the status of sentence generation"""

    # Count words without sentences
    query = select(KazakhWord).outerjoin(
        ExampleSentence,
        KazakhWord.id == ExampleSentence.kazakh_word_id
    ).where(
        ExampleSentence.id.is_(None)
    )

    result = await db.execute(query)
    words_without_sentences = len(result.scalars().all())

    return {
        "status": "ready",
        "words_without_sentences": words_without_sentences,
        "message": f"{words_without_sentences} words need example sentences"
    }

@admin_router.post("/run-image-generation")
async def run_image_generation(
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Run the image generation script with the current user's token"""
    
    # Extract token from Authorization header
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
    else:
        # Create a new token for the script if not provided
        token = create_access_token(
            data={
                "sub": current_user.username,
                "user_id": current_user.id,
                "role": current_user.role.value,
            },
            expires_delta=timedelta(hours=24)
        )
    
    async def run_script():
        try:
            # Get Python executable and script path
            python_exe = sys.executable
            script_path = '..\\scripts\\run_image_generation.py'
            
            logger.info(f"=" * 50)
            logger.info(f"Starting image generation script")
            logger.info(f"Python executable: {python_exe}")
            logger.info(f"Script path: {script_path}")
            logger.info(f"Current directory: {os.getcwd()}")
            logger.info(f"Script exists: {os.path.exists(script_path)}")
            
            # Create script if it doesn't exist
            if not os.path.exists(script_path):
                logger.warning(f"Script not found, creating at: {script_path}")
                logger.info(f"Directory contents before: {os.listdir(os.getcwd())}")
            
            # Prepare command based on OS
            cmd_args = [
                python_exe, 
                script_path,
                '--api-url', 'http://localhost:8000',
                '--token', token,
                '--max-words', '20',  # Less words for images (they take longer)
                '--delay', '3'  # Longer delay for image generation
            ]
            
            logger.info(f"Command: {' '.join(cmd_args)}")
            
            # Run the script
            if sys.platform == 'win32':
                # Windows
                process = await asyncio.create_subprocess_exec(
                    *cmd_args,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    creationflags=subprocess.CREATE_NO_WINDOW
                )
            else:
                # Unix/Linux/Mac
                process = await asyncio.create_subprocess_exec(
                    *cmd_args,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
            
            # Wait for completion
            stdout, stderr = await process.communicate()
            
            if stdout:
                logger.info(f"Script output: {stdout.decode('utf-8', errors='ignore')}")
            if stderr:
                logger.error(f"Script errors: {stderr.decode('utf-8', errors='ignore')}")
            
            if process.returncode == 0:
                logger.info("Image generation completed successfully")
            else:
                logger.error(f"Image generation failed with code: {process.returncode}")
                
        except Exception as e:
            logger.error(f"Error running image generation: {e}")
            import traceback
            logger.error(traceback.format_exc())
    
    # Run in background
    background_tasks.add_task(run_script)
    
    return {
        "message": "Image generation started in background",
        "status": "processing",
        "details": {
            "user": current_user.username,
            "max_words": 20
        }
    }


@admin_router.get("/words-without-images")
async def get_words_without_images(
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Get words that don't have images"""
    
    from database import WordImage
    
    # Query for words without images
    query = select(KazakhWord).outerjoin(
        WordImage,
        KazakhWord.id == WordImage.kazakh_word_id
    ).where(
        WordImage.id.is_(None)
    ).limit(limit)
    
    result = await db.execute(query)
    words = result.scalars().all()
    
    # Format response
    word_list = []
    for word in words:
        word_data = {
            "id": word.id,
            "kazakh_word": word.kazakh_word,
            "kazakh_cyrillic": word.kazakh_cyrillic if hasattr(word, 'kazakh_cyrillic') else None,
            "category_id": word.category_id if hasattr(word, 'category_id') else None
        }
        word_list.append(word_data)
    
    return {
        "words": word_list,
        "total": len(word_list),
        "limit": limit
    }


@admin_router.get("/image-generation-status")
async def get_image_generation_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Check the status of image generation"""
    
    from database import WordImage
    
    # Count words without images
    query = select(KazakhWord).outerjoin(
        WordImage,
        KazakhWord.id == WordImage.kazakh_word_id
    ).where(
        WordImage.id.is_(None)
    )
    
    result = await db.execute(query)
    words_without_images = len(result.scalars().all())
    
    return {
        "status": "ready",
        "words_without_images": words_without_images,
        "message": f"{words_without_images} words need images"
    }

# Also add these imports to your main.py:
from sqlalchemy.orm import selectinload, joinedload
