# database/crud.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Optional, Dict, Any
from .models import (
    Language, Category, CategoryTranslation, WordType, WordTypeTranslation,
    DifficultyLevel, DifficultyLevelTranslation, KazakhWord, Pronunciation,
    Translation, WordImage, ExampleSentence, ExampleSentenceTranslation, WordSound
)

from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Optional, Dict, Any
from .models import (
    ExampleSentence, ExampleSentenceTranslation, Language, KazakhWord
)

# === In schemas.py file ===
# Add these imports at the top:
from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import List, Optional, Dict, Any

# === In main.py file ===
# Add these imports to your existing imports:
from sqlalchemy import select, func, or_, and_
from fastapi import Path  # Add this to your existing FastAPI imports

# And these to your database.schemas import:
from database.schemas import (
    # ... your existing imports ...
    ExampleSentenceCreate, ExampleSentenceUpdate, ExampleSentenceDetailResponse,
    ExampleSentenceTranslationCreate, ExampleSentenceTranslationUpdate,
    ExampleSentenceListResponse, BulkExampleSentenceCreate,
    SearchExampleSentencesRequest, ExampleSentenceStats
)

# === In learning_crud.py (if you plan to integrate with learning features) ===
# Add this import:
from .models import ExampleSentence, ExampleSentenceTranslation


class LanguageCRUD:
    @staticmethod
    async def get_all(db: AsyncSession, active_only: bool = True) -> List[Language]:
        """Get all languages"""
        query = select(Language)
        if active_only:
            query = query.where(Language.is_active == True)
        result = await db.execute(query.order_by(Language.language_name))
        return result.scalars().all()

    @staticmethod
    async def get_by_code(db: AsyncSession, language_code: str) -> Optional[Language]:
        """Get language by code"""
        result = await db.execute(select(Language).where(Language.language_code == language_code))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_id(db: AsyncSession, language_id: int) -> Optional[Language]:
        """Get language by ID"""
        result = await db.execute(select(Language).where(Language.id == language_id))
        return result.scalar_one_or_none()


class CategoryCRUD:
    @staticmethod
    async def get_all_with_translations(
            db: AsyncSession,
            language_code: str = "en",
            active_only: bool = True
    ) -> List[Category]:
        """Get all categories with translations for specified language"""
        query = (
            select(Category)
            .outerjoin(CategoryTranslation)
            .outerjoin(Language)
            .options(
                selectinload(Category.translations).joinedload(CategoryTranslation.language)
            )
            .where(
                and_(
                    Category.is_active == True if active_only else True,
                    or_(
                        Language.language_code == language_code,
                        Language.language_code == None  # Include categories without translations
                    )
                )
            )
            .order_by(Category.category_name)
        )

        result = await db.execute(query)
        categories = result.scalars().all()

        # Filter translations by language
        for category in categories:
            category.translations = [
                t for t in category.translations
                if t.language.language_code == language_code
            ]

        return categories

    @staticmethod
    async def get_by_id(
            db: AsyncSession,
            category_id: int,
            language_code: str = "en"
    ) -> Optional[Category]:
        """Get category by ID with translations"""
        query = (
            select(Category)
            .outerjoin(CategoryTranslation)
            .outerjoin(Language)
            .options(
                selectinload(Category.translations).joinedload(CategoryTranslation.language)
            )
            .where(
                and_(
                    Category.id == category_id,
                    or_(
                        Language.language_code == language_code,
                        Language.language_code == None  # Include categories without translations
                    )
                )
            )
        )

        result = await db.execute(query)
        category = result.scalar_one_or_none()

        if category and category.translations:
            category.translations = [
                t for t in category.translations
                if t.language.language_code == language_code
            ]

        return category


class WordTypeCRUD:
    @staticmethod
    async def get_all_with_translations(
            db: AsyncSession,
            language_code: str = "en",
            active_only: bool = True
    ) -> List[WordType]:
        """Get all word types with translations"""
        query = (
            select(WordType)
            .options(
                selectinload(WordType.translations).joinedload(WordTypeTranslation.language)
            )
        )
        if active_only:
            query = query.where(WordType.is_active == True)

        result = await db.execute(query.order_by(WordType.type_name))
        word_types = result.scalars().all()

        for word_type in word_types:
            word_type.translations = [
                t for t in word_type.translations
                if t.language.language_code == language_code
            ]

        return word_types


class DifficultyLevelCRUD:
    @staticmethod
    async def get_all_with_translations(
            db: AsyncSession,
            language_code: str = "en",
            active_only: bool = True
    ) -> List[DifficultyLevel]:
        """Get all difficulty levels with translations"""
        query = (
            select(DifficultyLevel)
            .options(
                selectinload(DifficultyLevel.translations).joinedload(DifficultyLevelTranslation.language)
            )
        )
        if active_only:
            query = query.where(DifficultyLevel.is_active == True)

        result = await db.execute(query.order_by(DifficultyLevel.level_number))
        levels = result.scalars().all()

        for level in levels:
            level.translations = [
                t for t in level.translations
                if t.language.language_code == language_code
            ]

        return levels

    @staticmethod
    async def get_words_paginated_optimized(
            db: AsyncSession,
            page: int = 1,
            page_size: int = 20,
            category_id: Optional[int] = None,
            word_type_id: Optional[int] = None,
            difficulty_level_id: Optional[int] = None,
            search: Optional[str] = None,
            language_code: str = "en"
    ) -> dict:
        """
        Optimized paginated word retrieval with minimal database queries
        """
        # Calculate offset
        offset = (page - 1) * page_size
        
        # Build base query with optimized joins
        base_query = (
            select(KazakhWord)
            .options(
                # Use joinedload for one-to-one relationships
                joinedload(KazakhWord.word_type),
                joinedload(KazakhWord.category),
                joinedload(KazakhWord.difficulty_level),
                # Use selectinload for one-to-many to avoid N+1 queries
                selectinload(KazakhWord.translations).joinedload(Translation.language),
                selectinload(KazakhWord.images).where(WordImage.is_primary == True)
            )
        )
        
        # Build count query (more efficient without joins for counting)
        count_query = select(func.count(KazakhWord.id))
        
        # Apply filters
        filters = []
        
        if category_id:
            filters.append(KazakhWord.category_id == category_id)
        
        if word_type_id:
            filters.append(KazakhWord.word_type_id == word_type_id)
        
        if difficulty_level_id:
            filters.append(KazakhWord.difficulty_level_id == difficulty_level_id)
        
        # Search optimization
        if search:
            search_term = f"%{search.lower()}%"
            
            # Create a subquery for translation search to improve performance
            translation_subquery = (
                select(Translation.kazakh_word_id)
                .join(Language)
                .where(
                    and_(
                        func.lower(Translation.translation).like(search_term),
                        Language.language_code == language_code
                    )
                )
            )
            
            search_filters = [
                func.lower(KazakhWord.kazakh_word).like(search_term),
                func.lower(KazakhWord.kazakh_cyrillic).like(search_term),
                KazakhWord.id.in_(translation_subquery)
            ]
            
            filters.append(or_(*search_filters))
        
        # Apply filters to both queries
        if filters:
            filter_condition = and_(*filters)
            base_query = base_query.where(filter_condition)
            count_query = count_query.where(filter_condition)
        
        # Execute count query first (it's usually faster)
        count_result = await db.execute(count_query)
        total_count = count_result.scalar()
        
        # Early return if no results
        if total_count == 0:
            return {
                'words': [],
                'total_count': 0,
                'total_pages': 0,
                'has_next': False,
                'has_previous': False,
                'current_page': page,
                'page_size': page_size
            }
        
        # Calculate pagination info
        total_pages = (total_count + page_size - 1) // page_size
        has_next = page < total_pages
        has_previous = page > 1
        
        # Execute main query with pagination
        main_query = (
            base_query
            .offset(offset)
            .limit(page_size)
            .order_by(KazakhWord.kazakh_word)  # Consistent ordering for pagination
        )
        
        result = await db.execute(main_query)
        words = result.scalars().unique().all()  # unique() to handle joined data
        
        return {
            'words': words,
            'total_count': total_count,
            'total_pages': total_pages,
            'has_next': has_next,
            'has_previous': has_previous,
            'current_page': page,
            'page_size': page_size,
            'start_index': offset + 1 if words else 0,
            'end_index': offset + len(words)
        }

    @staticmethod
    async def get_words_count_only(
            db: AsyncSession,
            category_id: Optional[int] = None,
            word_type_id: Optional[int] = None,
            difficulty_level_id: Optional[int] = None,
            search: Optional[str] = None,
            language_code: str = "en"
    ) -> int:
        """
        Fast count query for getting total words without fetching data
        Useful for pagination calculations
        """
        query = select(func.count(KazakhWord.id))
        
        filters = []
        
        if category_id:
            filters.append(KazakhWord.category_id == category_id)
        
        if word_type_id:
            filters.append(KazakhWord.word_type_id == word_type_id)
        
        if difficulty_level_id:
            filters.append(KazakhWord.difficulty_level_id == difficulty_level_id)
        
        if search:
            search_term = f"%{search.lower()}%"
            
            # Use EXISTS for better performance on large datasets
            translation_exists = (
                select(1)
                .select_from(Translation)
                .join(Language)
                .where(
                    and_(
                        Translation.kazakh_word_id == KazakhWord.id,
                        func.lower(Translation.translation).like(search_term),
                        Language.language_code == language_code
                    )
                )
                .exists()
            )
            
            search_filters = [
                func.lower(KazakhWord.kazakh_word).like(search_term),
                func.lower(KazakhWord.kazakh_cyrillic).like(search_term),
                translation_exists
            ]
            
            filters.append(or_(*search_filters))
        
        if filters:
            query = query.where(and_(*filters))
        
        result = await db.execute(query)
        return result.scalar()


class TranslationCRUD:
    @staticmethod
    async def create(
            db: AsyncSession,
            kazakh_word_id: int,
            language_id: int,
            translation: str,
            alternative_translations: Optional[List[str]] = None
    ) -> Translation:
        """Create a new translation"""
        db_translation = Translation(
            kazakh_word_id=kazakh_word_id,
            language_id=language_id,
            translation=translation,
            alternative_translations=alternative_translations
        )
        db.add(db_translation)
        await db.commit()
        await db.refresh(db_translation)
        return db_translation


class PronunciationCRUD:
    @staticmethod
    async def create(
            db: AsyncSession,
            kazakh_word_id: int,
            language_id: int,
            pronunciation: str,
            pronunciation_system: str,
            audio_file_path: Optional[str] = None
    ) -> Pronunciation:
        """Create a new pronunciation"""
        db_pronunciation = Pronunciation(
            kazakh_word_id=kazakh_word_id,
            language_id=language_id,
            pronunciation=pronunciation,
            pronunciation_system=pronunciation_system,
            audio_file_path=audio_file_path
        )
        db.add(db_pronunciation)
        await db.commit()
        await db.refresh(db_pronunciation)
        return db_pronunciation


class WordImageCRUD:
    @staticmethod
    async def create(
            db: AsyncSession,
            kazakh_word_id: int,
            image_url: str,  # Now expects URL instead of path
            image_type: str = "photo",
            alt_text: Optional[str] = None,
            is_primary: bool = False,
            source: Optional[str] = None,
            license: Optional[str] = None
    ) -> WordImage:
        """Create a new word image record with URL"""
        db_image = WordImage(
            kazakh_word_id=kazakh_word_id,
            image_url=image_url,
            image_type=image_type,
            alt_text=alt_text,
            is_primary=is_primary,
            source=source,
            license=license
        )
        db.add(db_image)
        await db.commit()
        await db.refresh(db_image)
        return db_image

    @staticmethod
    async def get_by_word_id(db: AsyncSession, kazakh_word_id: int) -> List[WordImage]:
        """Get all images for a given Kazakh word ID"""
        result = await db.execute(
            select(WordImage)
            .where(WordImage.kazakh_word_id == kazakh_word_id)
            .order_by(WordImage.is_primary.desc(), WordImage.created_at)
        )
        return result.scalars().all()

    @staticmethod
    async def get_primary_by_word_id(db: AsyncSession, kazakh_word_id: int) -> Optional[WordImage]:
        """Get the primary image for a given Kazakh word ID"""
        result = await db.execute(
            select(WordImage)
            .where(
                and_(
                    WordImage.kazakh_word_id == kazakh_word_id,
                    WordImage.is_primary == True
                )
            )
            .limit(1)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def update_primary_status(
            db: AsyncSession,
            kazakh_word_id: int,
            new_primary_image_id: int
    ) -> bool:
        """Update primary status for word images"""
        try:
            # First, set all images for this word to non-primary
            await db.execute(
                update(WordImage)
                .where(WordImage.kazakh_word_id == kazakh_word_id)
                .values(is_primary=False)
            )
            
            # Then set the specified image as primary
            result = await db.execute(
                update(WordImage)
                .where(
                    and_(
                        WordImage.id == new_primary_image_id,
                        WordImage.kazakh_word_id == kazakh_word_id
                    )
                )
                .values(is_primary=True)
            )
            
            await db.commit()
            return result.rowcount > 0
        except Exception:
            await db.rollback()
            return False

    @staticmethod
    async def delete_by_id(db: AsyncSession, image_id: int) -> bool:
        """Delete image by ID"""
        try:
            result = await db.execute(
                delete(WordImage).where(WordImage.id == image_id)
            )
            await db.commit()
            return result.rowcount > 0
        except Exception:
            await db.rollback()
            return False


class ExampleSentenceCRUD:
    @staticmethod
    async def create(
            db: AsyncSession,
            kazakh_word_id: int,
            kazakh_sentence: str,
            difficulty_level: int = 1,
            usage_context: Optional[str] = None
    ) -> ExampleSentence:
        """Create a new example sentence"""
        db_sentence = ExampleSentence(
            kazakh_word_id=kazakh_word_id,
            kazakh_sentence=kazakh_sentence,
            difficulty_level=difficulty_level,
            usage_context=usage_context
        )
        db.add(db_sentence)
        await db.commit()
        await db.refresh(db_sentence)
        return db_sentence


class WordSoundCRUD:
    @staticmethod
    async def create(
        db: AsyncSession,
        kazakh_word_id: int,
        sound_url: str,  # Now expects URL instead of path
        sound_type: Optional[str] = "pronunciation",
        alt_text: Optional[str] = None
    ) -> WordSound:
        """Create a new word sound record with URL"""
        db_sound = WordSound(
            kazakh_word_id=kazakh_word_id,
            sound_url=sound_url,
            sound_type=sound_type,
            alt_text=alt_text
        )
        db.add(db_sound)
        await db.commit()
        await db.refresh(db_sound)
        return db_sound

    @staticmethod
    async def get_by_word_id(db: AsyncSession, kazakh_word_id: int) -> List[WordSound]:
        """Get all sounds for a given Kazakh word ID"""
        result = await db.execute(
            select(WordSound)
            .where(WordSound.kazakh_word_id == kazakh_word_id)
            .order_by(WordSound.created_at)
        )
        return result.scalars().all()

    @staticmethod
    async def get_by_id(db: AsyncSession, sound_id: int) -> Optional[WordSound]:
        """Get sound by ID"""
        result = await db.execute(select(WordSound).where(WordSound.id == sound_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def delete_by_id(db: AsyncSession, sound_id: int) -> bool:
        """Delete sound by ID"""
        try:
            result = await db.execute(
                delete(WordSound).where(WordSound.id == sound_id)
            )
            await db.commit()
            return result.rowcount > 0
        except Exception:
            await db.rollback()
            return False
    
# Add these methods to your WordImageCRUD class in crud.py

class WordImageCRUD:
    @staticmethod
    async def create(
            db: AsyncSession,
            kazakh_word_id: int,
            image_url: str,
            image_type: str = "illustration",
            alt_text: Optional[str] = None,
            is_primary: bool = False,
            source: Optional[str] = None
    ) -> WordImage:
        """Create a new word image"""
        db_image = WordImage(
            kazakh_word_id=kazakh_word_id,
            image_url=image_url,
            image_type=image_type,
            alt_text=alt_text,
            is_primary=is_primary,
            source=source
        )
        db.add(db_image)
        await db.commit()
        await db.refresh(db_image)
        return db_image

    @staticmethod
    async def get_by_word_id(db: AsyncSession, kazakh_word_id: int) -> List[WordImage]:
        """Get all images for a given Kazakh word ID"""
        result = await db.execute(
            select(WordImage)
            .where(WordImage.kazakh_word_id == kazakh_word_id)
            .order_by(WordImage.is_primary.desc(), WordImage.created_at)
        )
        return result.scalars().all()

    @staticmethod
    async def get_primary_by_word_id(db: AsyncSession, kazakh_word_id: int) -> Optional[WordImage]:
        """Get the primary image for a given Kazakh word ID"""
        result = await db.execute(
            select(WordImage)
            .where(
                and_(
                    WordImage.kazakh_word_id == kazakh_word_id,
                    WordImage.is_primary == True
                )
            )
            .limit(1)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_id(db: AsyncSession, image_id: int) -> Optional[WordImage]:
        """Get image by ID"""
        result = await db.execute(select(WordImage).where(WordImage.id == image_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def update_primary_status(
            db: AsyncSession,
            kazakh_word_id: int,
            new_primary_image_id: int
    ) -> bool:
        """Update primary status for word images - set one as primary, others as non-primary"""
        try:
            # First, set all images for this word to non-primary
            await db.execute(
                update(WordImage)
                .where(WordImage.kazakh_word_id == kazakh_word_id)
                .values(is_primary=False)
            )
            
            # Then set the specified image as primary
            result = await db.execute(
                update(WordImage)
                .where(
                    and_(
                        WordImage.id == new_primary_image_id,
                        WordImage.kazakh_word_id == kazakh_word_id
                    )
                )
                .values(is_primary=True)
            )
            
            await db.commit()
            return result.rowcount > 0
        except Exception:
            await db.rollback()
            return False

    @staticmethod
    async def delete_by_id(db: AsyncSession, image_id: int) -> bool:
        """Delete image by ID"""
        try:
            result = await db.execute(
                delete(WordImage).where(WordImage.id == image_id)
            )
            await db.commit()
            return result.rowcount > 0
        except Exception:
            await db.rollback()
            return False

class ExampleSentenceCRUD:
    @staticmethod
    async def create(
            db: AsyncSession,
            kazakh_word_id: int,
            kazakh_sentence: str,
            difficulty_level: int = 1,
            usage_context: Optional[str] = None
    ) -> ExampleSentence:
        """Create a new example sentence"""
        db_sentence = ExampleSentence(
            kazakh_word_id=kazakh_word_id,
            kazakh_sentence=kazakh_sentence,
            difficulty_level=difficulty_level,
            usage_context=usage_context
        )
        db.add(db_sentence)
        await db.commit()
        await db.refresh(db_sentence)
        return db_sentence
    
    @staticmethod
    async def get_by_id_raw(
            db: AsyncSession,
            sentence_id: int
    ) -> Optional[ExampleSentence]:
        """Get example sentence by ID WITHOUT filtering translations"""
        result = await db.execute(
            select(ExampleSentence)
            .where(ExampleSentence.id == sentence_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_id(
            db: AsyncSession,
            sentence_id: int,
            language_code: str = "en"
    ) -> Optional[ExampleSentence]:
        """Get example sentence by ID with translations"""
        result = await db.execute(
            select(ExampleSentence)
            .options(
                selectinload(ExampleSentence.translations)
                .selectinload(ExampleSentenceTranslation.language),
                selectinload(ExampleSentence.kazakh_word)
            )
            .where(ExampleSentence.id == sentence_id)
        )
        sentence = result.scalar_one_or_none()
        
        if sentence and sentence.translations:
            # Filter translations by language
            sentence.translations = [
                t for t in sentence.translations
                if t.language.language_code == language_code
            ]
        
        return sentence

    @staticmethod
    async def get_by_word_id(
            db: AsyncSession,
            word_id: int,
            language_code: str = "en"
    ) -> List[ExampleSentence]:
        """Get all example sentences for a word"""
        result = await db.execute(
            select(ExampleSentence)
            .options(
                selectinload(ExampleSentence.translations)
                .selectinload(ExampleSentenceTranslation.language)
            )
            .where(ExampleSentence.kazakh_word_id == word_id)
            .order_by(ExampleSentence.difficulty_level, ExampleSentence.created_at)
        )
        sentences = result.scalars().all()
        
        # Filter translations by language
        for sentence in sentences:
            sentence.translations = [
                t for t in sentence.translations
                if t.language.language_code == language_code
            ]
        
        return sentences

    @staticmethod
    async def update(
            db: AsyncSession,
            sentence_id: int,
            kazakh_sentence: Optional[str] = None,
            difficulty_level: Optional[int] = None,
            usage_context: Optional[str] = None
    ) -> Optional[ExampleSentence]:
        """Update example sentence"""
        update_data = {}
        if kazakh_sentence is not None:
            update_data["kazakh_sentence"] = kazakh_sentence
        if difficulty_level is not None:
            update_data["difficulty_level"] = difficulty_level
        if usage_context is not None:
            update_data["usage_context"] = usage_context
        
        if not update_data:
            return await ExampleSentenceCRUD.get_by_id(db, sentence_id)
        
        stmt = (
            update(ExampleSentence)
            .where(ExampleSentence.id == sentence_id)
            .values(**update_data)
            .returning(ExampleSentence)
        )
        
        result = await db.execute(stmt)
        await db.commit()
        return result.scalar_one_or_none()

    @staticmethod
    async def delete(db: AsyncSession, sentence_id: int) -> bool:
        """Delete example sentence"""
        stmt = delete(ExampleSentence).where(ExampleSentence.id == sentence_id)
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount > 0


class ExampleSentenceTranslationCRUD:
    @staticmethod
    async def create(
            db: AsyncSession,
            example_sentence_id: int,
            language_id: int,
            translated_sentence: str
    ) -> ExampleSentenceTranslation:
        """Create a new example sentence translation with better error handling"""
        
        # Создаем новую запись
        db_translation = ExampleSentenceTranslation(
            example_sentence_id=example_sentence_id,
            language_id=language_id,
            translated_sentence=translated_sentence
        )
        
        db.add(db_translation)
        
        try:
            await db.commit()
            await db.refresh(db_translation)
            return db_translation
        except Exception as e:
            await db.rollback()
            # Проверяем, является ли это ошибкой уникального constraint
            error_msg = str(e).lower()
            if any(keyword in error_msg for keyword in ['unique', 'duplicate', 'already exists']):
                raise ValueError("Translation already exists for this sentence and language")
            raise e

    @staticmethod
    async def get_by_sentence_and_language(
            db: AsyncSession,
            sentence_id: int,
            language_code: str
    ) -> Optional[ExampleSentenceTranslation]:
        """Get translation by sentence ID and language code"""
        result = await db.execute(
            select(ExampleSentenceTranslation)
            .join(Language)
            .where(
                and_(
                    ExampleSentenceTranslation.example_sentence_id == sentence_id,
                    Language.language_code == language_code
                )
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def update(
            db: AsyncSession,
            translation_id: int,
            translated_sentence: str
    ) -> Optional[ExampleSentenceTranslation]:
        """Update example sentence translation"""
        stmt = (
            update(ExampleSentenceTranslation)
            .where(ExampleSentenceTranslation.id == translation_id)
            .values(translated_sentence=translated_sentence)
            .returning(ExampleSentenceTranslation)
        )
        
        result = await db.execute(stmt)
        await db.commit()
        return result.scalar_one_or_none()

    @staticmethod
    async def delete(db: AsyncSession, translation_id: int) -> bool:
        """Delete example sentence translation"""
        stmt = delete(ExampleSentenceTranslation).where(
            ExampleSentenceTranslation.id == translation_id
        )
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount > 0

    @staticmethod
    async def get_all_for_sentence(
            db: AsyncSession,
            sentence_id: int
    ) -> List[ExampleSentenceTranslation]:
        """Get all translations for a sentence"""
        result = await db.execute(
            select(ExampleSentenceTranslation)
            .options(selectinload(ExampleSentenceTranslation.language))
            .where(ExampleSentenceTranslation.example_sentence_id == sentence_id)
            .order_by(ExampleSentenceTranslation.language_id)
        )
        return result.scalars().all()
    
# Add these methods to your KazakhWordCRUD class in database/crud.py

class KazakhWordCRUD:
    @staticmethod
    async def create(
            db: AsyncSession,
            kazakh_word: str,
            kazakh_cyrillic: str,
            word_type_id: int,
            category_id: int,
            difficulty_level_id: int = 1
    ) -> KazakhWord:
        """Create a new Kazakh word"""
        db_word = KazakhWord(
            kazakh_word=kazakh_word,
            kazakh_cyrillic=kazakh_cyrillic,
            word_type_id=word_type_id,
            category_id=category_id,
            difficulty_level_id=difficulty_level_id
        )
        db.add(db_word)
        await db.commit()
        await db.refresh(db_word)
        return db_word

    @staticmethod
    async def get_by_id(db: AsyncSession, word_id: int) -> Optional[KazakhWord]:
        """Get word by ID - MISSING METHOD"""
        result = await db.execute(
            select(KazakhWord).where(KazakhWord.id == word_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_id_with_relations(
            db: AsyncSession, 
            word_id: int
    ) -> Optional[KazakhWord]:
        """Get word by ID with all related data loaded"""
        result = await db.execute(
            select(KazakhWord)
            .options(
                joinedload(KazakhWord.word_type),
                joinedload(KazakhWord.category),
                joinedload(KazakhWord.difficulty_level),
                selectinload(KazakhWord.translations).joinedload(Translation.language),
                selectinload(KazakhWord.pronunciations).joinedload(Pronunciation.language),
                selectinload(KazakhWord.images),
                selectinload(KazakhWord.example_sentences).selectinload(ExampleSentence.translations)
            )
            .where(KazakhWord.id == word_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_id_full(
            db: AsyncSession,
            word_id: int,
            language_code: str = "en"
    ) -> Optional[KazakhWord]:
        """Get word by ID with all related data and filtered translations"""
        result = await db.execute(
            select(KazakhWord)
            .options(
                joinedload(KazakhWord.word_type).selectinload(WordType.translations).joinedload(
                    WordTypeTranslation.language),
                joinedload(KazakhWord.category).selectinload(Category.translations).joinedload(
                    CategoryTranslation.language),
                joinedload(KazakhWord.difficulty_level).selectinload(DifficultyLevel.translations).joinedload(
                    DifficultyLevelTranslation.language),
                selectinload(KazakhWord.translations).joinedload(Translation.language),
                selectinload(KazakhWord.pronunciations).joinedload(Pronunciation.language),
                selectinload(KazakhWord.images),
                selectinload(KazakhWord.example_sentences).selectinload(ExampleSentence.translations).joinedload(
                    ExampleSentenceTranslation.language)
            )
            .where(KazakhWord.id == word_id)
        )
        word = result.scalar_one_or_none()

        if word:
            # Filter translations by language
            word.translations = [
                t for t in word.translations
                if t.language.language_code == language_code
            ]
            word.pronunciations = [
                p for p in word.pronunciations
                if p.language.language_code == language_code
            ]

            # Filter example sentence translations
            for sentence in word.example_sentences:
                sentence.translations = [
                    t for t in sentence.translations
                    if t.language.language_code == language_code
                ]

        return word

    @staticmethod
    async def update(
            db: AsyncSession,
            word_id: int,
            kazakh_word: Optional[str] = None,
            kazakh_cyrillic: Optional[str] = None,
            word_type_id: Optional[int] = None,
            category_id: Optional[int] = None,
            difficulty_level_id: Optional[int] = None
    ) -> Optional[KazakhWord]:
        """Update a Kazakh word"""
        # First, get the existing word
        result = await db.execute(
            select(KazakhWord).where(KazakhWord.id == word_id)
        )
        word = result.scalar_one_or_none()
        
        if not word:
            return None

        # Update fields if provided
        if kazakh_word is not None:
            word.kazakh_word = kazakh_word
        if kazakh_cyrillic is not None:
            word.kazakh_cyrillic = kazakh_cyrillic
        if word_type_id is not None:
            word.word_type_id = word_type_id
        if category_id is not None:
            word.category_id = category_id
        if difficulty_level_id is not None:
            word.difficulty_level_id = difficulty_level_id

        await db.commit()
        await db.refresh(word)
        return word

    @staticmethod
    async def delete(db: AsyncSession, word_id: int) -> bool:
        """Delete a Kazakh word and all related data"""
        try:
            # Get the word first to check if it exists
            result = await db.execute(
                select(KazakhWord).where(KazakhWord.id == word_id)
            )
            word = result.scalar_one_or_none()
            
            if not word:
                return False

            # Delete the word (cascading will handle related data)
            await db.execute(
                delete(KazakhWord).where(KazakhWord.id == word_id)
            )
            
            await db.commit()
            return True
            
        except Exception as e:
            await db.rollback()
            print(f"Error deleting word {word_id}: {e}")
            return False

    @staticmethod
    async def get_all(
            db: AsyncSession,
            skip: int = 0,
            limit: int = 100,
            category_id: Optional[int] = None,
            word_type_id: Optional[int] = None,
            difficulty_level_id: Optional[int] = None
    ) -> List[KazakhWord]:
        """Get all words with optional filters (legacy method)"""
        query = select(KazakhWord)

        # Apply filters
        if category_id:
            query = query.where(KazakhWord.category_id == category_id)
        if word_type_id:
            query = query.where(KazakhWord.word_type_id == word_type_id)
        if difficulty_level_id:
            query = query.where(KazakhWord.difficulty_level_id == difficulty_level_id)

        # Add ordering, offset, and limit
        query = query.offset(skip).limit(limit).order_by(KazakhWord.kazakh_word)

        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_all_paginated(
            db: AsyncSession,
            skip: int = 0,
            limit: int = 100,
            category_id: Optional[int] = None,
            word_type_id: Optional[int] = None,
            difficulty_level_id: Optional[int] = None,
            language_code: str = "en"
    ) -> List[KazakhWord]:
        """Get paginated list of words with filters"""
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
        if category_id:
            query = query.where(KazakhWord.category_id == category_id)
        if word_type_id:
            query = query.where(KazakhWord.word_type_id == word_type_id)
        if difficulty_level_id:
            query = query.where(KazakhWord.difficulty_level_id == difficulty_level_id)

        # Add ordering and pagination
        query = query.offset(skip).limit(limit).order_by(KazakhWord.kazakh_word)

        result = await db.execute(query)
        words = result.scalars().all()

        # Post-process to filter translations and images
        for word in words:
            word.translations = [
                t for t in word.translations
                if t.language.language_code == language_code
            ]
            word.images = [img for img in word.images if img.is_primary]

        return words

    @staticmethod
    async def search_words(
            db: AsyncSession,
            search_term: str,
            language_code: str = "en",
            limit: int = 20
    ) -> List[KazakhWord]:
        """Search words by Kazakh word or translation"""
        # First query: Search in Kazakh words
        kazakh_query = (
            select(KazakhWord)
            .options(
                joinedload(KazakhWord.word_type),
                joinedload(KazakhWord.category),
                joinedload(KazakhWord.difficulty_level),
                selectinload(KazakhWord.translations).joinedload(Translation.language),
                selectinload(KazakhWord.images)
            )
            .where(
                or_(
                    KazakhWord.kazakh_word.ilike(f"%{search_term}%"),
                    KazakhWord.kazakh_cyrillic.ilike(f"%{search_term}%")
                )
            )
            .limit(limit)
        )

        # Second query: Search in translations
        translation_query = (
            select(KazakhWord)
            .options(
                joinedload(KazakhWord.word_type),
                joinedload(KazakhWord.category),
                joinedload(KazakhWord.difficulty_level),
                selectinload(KazakhWord.translations).joinedload(Translation.language),
                selectinload(KazakhWord.images)
            )
            .join(Translation)
            .join(Language)
            .where(
                and_(
                    Translation.translation.ilike(f"%{search_term}%"),
                    Language.language_code == language_code
                )
            )
            .limit(limit)
        )

        # Execute both queries
        kazakh_result = await db.execute(kazakh_query)
        translation_result = await db.execute(translation_query)

        kazakh_words = kazakh_result.scalars().all()
        translation_words = translation_result.scalars().all()

        # Combine and deduplicate results
        all_words_dict = {}
        for word in kazakh_words + translation_words:
            all_words_dict[word.id] = word

        all_words = list(all_words_dict.values())

        # Post-process to filter translations and images
        for word in all_words:
            word.translations = [
                t for t in word.translations
                if t.language.language_code == language_code
            ]
            word.images = [img for img in word.images if img.is_primary]

        return all_words[:limit]

    @staticmethod
    async def get_random_words(
        db: AsyncSession,
        count: int = 10,
        difficulty_level_id: Optional[int] = None,
        category_id: Optional[int] = None,
        language_code: str = "en",
        exclude_word_ids: Optional[List[int]] = None
    ) -> List[KazakhWord]:
        """
        Get random words with translations in the specified language.
        Ensures all returned words have translations in the user's language.
        Excludes specified word IDs to avoid duplicates.
        """
        from sqlalchemy import and_, or_, func, select
        from sqlalchemy.orm import selectinload, joinedload
        
        # Base query
        query = select(KazakhWord).options(
            selectinload(KazakhWord.translations).selectinload(Translation.language),
            selectinload(KazakhWord.category),
            selectinload(KazakhWord.difficulty_level),
            selectinload(KazakhWord.word_type)
        )
        
        # Build filters
        filters = []
        
        if difficulty_level_id:
            filters.append(KazakhWord.difficulty_level_id == difficulty_level_id)
        
        if category_id:
            filters.append(KazakhWord.category_id == category_id)
        
        if exclude_word_ids:
            filters.append(~KazakhWord.id.in_(exclude_word_ids))
        
        # Join with translations to ensure words have translations in the requested language
        query = query.join(Translation).join(Language).where(
            Language.language_code == language_code
        )
        
        # Apply additional filters
        if filters:
            query = query.where(and_(*filters))
        
        # Random order and get more than needed for proper filtering
        query = query.order_by(func.random()).limit(count * 3)
        
        result = await db.execute(query)
        words = result.scalars().all()
        
        # Post-process to ensure unique translations and proper language filtering
        filtered_words = []
        seen_translations = set()
        
        for word in words:
            if len(filtered_words) >= count:
                break
                
            # Find translations in the requested language
            user_language_translations = [
                t for t in word.translations 
                if t.language.language_code == language_code
            ]
            
            if not user_language_translations:
                continue  # Skip words without translation in user's language
            
            # Get the primary translation
            primary_translation = user_language_translations[0].translation
            
            # Skip if we've already seen this translation (avoid duplicates)
            if primary_translation in seen_translations:
                continue
            
            # Filter word's translations to only include the requested language
            word.translations = user_language_translations
            
            seen_translations.add(primary_translation)
            filtered_words.append(word)
            
            print(f"   ✅ Added random word: {word.kazakh_word} -> {primary_translation}")
        
        print(f"🎲 Retrieved {len(filtered_words)} random words with {language_code} translations")
        return filtered_words

    @staticmethod
    async def count_words(
            db: AsyncSession,
            category_id: Optional[int] = None,
            word_type_id: Optional[int] = None,
            difficulty_level_id: Optional[int] = None
    ) -> int:
        """Count total words with optional filters"""
        query = select(func.count(KazakhWord.id))

        # Apply filters
        if category_id:
            query = query.where(KazakhWord.category_id == category_id)
        if word_type_id:
            query = query.where(KazakhWord.word_type_id == word_type_id)
        if difficulty_level_id:
            query = query.where(KazakhWord.difficulty_level_id == difficulty_level_id)

        result = await db.execute(query)
        return result.scalar()

    @staticmethod
    async def exists_by_name(
            db: AsyncSession,
            kazakh_word: str,
            exclude_id: Optional[int] = None
    ) -> bool:
        """Check if a word with the same name already exists"""
        query = select(KazakhWord).where(
            func.lower(KazakhWord.kazakh_word) == func.lower(kazakh_word)
        )
        
        if exclude_id:
            query = query.where(KazakhWord.id != exclude_id)
        
        result = await db.execute(query)
        return result.scalar_one_or_none() is not None
    
@staticmethod
async def get_random_words_with_guaranteed_translations(
    db: AsyncSession,
    count: int,
    user_language_code: str,
    exclude_word_ids: Optional[List[int]] = None,
    category_id: Optional[int] = None,
    difficulty_level_id: Optional[int] = None
) -> List[KazakhWord]:
    """
    Get exactly 'count' random words that are guaranteed to have translations 
    in the specified language. Returns fewer words if not enough are available.
    """
    # Start with a larger search to account for filtering
    search_multiplier = 5
    max_attempts = 3
    found_words = []
    
    for attempt in range(max_attempts):
        search_count = min(count * search_multiplier, 500)  # Cap at 500 to avoid huge queries
        
        # Base query
        query = select(KazakhWord).options(
            selectinload(KazakhWord.translations).selectinload(Translation.language),
            selectinload(KazakhWord.category),
            selectinload(KazakhWord.difficulty_level)
        )
        
        # Apply filters
        if exclude_word_ids:
            query = query.where(~KazakhWord.id.in_(exclude_word_ids))
        
        if category_id:
            query = query.where(KazakhWord.category_id == category_id)
        
        if difficulty_level_id:
            query = query.where(KazakhWord.difficulty_level_id == difficulty_level_id)
        
        # Ensure words have translations in the target language
        query = query.join(Translation).join(Language).where(
            Language.language_code == user_language_code
        )
        
        # Get random sample
        query = query.order_by(func.random()).limit(search_count)
        
        result = await db.execute(query)
        candidate_words = result.scalars().all()
        
        # Filter for valid translations
        for word in candidate_words:
            if len(found_words) >= count:
                break
                
            # Verify valid translation exists
            has_valid_translation = any(
                (t.language.language_code == user_language_code and 
                 t.translation and 
                 t.translation.strip())
                for t in word.translations 
                if t.language
            )
            
            if has_valid_translation:
                found_words.append(word)
        
        # If we have enough, stop searching
        if len(found_words) >= count:
            break
        
        # Increase search scope for next attempt
        search_multiplier += 3
    
    return found_words[:count]  # Return exactly count or fewer