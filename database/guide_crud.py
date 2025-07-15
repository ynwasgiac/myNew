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
    async def create_guide_with_translations(
        db: AsyncSession,
        guide_data: Dict[str, Any],
        translations: Optional[Dict[str, Dict[str, Any]]] = None
    ) -> LearningGuide:
        """Create a guide with translations"""
        guide = LearningGuide(
            guide_key=guide_data['guide_key'],
            title=guide_data['title'],
            description=guide_data.get('description'),
            icon_name=guide_data.get('icon_name'),
            color=guide_data.get('color'),
            difficulty_level=guide_data['difficulty_level'],
            estimated_minutes=guide_data.get('estimated_minutes'),
            target_word_count=guide_data.get('target_word_count', 20),
            keywords=guide_data.get('keywords', []),
            topics=guide_data.get('topics', []),
            sort_order=guide_data.get('sort_order', 0)
        )
        
        db.add(guide)
        await db.flush()  # Get the guide ID
        
        # Add translations if provided
        if translations:
            for lang_code, translation_data in translations.items():
                # Get language ID
                lang_query = select(Language).where(Language.language_code == lang_code)
                lang_result = await db.execute(lang_query)
                language = lang_result.scalar_one_or_none()
                
                if language:
                    translation = GuideTranslation(
                        guide_id=guide.id,
                        language_id=language.id,
                        translated_title=translation_data['title'],
                        translated_description=translation_data.get('description'),
                        translated_topics=translation_data.get('topics', [])
                    )
                    db.add(translation)
        
        await db.commit()
        await db.refresh(guide)
        return guide

    @staticmethod
    async def format_guide_for_user(
        guide: LearningGuide,
        language_code: str = 'en'
    ) -> Dict[str, Any]:
        """Format guide with translated content for user's language"""
        translated_content = guide.get_translated_content(language_code)
        
        return {
            'id': guide.guide_key,
            'title': translated_content['title'],
            'description': translated_content['description'],
            'icon': guide.icon_name,
            'color': guide.color,
            'difficulty': guide.difficulty_level,
            'estimated_time': f"{guide.estimated_minutes} мин" if guide.estimated_minutes else "30 мин",
            'word_count': guide.target_word_count,
            'topics': translated_content['topics'] or [],
            'keywords': guide.keywords or []
        }

    # ... (rest of your existing CRUD methods remain the same) ...


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
    async def get_user_guide_progress(
        db: AsyncSession,
        user_id: int,
        guide_id: int
    ) -> Optional[UserGuideProgress]:
        """Get user's progress for a specific guide"""
        query = select(UserGuideProgress).where(
            and_(
                UserGuideProgress.user_id == user_id,
                UserGuideProgress.guide_id == guide_id
            )
        )
        
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_all_guides_progress(
        db: AsyncSession,
        user_id: int
    ) -> List[UserGuideProgress]:
        """Get user's progress for all guides"""
        query = (
            select(UserGuideProgress)
            .options(selectinload(UserGuideProgress.guide))
            .where(UserGuideProgress.user_id == user_id)
        )
        
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def start_guide(
        db: AsyncSession,
        user_id: int,
        guide_id: int
    ) -> UserGuideProgress:
        """Start a guide for user"""
        # Check if progress already exists
        progress = await UserGuideCRUD.get_user_guide_progress(db, user_id, guide_id)
        
        if progress:
            # Update existing progress
            progress.status = GuideStatus.IN_PROGRESS
            progress.started_at = datetime.utcnow()
            progress.last_accessed_at = datetime.utcnow()
        else:
            # Create new progress
            progress = UserGuideProgress(
                user_id=user_id,
                guide_id=guide_id,
                status=GuideStatus.IN_PROGRESS,
                started_at=datetime.utcnow(),
                last_accessed_at=datetime.utcnow()
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
        words_completed: int,
        total_words_added: int
    ) -> UserGuideProgress:
        """Update guide progress"""
        progress = await UserGuideCRUD.get_user_guide_progress(db, user_id, guide_id)
        
        if not progress:
            # Create if doesn't exist
            progress = UserGuideProgress(
                user_id=user_id,
                guide_id=guide_id,
                status=GuideStatus.IN_PROGRESS,
                started_at=datetime.utcnow()
            )
            db.add(progress)
        
        progress.words_completed = words_completed
        progress.total_words_added = total_words_added
        progress.last_accessed_at = datetime.utcnow()
        
        # Check if completed
        if words_completed >= total_words_added and words_completed > 0:
            progress.status = GuideStatus.COMPLETED
            progress.completed_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(progress)
        return progress

    @staticmethod
    async def get_guides_with_progress(
        db: AsyncSession,
        user_id: int,
        difficulty: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all guides with user progress"""
        # Get all guides
        guides = await LearningGuideCRUD.get_all_guides(db, difficulty)
        
        # Get user progress for all guides
        user_progress = await UserGuideCRUD.get_user_all_guides_progress(db, user_id)
        progress_map = {p.guide_id: p for p in user_progress}
        
        # Combine guides with progress
        result = []
        for guide in guides:
            progress = progress_map.get(guide.id)
            
            result.append({
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
        
        return result


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