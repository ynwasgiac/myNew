# database/guide_crud.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Optional, Dict, Any
from datetime import datetime

from .models import KazakhWord, Translation, Category, DifficultyLevel, Language
from .learning_models import (
    LearningGuide, UserGuideProgress, GuideWordMapping, GuideTranslation,
    GuideStatus, LearningStatus, UserWordProgress
)
from .auth_models import User
from database.learning_models import (
    LearningGuide, UserGuideProgress, GuideWordMapping, 
    GuideStatus, LearningStatus, UserWordProgress  # ✅ Add all needed enums
)


class LearningGuideCRUD:
    """CRUD operations for learning guides with multilingual support"""

    @staticmethod
    async def get_all_guides(
        db: AsyncSession,
        difficulty: Optional[str] = None,
        is_active: bool = True,
        language_code: str = 'en'
    ) -> List[LearningGuide]:
        """Get all learning guides with translations"""
        query = (
            select(LearningGuide)
            .options(
                selectinload(LearningGuide.translations).selectinload(GuideTranslation.language)
            )
            .where(LearningGuide.is_active == is_active)
        )
        
        if difficulty:
            query = query.where(LearningGuide.difficulty_level == difficulty)
        
        query = query.order_by(LearningGuide.sort_order, LearningGuide.id)
        
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_guide_by_key(
        db: AsyncSession,
        guide_key: str,
        language_code: str = 'en'
    ) -> Optional[LearningGuide]:
        """Get guide by key with translations"""
        query = (
            select(LearningGuide)
            .options(
                selectinload(LearningGuide.translations).selectinload(GuideTranslation.language)
            )
            .where(
                and_(
                    LearningGuide.guide_key == guide_key,
                    LearningGuide.is_active == True
                )
            )
        )
        
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_guide_by_id(
        db: AsyncSession,
        guide_id: int,
        language_code: str = 'en'
    ) -> Optional[LearningGuide]:
        """✅ ДОБАВЛЕНО: Get guide by ID with translations"""
        query = (
            select(LearningGuide)
            .options(
                selectinload(LearningGuide.translations).selectinload(GuideTranslation.language)
            )
            .where(
                and_(
                    LearningGuide.id == guide_id,
                    LearningGuide.is_active == True
                )
            )
        )
        
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_guide_words(
        db: AsyncSession,
        guide_id: int,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get words for a specific guide with full word details"""
        query = (
            select(GuideWordMapping)
            .options(
                joinedload(GuideWordMapping.kazakh_word)
                .joinedload(KazakhWord.category),
                joinedload(GuideWordMapping.kazakh_word)
                .joinedload(KazakhWord.difficulty_level),
                joinedload(GuideWordMapping.kazakh_word)
                .joinedload(KazakhWord.word_type),
                joinedload(GuideWordMapping.kazakh_word)
                .joinedload(KazakhWord.translations)
                .joinedload(Translation.language)
            )
            .where(
                and_(
                    GuideWordMapping.guide_id == guide_id,
                    GuideWordMapping.is_active == True
                )
            )
            .order_by(
                GuideWordMapping.order_in_guide.asc().nulls_last(),
                GuideWordMapping.importance_score.desc()
            )
            .limit(limit)
        )
        
        result = await db.execute(query)
        mappings = result.scalars().unique().all()
        
        # Format response with word and guide info
        words = []
        for mapping in mappings:
            words.append({
                'word': mapping.kazakh_word,
                'guide_info': {
                    'importance_score': mapping.importance_score,
                    'order_in_guide': mapping.order_in_guide,
                    'mapping_id': mapping.id
                }
            })
        
        return words

    @staticmethod
    async def create_guide(
        db: AsyncSession,
        guide_data: Dict[str, Any],
        language_code: str = 'en'
    ) -> LearningGuide:
        """Create a new learning guide"""
        guide = LearningGuide(
            guide_key=guide_data['guide_key'],
            title=guide_data['title'],
            description=guide_data.get('description'),
            icon_name=guide_data.get('icon_name', 'BookOpen'),
            color=guide_data.get('color', 'blue'),
            difficulty_level=guide_data['difficulty_level'],
            target_word_count=guide_data['target_word_count'],
            estimated_minutes=guide_data.get('estimated_minutes'),
            topics=guide_data.get('topics', []),
            keywords=guide_data.get('keywords', []),
            is_active=guide_data.get('is_active', True),
            sort_order=guide_data.get('sort_order', 0)
        )
        
        db.add(guide)
        await db.commit()
        await db.refresh(guide)
        
        return guide

    @staticmethod
    async def update_guide(
        db: AsyncSession,
        guide_id: int,
        update_data: Dict[str, Any]
    ) -> Optional[LearningGuide]:
        """Update a learning guide"""
        query = select(LearningGuide).where(LearningGuide.id == guide_id)
        result = await db.execute(query)
        guide = result.scalar_one_or_none()
        
        if not guide:
            return None
        
        for key, value in update_data.items():
            if hasattr(guide, key):
                setattr(guide, key, value)
        
        await db.commit()
        await db.refresh(guide)
        
        return guide

    @staticmethod
    async def delete_guide(
        db: AsyncSession,
        guide_id: int
    ) -> bool:
        """Delete a learning guide"""
        query = select(LearningGuide).where(LearningGuide.id == guide_id)
        result = await db.execute(query)
        guide = result.scalar_one_or_none()
        
        if not guide:
            return False
        
        await db.delete(guide)
        await db.commit()
        
        return True


class GuideTranslationCRUD:
    """CRUD operations for guide translations"""

    @staticmethod
    async def create_translation(
        db: AsyncSession,
        guide_id: int,
        language_code: str,
        title: str,
        description: Optional[str] = None,
        topics: Optional[List[str]] = None
    ) -> GuideTranslation:
        """Create or update a guide translation"""
        # Get language ID
        lang_query = select(Language).where(Language.language_code == language_code)
        lang_result = await db.execute(lang_query)
        language = lang_result.scalar_one_or_none()
        
        if not language:
            raise ValueError(f"Language '{language_code}' not found")

        # Check if translation already exists
        existing_query = select(GuideTranslation).where(
            and_(
                GuideTranslation.guide_id == guide_id,
                GuideTranslation.language_id == language.id
            )
        )
        existing_result = await db.execute(existing_query)
        existing = existing_result.scalar_one_or_none()

        if existing:
            # Update existing translation
            existing.translated_title = title
            existing.translated_description = description
            existing.translated_topics = topics
            existing.updated_at = datetime.utcnow()
            await db.commit()
            await db.refresh(existing)
            return existing
        else:
            # Create new translation
            translation = GuideTranslation(
                guide_id=guide_id,
                language_id=language.id,
                translated_title=title,
                translated_description=description,
                translated_topics=topics
            )
            db.add(translation)
            await db.commit()
            await db.refresh(translation)
            return translation

    @staticmethod
    async def get_translations_for_guide(
        db: AsyncSession,
        guide_id: int
    ) -> List[GuideTranslation]:
        """Get all translations for a guide"""
        query = (
            select(GuideTranslation)
            .options(selectinload(GuideTranslation.language))
            .where(GuideTranslation.guide_id == guide_id)
        )
        
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def bulk_create_translations(
        db: AsyncSession,
        translations_data: List[Dict[str, Any]]
    ) -> int:
        """Bulk create translations for multiple guides"""
        created_count = 0
        
        for translation_data in translations_data:
            try:
                await GuideTranslationCRUD.create_translation(
                    db,
                    guide_id=translation_data['guide_id'],
                    language_code=translation_data['language_code'],
                    title=translation_data['title'],
                    description=translation_data.get('description'),
                    topics=translation_data.get('topics')
                )
                created_count += 1
            except Exception as e:
                print(f"Failed to create translation: {e}")
                continue
        
        return created_count


# ... (rest of your existing CRUD classes remain the same) ...


class UserGuideCRUD:
    """CRUD operations for user guide progress"""

    @staticmethod
    async def get_guides_with_progress(
        db: AsyncSession,
        user_id: int,
        difficulty: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all guides with user progress"""
        # Get all active guides
        guides_query = (
            select(LearningGuide)
            .where(LearningGuide.is_active == True)
        )
        
        if difficulty:
            guides_query = guides_query.where(LearningGuide.difficulty_level == difficulty)
        
        guides_query = guides_query.order_by(LearningGuide.sort_order, LearningGuide.id)
        
        result = await db.execute(guides_query)
        guides = result.scalars().all()
        
        # Get user progress for each guide
        guides_with_progress = []
        for guide in guides:
            progress = await UserGuideCRUD.get_user_guide_progress(db, user_id, guide.id)
            
            guides_with_progress.append({
                'guide': guide,
                'progress': progress,
                'status': progress.status if progress else GuideStatus.NOT_STARTED,
                'words_completed': progress.words_completed if progress else 0,
                'total_words_added': progress.total_words_added if progress else 0,
                'completion_percentage': (
                    (progress.words_completed / progress.total_words_added * 100)
                    if progress and progress.total_words_added > 0
                    else 0
                )
            })
        
        return guides_with_progress

    @staticmethod
    async def get_user_guide_progress(
        db: AsyncSession,
        user_id: int,
        guide_id: int
    ) -> Optional[UserGuideProgress]:
        """Get user progress for specific guide"""
        query = (
            select(UserGuideProgress)
            .where(
                and_(
                    UserGuideProgress.user_id == user_id,
                    UserGuideProgress.guide_id == guide_id
                )
            )
        )
        
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def create_or_update_guide_progress(
        db: AsyncSession,
        user_id: int,
        guide_id: int,
        status: GuideStatus = GuideStatus.IN_PROGRESS,
        **kwargs
    ) -> UserGuideProgress:
        """Create or update user guide progress"""
        # Check if progress exists
        existing = await UserGuideCRUD.get_user_guide_progress(db, user_id, guide_id)
        
        if existing:
            # Update existing
            for key, value in kwargs.items():
                if hasattr(existing, key):
                    setattr(existing, key, value)
            existing.status = status
            existing.updated_at = datetime.utcnow()
            existing.last_accessed_at = datetime.utcnow()
            
            await db.commit()
            await db.refresh(existing)
            return existing
        else:
            # Create new
            progress = UserGuideProgress(
                user_id=user_id,
                guide_id=guide_id,
                status=status,
                last_accessed_at=datetime.utcnow(),
                started_at=datetime.utcnow() if status != GuideStatus.NOT_STARTED else None,
                **kwargs
            )
            
            db.add(progress)
            await db.commit()
            await db.refresh(progress)
            return progress

    @staticmethod
    async def update_guide_progress(
        db: AsyncSession,
        user_id: int,
        guide_id: int,
        words_completed: Optional[int] = None,
        total_words_added: Optional[int] = None
    ) -> Optional[UserGuideProgress]:
        """Update guide progress counters"""
        progress = await UserGuideCRUD.get_user_guide_progress(db, user_id, guide_id)
        
        if not progress:
            # Create new progress
            progress = await UserGuideCRUD.create_or_update_guide_progress(
                db, user_id, guide_id, GuideStatus.IN_PROGRESS,
                words_completed=words_completed or 0,
                total_words_added=total_words_added or 0
            )
        else:
            # Update existing
            if words_completed is not None:
                progress.words_completed = words_completed
            if total_words_added is not None:
                progress.total_words_added = total_words_added
            
            progress.last_accessed_at = datetime.utcnow()
            
            # Check if completed
            if (progress.total_words_added > 0 and 
                progress.words_completed >= progress.total_words_added):
                progress.status = GuideStatus.COMPLETED
                if not progress.completed_at:
                    progress.completed_at = datetime.utcnow()
            
            await db.commit()
            await db.refresh(progress)
        
        return progress


class GuideWordSearchCRUD:
    """CRUD operations for finding words for guides"""

    @staticmethod
    async def search_words_by_keywords(
        db: AsyncSession,
        keywords: List[str],
        category_id: Optional[int] = None,
        difficulty_level_id: Optional[int] = None,
        limit: int = 50
    ) -> List[KazakhWord]:
        """Search words by keywords"""
        query = select(KazakhWord).options(
            selectinload(KazakhWord.translations),
            selectinload(KazakhWord.category),
            selectinload(KazakhWord.difficulty_level)
        )
        
        # Build keyword search conditions
        keyword_conditions = []
        for keyword in keywords:
            keyword_conditions.append(
                or_(
                    KazakhWord.kazakh_word.ilike(f"%{keyword}%"),
                    KazakhWord.kazakh_cyrillic.ilike(f"%{keyword}%")
                )
            )
        
        if keyword_conditions:
            query = query.where(or_(*keyword_conditions))
        
        # Add filters
        if category_id:
            query = query.where(KazakhWord.category_id == category_id)
        
        if difficulty_level_id:
            query = query.where(KazakhWord.difficulty_level_id == difficulty_level_id)
        
        query = query.limit(limit)
        
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_words_by_topics(
        db: AsyncSession,
        topics: List[str],
        limit: int = 50
    ) -> List[KazakhWord]:
        """Get words by topics (using category names)"""
        query = (
            select(KazakhWord)
            .join(Category)
            .options(
                selectinload(KazakhWord.translations),
                selectinload(KazakhWord.category),
                selectinload(KazakhWord.difficulty_level)
            )
            .where(
                or_(*[Category.name.ilike(f"%{topic}%") for topic in topics])
            )
            .limit(limit)
        )
        
        result = await db.execute(query)
        return result.scalars().all()