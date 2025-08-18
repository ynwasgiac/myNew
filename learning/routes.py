# learning/routes.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
from datetime import datetime

from database.guide_crud import (
    LearningGuideCRUD, UserGuideCRUD, GuideWordSearchCRUD
)
from database.learning_models import LearningStatus, DifficultyRating, GuideStatus

from database import get_db
from database.learning_crud import (
    UserWordProgressCRUD, UserLearningSessionCRUD, UserLearningGoalCRUD,
    UserStreakCRUD, UserLearningStatsCRUD
)
from database.crud import KazakhWordCRUD, CategoryCRUD, DifficultyLevelCRUD
from database.learning_schemas import (
    # Progress schemas
    UserWordProgressResponse, UserWordProgressCreate, UserWordProgressUpdate,
    UserWordProgressWithWord, LearningStatusEnum, DifficultyRatingEnum,

    # Session schemas
    UserLearningSessionCreate, UserLearningSessionResponse,
    UserSessionDetailCreate, UserSessionDetailResponse,

    # Goal schemas
    UserLearningGoalCreate, UserLearningGoalResponse,

    # Stats schemas
    LearningStatsResponse, CategoryProgressResponse,
    UserStreakResponse, UserAchievementResponse,

    # Practice schemas
    PracticeSessionRequest, PracticeSessionResponse, PracticeWordItem,
    QuizQuestionType, QuizQuestion, QuizAnswer, QuizSubmission, QuizResult,

    # Management schemas
    AddWordsToListRequest, RemoveWordsFromListRequest, LearningListFilters,

    # Dashboard schemas
    LearningDashboardResponse, SpacedRepetitionSettings, ReviewScheduleResponse
)
from database.learning_models import LearningStatus, DifficultyRating
from database.auth_models import User
from auth.dependencies import get_current_user
from auth.token_refresh import get_current_user_with_refresh, TokenRefreshResponse
import random
from database.learning_models import LearningStatus, DifficultyRating, GuideStatus


router = APIRouter(prefix="/learning", tags=["Learning Progress"])


# ===== WORD PROGRESS MANAGEMENT =====

@router.post("/words/{word_id}/add", response_model=UserWordProgressResponse)
async def add_word_to_learning_list(
        word_id: int,
        status: LearningStatusEnum = LearningStatusEnum.WANT_TO_LEARN,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Add a word to user's learning list"""
    # Verify word exists
    word = await KazakhWordCRUD.get_by_id(db, word_id)
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    # Convert enum to model enum
    status_mapping = {
        LearningStatusEnum.WANT_TO_LEARN: LearningStatus.WANT_TO_LEARN,
        LearningStatusEnum.LEARNING: LearningStatus.LEARNING,
        LearningStatusEnum.LEARNED: LearningStatus.LEARNED,
        LearningStatusEnum.MASTERED: LearningStatus.MASTERED,
        LearningStatusEnum.REVIEW: LearningStatus.REVIEW
    }

    progress = await UserWordProgressCRUD.add_word_to_learning_list(
        db, current_user.id, word_id, status_mapping[status]
    )

    return progress


@router.post("/words/add-multiple", response_model=List[UserWordProgressResponse])
async def add_multiple_words_to_learning_list(
        request: AddWordsToListRequest,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Add multiple words to user's learning list"""
    status_mapping = {
        LearningStatusEnum.WANT_TO_LEARN: LearningStatus.WANT_TO_LEARN,
        LearningStatusEnum.LEARNING: LearningStatus.LEARNING,
        LearningStatusEnum.LEARNED: LearningStatus.LEARNED,
        LearningStatusEnum.MASTERED: LearningStatus.MASTERED,
        LearningStatusEnum.REVIEW: LearningStatus.REVIEW
    }

    results = []
    for word_id in request.word_ids:
        # Verify word exists
        word = await KazakhWordCRUD.get_by_id(db, word_id)
        if word:
            progress = await UserWordProgressCRUD.add_word_to_learning_list(
                db, current_user.id, word_id, status_mapping[request.status]
            )
            results.append(progress)

    return results


@router.put("/words/{word_id}/progress", response_model=UserWordProgressResponse)
async def update_word_progress(
        word_id: int,
        update_data: UserWordProgressUpdate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Update progress for a specific word"""
    # Convert enums to model enums
    status = None
    if update_data.status:
        status_mapping = {
            LearningStatusEnum.WANT_TO_LEARN: LearningStatus.WANT_TO_LEARN,
            LearningStatusEnum.LEARNING: LearningStatus.LEARNING,
            LearningStatusEnum.LEARNED: LearningStatus.LEARNED,
            LearningStatusEnum.MASTERED: LearningStatus.MASTERED,
            LearningStatusEnum.REVIEW: LearningStatus.REVIEW
        }
        status = status_mapping[update_data.status]

    difficulty_rating = None
    if update_data.difficulty_rating:
        difficulty_mapping = {
            DifficultyRatingEnum.VERY_EASY: DifficultyRating.VERY_EASY,
            DifficultyRatingEnum.EASY: DifficultyRating.EASY,
            DifficultyRatingEnum.MEDIUM: DifficultyRating.MEDIUM,
            DifficultyRatingEnum.HARD: DifficultyRating.HARD,
            DifficultyRatingEnum.VERY_HARD: DifficultyRating.VERY_HARD
        }
        difficulty_rating = difficulty_mapping[update_data.difficulty_rating]

    progress = await UserWordProgressCRUD.update_word_progress(
        db, current_user.id, word_id,
        status=status,
        was_correct=update_data.was_correct,
        difficulty_rating=difficulty_rating,
        user_notes=update_data.user_notes
    )

    if not progress:
        raise HTTPException(status_code=404, detail="Word progress not found")

    return progress


@router.delete("/words/{word_id}")
async def remove_word_from_learning_list(
        word_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Remove a word from user's learning list"""
    success = await UserWordProgressCRUD.remove_word_from_learning(
        db, current_user.id, word_id
    )

    if not success:
        raise HTTPException(status_code=404, detail="Word not found in learning list")

    return {"message": "Word removed from learning list"}


@router.delete("/words/remove-multiple")
async def remove_multiple_words_from_learning_list(
        request: RemoveWordsFromListRequest,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Remove multiple words from user's learning list"""
    removed_count = 0
    for word_id in request.word_ids:
        success = await UserWordProgressCRUD.remove_word_from_learning(
            db, current_user.id, word_id
        )
        if success:
            removed_count += 1

    return {
        "message": f"Removed {removed_count} words from learning list",
        "removed_count": removed_count,
        "total_requested": len(request.word_ids)
    }


# ===== LEARNING LIST VIEWS =====
@router.get("/words/{word_id}/status", response_model=UserWordProgressWithWord)
async def get_word_status(
        word_id: int,
        response: Response,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user_with_refresh)
):
    """Get the user's progress/status for a specific word (with word details)"""
    # Handle automatic token refresh
    TokenRefreshResponse.add_token_header(response, current_user)

    progress = await UserWordProgressCRUD.get_user_word_progress(db, current_user.id, word_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Word progress not found")

    # Build word details dict (similar to /words/my-list)
    word = progress.kazakh_word
    word_dict = {
        "id": word.id,
        "kazakh_word": word.kazakh_word,
        "kazakh_cyrillic": word.kazakh_cyrillic,
        "category_name": word.category.category_name if word.category else "Unknown",
        "difficulty_level": word.difficulty_level.level_number if word.difficulty_level else 1,
        "translations": [
            {
                "translation": t.translation,
                "language_code": t.language.language_code
            }
            for t in word.translations
        ]
    }

    return UserWordProgressWithWord(
        id=progress.id,
        user_id=progress.user_id,
        kazakh_word_id=progress.kazakh_word_id,
        status=LearningStatusEnum(progress.status.value),
        times_seen=progress.times_seen,
        times_correct=progress.times_correct,
        times_incorrect=progress.times_incorrect,
        difficulty_rating=DifficultyRatingEnum(progress.difficulty_rating.value) if progress.difficulty_rating else None,
        user_notes=progress.user_notes,
        added_at=progress.added_at,
        first_learned_at=progress.first_learned_at,
        last_practiced_at=progress.last_practiced_at,
        next_review_at=progress.next_review_at,
        repetition_interval=progress.repetition_interval,
        ease_factor=progress.ease_factor,
        created_at=progress.created_at,
        updated_at=progress.updated_at,
        kazakh_word=word_dict
    )

@router.get("/words/my-list", response_model=List[UserWordProgressWithWord])
async def get_my_learning_words(
        response: Response,
        status: Optional[LearningStatusEnum] = None,
        category_id: Optional[int] = None,
        difficulty_level_id: Optional[int] = None,
        limit: int = Query(50, ge=1, le=1000),
        offset: int = Query(0, ge=0),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user_with_refresh)
):
    """Get user's learning words with filters (with automatic token refresh)"""
    # Handle automatic token refresh
    TokenRefreshResponse.add_token_header(response, current_user)

    # Convert enum to model enum
    model_status = None
    if status:
        status_mapping = {
            LearningStatusEnum.WANT_TO_LEARN: LearningStatus.WANT_TO_LEARN,
            LearningStatusEnum.LEARNING: LearningStatus.LEARNING,
            LearningStatusEnum.LEARNED: LearningStatus.LEARNED,
            LearningStatusEnum.MASTERED: LearningStatus.MASTERED,
            LearningStatusEnum.REVIEW: LearningStatus.REVIEW
        }
        model_status = status_mapping[status]

    progress_list = await UserWordProgressCRUD.get_user_learning_words(
        db, current_user.id, model_status, category_id, difficulty_level_id, limit, offset
    )

    # Convert to response format with word details
    results = []
    for progress in progress_list:
        # ✅ ДОБАВЬТЕ ИЗВЛЕЧЕНИЕ ИЗОБРАЖЕНИЙ
        images = []
        if hasattr(progress.kazakh_word, 'images') and progress.kazakh_word.images:
            images = [
                {
                    "id": img.id,
                    "image_url": img.image_url,
                    "is_primary": img.is_primary,
                    "image_type": img.image_type,
                    "alt_text": img.alt_text
                }
                for img in progress.kazakh_word.images
            ]
        
        # ✅ ДОБАВЬТЕ ИЗВЛЕЧЕНИЕ PRIMARY IMAGE
        primary_image = None
        if progress.kazakh_word.images:
            # Ищем primary image
            for image in progress.kazakh_word.images:
                if image.is_primary:
                    primary_image = image.image_url
                    break
            # Если primary не найден, берем первое доступное
        # Get word details
        word_dict = {
            "id": progress.kazakh_word.id,
            "kazakh_word": progress.kazakh_word.kazakh_word,
            "kazakh_cyrillic": progress.kazakh_word.kazakh_cyrillic,
            "category_name": progress.kazakh_word.category.category_name if progress.kazakh_word.category else "Unknown",
            "difficulty_level": progress.kazakh_word.difficulty_level.level_number if progress.kazakh_word.difficulty_level else 1,
            "translations": [
                {
                    "translation": t.translation,
                    "language_code": t.language.language_code
                }
                for t in progress.kazakh_word.translations
            ],
            # ✅ ДОБАВЬТЕ ЭТИ ПОЛЯ:
            "images": images,
            "primary_image": primary_image
        }

        # Create response with word details
        result = UserWordProgressWithWord(
            id=progress.id,
            user_id=progress.user_id,
            kazakh_word_id=progress.kazakh_word_id,
            status=LearningStatusEnum(progress.status.value),
            times_seen=progress.times_seen,
            times_correct=progress.times_correct,
            times_incorrect=progress.times_incorrect,
            difficulty_rating=DifficultyRatingEnum(
                progress.difficulty_rating.value) if progress.difficulty_rating else None,
            user_notes=progress.user_notes,
            added_at=progress.added_at,
            first_learned_at=progress.first_learned_at,
            last_practiced_at=progress.last_practiced_at,
            next_review_at=progress.next_review_at,
            repetition_interval=progress.repetition_interval,
            ease_factor=progress.ease_factor,
            created_at=progress.created_at,
            updated_at=progress.updated_at,
            kazakh_word=word_dict
        )
        results.append(result)

    return results


@router.get("/words/due-for-review", response_model=List[UserWordProgressWithWord])
async def get_words_due_for_review(
        limit: int = Query(20, ge=1, le=50),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Get words that need review based on spaced repetition"""
    progress_list = await UserWordProgressCRUD.get_words_for_review(
        db, current_user.id, limit
    )

    # Convert to response format
    results = []
    for progress in progress_list:
        word_dict = {
            "id": progress.kazakh_word.id,
            "kazakh_word": progress.kazakh_word.kazakh_word,
            "kazakh_cyrillic": progress.kazakh_word.kazakh_cyrillic,
            "translations": [
                {
                    "translation": t.translation,
                    "language_code": t.language.language_code
                }
                for t in progress.kazakh_word.translations
            ]
        }

        result = UserWordProgressWithWord(
            id=progress.id,
            user_id=progress.user_id,
            kazakh_word_id=progress.kazakh_word_id,
            status=LearningStatusEnum(progress.status.value),
            times_seen=progress.times_seen,
            times_correct=progress.times_correct,
            times_incorrect=progress.times_incorrect,
            difficulty_rating=DifficultyRatingEnum(
                progress.difficulty_rating.value) if progress.difficulty_rating else None,
            user_notes=progress.user_notes,
            added_at=progress.added_at,
            first_learned_at=progress.first_learned_at,
            last_practiced_at=progress.last_practiced_at,
            next_review_at=progress.next_review_at,
            repetition_interval=progress.repetition_interval,
            ease_factor=progress.ease_factor,
            created_at=progress.created_at,
            updated_at=progress.updated_at,
            kazakh_word=word_dict
        )
        results.append(result)

    return results


# ===== PRACTICE SESSIONS =====

# Replace your practice start route in learning/routes.py with this fixed version:

@router.post("/practice/start", response_model=PracticeSessionResponse)
async def start_practice_session(
        request: PracticeSessionRequest,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Start a new practice session with ONLY learned words"""
    
    try:
        print(f"🎯 Starting practice session for user: {current_user.username}")
        print(f"📊 Request params: word_count={request.word_count}, category_id={request.category_id}")
        
        # Determine user's preferred language
        user_language_code = request.language_code
        if not user_language_code and current_user.main_language:
            user_language_code = current_user.main_language.language_code
        if not user_language_code:
            user_language_code = "en"
            
        print(f"🌐 Using language: {user_language_code}")
        
        # Create learning session
        session = await UserLearningSessionCRUD.create_session(
            db, current_user.id, request.session_type,
            request.category_id, request.difficulty_level_id
        )
        print(f"📝 Created session with ID: {session.id}")
        
        # 🎯 KEY CHANGE: Get ONLY learned words using a direct query
        from sqlalchemy import select, and_
        from sqlalchemy.orm import selectinload
        
        # Build query for ONLY learned words
        query = (
            select(UserWordProgress)
            .options(
                selectinload(UserWordProgress.kazakh_word)
                .selectinload(KazakhWord.translations)
                .selectinload(Translation.language),
                selectinload(UserWordProgress.kazakh_word)
                .selectinload(KazakhWord.category),
                selectinload(UserWordProgress.kazakh_word)
                .selectinload(KazakhWord.difficulty_level),
                selectinload(UserWordProgress.kazakh_word)
                .selectinload(KazakhWord.pronunciations),
                selectinload(UserWordProgress.kazakh_word)
                .selectinload(KazakhWord.images)
            )
            .where(
                and_(
                    UserWordProgress.user_id == current_user.id,
                    UserWordProgress.status == LearningStatus.LEARNED  # ONLY learned words
                )
            )
        )
        
        # Apply filters if provided
        if request.category_id:
            query = query.join(KazakhWord).where(KazakhWord.category_id == request.category_id)
        
        if request.difficulty_level_id:
            query = query.join(KazakhWord).where(KazakhWord.difficulty_level_id == request.difficulty_level_id)
        
        # Order by last practiced (least recently practiced first) and apply limit
        query = query.order_by(UserWordProgress.last_practiced_at.asc().nullsfirst())
        
        # Execute query
        result = await db.execute(query)
        learned_progress_list = result.scalars().all()
        
        print(f"📚 Found {len(learned_progress_list)} learned words in database")
        
        if not learned_progress_list:
            print("❌ No learned words found")
            raise HTTPException(
                status_code=404,
                detail="No learned words available for practice. Please complete some learning modules first to unlock practice mode."
            )
        
        # Convert to practice word format
        practice_words = []
        for progress in learned_progress_list:
            word = progress.kazakh_word
            if not word:
                continue
                
            # Get translation in user's preferred language
            translation = ""
            if hasattr(word, 'translations') and word.translations:
                # First try to find translation in user's language
                for t in word.translations:
                    if hasattr(t, 'language') and t.language and t.language.language_code == user_language_code:
                        translation = t.translation
                        break
                
                # If no translation found in preferred language, use first available
                if not translation and word.translations:
                    translation = word.translations[0].translation
            
            # Get pronunciation
            pronunciation = None
            if hasattr(word, 'pronunciations') and word.pronunciations:
                pronunciation = word.pronunciations[0].pronunciation
            
            # Get image
            image_url = None
            if hasattr(word, 'images') and word.images:
                image_url = word.images[0].image_url
            
            # Get difficulty level
            difficulty_level = 1
            if hasattr(word, 'difficulty_level') and word.difficulty_level:
                difficulty_level = word.difficulty_level.level_number
            
            practice_word = PracticeWordItem(
                id=word.id,
                kazakh_word=word.kazakh_word,
                kazakh_cyrillic=word.kazakh_cyrillic,
                translation=translation,
                pronunciation=pronunciation,
                image_url=image_url,
                difficulty_level=difficulty_level
            )
            
            practice_words.append(practice_word)
        
        print(f"🔄 Converted {len(practice_words)} words to practice format")
        
        # Shuffle for variety
        import random
        random.shuffle(practice_words)
        
        # Apply word count limit if specified and less than available words
        if request.word_count and request.word_count < len(practice_words):
            practice_words = practice_words[:request.word_count]
            print(f"✂️ Limited to {request.word_count} words as requested")
        
        print(f"✅ Final practice session: {len(practice_words)} learned words")
        
        # Log each word for debugging
        for i, word in enumerate(practice_words[:5]):  # Show first 5
            print(f"  {i+1}. {word.kazakh_word} -> {word.translation}")
        if len(practice_words) > 5:
            print(f"  ... and {len(practice_words) - 5} more words")
        
        return PracticeSessionResponse(
            session_id=session.id,
            words=practice_words,
            session_type=request.session_type,
            total_words=len(practice_words)
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        print(f"❌ Error in start_practice_session: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start practice session: {str(e)}"
        )


# ALSO: Add a debug endpoint to check learned words directly
@router.get("/debug/learned-words")
async def debug_learned_words(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Debug endpoint to check learned words"""
    try:
        # Get all user word progress
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        
        query = (
            select(UserWordProgress)
            .options(selectinload(UserWordProgress.kazakh_word))
            .where(UserWordProgress.user_id == current_user.id)
        )
        
        result = await db.execute(query)
        all_progress = result.scalars().all()
        
        # Group by status
        status_breakdown = {}
        for progress in all_progress:
            status = progress.status.value
            if status not in status_breakdown:
                status_breakdown[status] = []
            
            status_breakdown[status].append({
                "id": progress.kazakh_word.id,
                "word": progress.kazakh_word.kazakh_word,
                "status": status,
                "times_seen": progress.times_seen,
                "times_correct": progress.times_correct,
                "last_practiced": progress.last_practiced_at.isoformat() if progress.last_practiced_at else None
            })
        
        return {
            "user_id": current_user.id,
            "total_words": len(all_progress),
            "status_breakdown": status_breakdown,
            "learned_count": len(status_breakdown.get('learned', [])),
            "learned_words": status_breakdown.get('learned', [])
        }
        
    except Exception as e:
        print(f"Error in debug endpoint: {e}")
        return {"error": str(e)}


@router.post("/practice/{session_id}/answer")
async def submit_practice_answer(
        session_id: int,
        word_id: int,
        was_correct: bool,
        user_answer: Optional[str] = None,
        correct_answer: Optional[str] = None,
        response_time_ms: Optional[int] = None,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Submit an answer for a practice session"""

    # Add session detail
    await UserLearningSessionCRUD.add_session_detail(
        db, session_id, word_id, was_correct, "practice",
        user_answer, correct_answer, response_time_ms
    )

    # Update word progress
    await UserWordProgressCRUD.update_word_progress(
        db, current_user.id, word_id, was_correct=was_correct
    )

    # Update streak if correct
    if was_correct:
        await UserStreakCRUD.update_streak(db, current_user.id)

    return {"message": "Answer recorded", "was_correct": was_correct}


@router.post("/practice/{session_id}/finish", response_model=UserLearningSessionResponse)
async def finish_practice_session(
        session_id: int,
        duration_seconds: Optional[int] = None,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Finish a practice session"""

    session = await UserLearningSessionCRUD.finish_session(
        db, session_id, duration_seconds
    )

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Update streak
    await UserStreakCRUD.update_streak(db, current_user.id)

    return session


# ===== LEARNING GOALS =====

@router.post("/goals", response_model=UserLearningGoalResponse)
async def create_learning_goal(
        goal_data: UserLearningGoalCreate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Create a new learning goal"""

    goal = await UserLearningGoalCRUD.create_goal(
        db, current_user.id, goal_data.goal_type, goal_data.target_value,
        goal_data.target_date, goal_data.category_id, goal_data.difficulty_level_id
    )

    return goal


@router.get("/goals", response_model=List[UserLearningGoalResponse])
async def get_my_learning_goals(
        active_only: bool = True,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Get user's learning goals"""

    goals = await UserLearningGoalCRUD.get_user_goals(
        db, current_user.id, active_only
    )

    return goals


# ===== STATISTICS AND DASHBOARD =====

@router.get("/stats", response_model=LearningStatsResponse)
async def get_learning_statistics(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Get comprehensive learning statistics"""

    stats = await UserLearningStatsCRUD.get_user_learning_stats(
        db, current_user.id
    )

    return LearningStatsResponse(**stats)


@router.get("/stats/categories", response_model=List[CategoryProgressResponse])
async def get_category_progress(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Get learning progress by category"""

    progress = await UserLearningStatsCRUD.get_category_progress(
        db, current_user.id
    )

    return [CategoryProgressResponse(**p) for p in progress]


@router.get("/dashboard", response_model=LearningDashboardResponse)
async def get_learning_dashboard(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Get comprehensive learning dashboard"""

    # Get stats
    stats_data = await UserLearningStatsCRUD.get_user_learning_stats(db, current_user.id)
    stats = LearningStatsResponse(**stats_data)

    # Get streak
    streak = await UserStreakCRUD.get_user_streak(db, current_user.id)

    # Get recent sessions
    recent_sessions = await UserLearningSessionCRUD.get_user_sessions(
        db, current_user.id, limit=5
    )

    # Get active goals
    active_goals = await UserLearningGoalCRUD.get_user_goals(
        db, current_user.id, active_only=True
    )

    # Get category progress
    category_progress_data = await UserLearningStatsCRUD.get_category_progress(
        db, current_user.id
    )
    category_progress = [CategoryProgressResponse(**p) for p in category_progress_data]

    # Count words due today (simplified)
    words_due_today = stats.words_due_review

    return LearningDashboardResponse(
        stats=stats,
        streak=streak,
        recent_sessions=recent_sessions,
        active_goals=active_goals,
        words_due_today=words_due_today,
        category_progress=category_progress,
        recent_achievements=[]  # TODO: Implement achievements
    )


# ===== REVIEW SCHEDULE =====

@router.get("/review-schedule", response_model=ReviewScheduleResponse)
async def get_review_schedule(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Get review schedule information"""

    # Get words due for review
    words_due = await UserWordProgressCRUD.get_words_for_review(
        db, current_user.id, limit=100
    )

    # Count by timing
    due_now = len(words_due)

    # Get all user's learning words to calculate other counts
    all_words = await UserWordProgressCRUD.get_user_learning_words(
        db, current_user.id, limit=1000
    )

    # Calculate due today, this week, overdue (simplified)
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    today_end = now.replace(hour=23, minute=59, second=59)
    week_end = now + timedelta(days=7)

    due_today = 0
    due_this_week = 0
    overdue = 0
    next_review_date = None

    for progress in all_words:
        if progress.next_review_at:
            if progress.next_review_at <= now:
                overdue += 1
            elif progress.next_review_at <= today_end:
                due_today += 1
            elif progress.next_review_at <= week_end:
                due_this_week += 1

            # Find earliest next review date
            if not next_review_date or progress.next_review_at < next_review_date:
                next_review_date = progress.next_review_at

    return ReviewScheduleResponse(
        due_now=due_now,
        due_today=due_today,
        due_this_week=due_this_week,
        overdue=overdue,
        next_review_date=next_review_date
    )


# ===== LEARNING SESSIONS HISTORY =====

@router.get("/sessions", response_model=List[UserLearningSessionResponse])
async def get_learning_sessions(
        limit: int = Query(20, ge=1, le=100),
        offset: int = Query(0, ge=0),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Get user's learning session history"""

    sessions = await UserLearningSessionCRUD.get_user_sessions(
        db, current_user.id, limit, offset
    )

    return sessions


@router.get("/streak", response_model=UserStreakResponse)
async def get_learning_streak(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Get user's learning streak"""

    streak = await UserStreakCRUD.get_user_streak(db, current_user.id)

    if not streak:
        # Create initial streak
        streak = await UserStreakCRUD.update_streak(db, current_user.id)

    return streak

# Fix for learning/routes.py - Update the submit_practice_answer endpoint

@router.post("/practice/{session_id}/answer")
async def submit_practice_answer(
        session_id: int,
        word_id: int,
        was_correct: bool,
        user_answer: Optional[str] = None,
        correct_answer: Optional[str] = None,  # This will be overridden
        response_time_ms: Optional[int] = None,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Submit an answer for a practice session"""
    
    try:
        # Get the word to determine the correct answer in user's language
        word = await KazakhWordCRUD.get_by_id(db, word_id)
        if not word:
            raise HTTPException(status_code=404, detail="Word not found")
        
        # Determine user's preferred language
        user_language_code = "en"  # Default to English
        if current_user.main_language:
            user_language_code = current_user.main_language.language_code
        
        # Get the correct translation in user's language
        correct_translation = ""
        if hasattr(word, 'translations') and word.translations:
            # First try to find translation in user's language
            user_lang_translation = next(
                (t for t in word.translations if t.language.language_code == user_language_code),
                None
            )
            
            if user_lang_translation:
                correct_translation = user_lang_translation.translation
            elif word.translations:
                # Fallback to first available translation
                correct_translation = word.translations[0].translation
        
        # Use the backend-determined correct answer, not the frontend one
        backend_correct_answer = correct_translation
        
        # Log for debugging
        print(f"🔍 Word: {word.kazakh_word}")
        print(f"👤 User language: {user_language_code}")
        print(f"✅ Correct answer: {backend_correct_answer}")
        print(f"👥 User answer: {user_answer}")
        print(f"📝 Was correct: {was_correct}")
        
        # Add session detail with backend-determined correct answer
        await UserLearningSessionCRUD.add_session_detail(
            db, session_id, word_id, was_correct, "practice",
            user_answer, backend_correct_answer, response_time_ms
        )

        # Update word progress
        await UserWordProgressCRUD.update_word_progress(
            db, current_user.id, word_id, was_correct=was_correct
        )

        # Update streak if correct
        if was_correct:
            await UserStreakCRUD.update_streak(db, current_user.id)

        return {
            "message": "Answer recorded", 
            "was_correct": was_correct,
            "correct_answer": backend_correct_answer  # Return the correct answer in user's language
        }
        
    except Exception as e:
        print(f"❌ Error in submit_practice_answer: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit answer: {str(e)}"
        )


# Alternative approach: Fix the practice session creation to use proper language
@router.post("/practice/start-session", response_model=PracticeSessionResponse)
async def start_practice_session(
        request: PracticeSessionRequest,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Start a new practice session with improved word selection and proper language handling"""
    
    try:
        print(f"🎯 Starting practice session for user: {current_user.username}")
        
        # Determine user's preferred language
        user_language_code = request.language_code  # Use request language if provided
        if not user_language_code and current_user.main_language:
            user_language_code = current_user.main_language.language_code
        if not user_language_code:
            user_language_code = "en"  # Default to English
            
        print(f"🌐 Using language: {user_language_code}")
        
        # Create learning session
        session = await UserLearningSessionCRUD.create_session(
            db, current_user.id, request.session_type,
            request.category_id, request.difficulty_level_id
        )
        
        practice_words = []
        user_learning_words_count = 0
        
        # Define learning statuses to include
        learning_statuses = [LearningStatus.WANT_TO_LEARN, LearningStatus.LEARNING]
        
        if request.include_review:
            learning_statuses.append(LearningStatus.REVIEW)
        
        # Get words from user's learning list
        for status in learning_statuses:
            try:
                status_words = await UserWordProgressCRUD.get_user_learning_words(
                    db, current_user.id, status, request.category_id, 
                    request.difficulty_level_id, request.word_count, 0
                )
                
                for progress in status_words:
                    word = progress.kazakh_word
                    if not word:
                        continue
                        
                    # Get translation in user's preferred language
                    translation = ""
                    if hasattr(word, 'translations') and word.translations:
                        # First try to find translation in user's language
                        user_lang_translation = next(
                            (t for t in word.translations if t.language.language_code == user_language_code),
                            None
                        )
                        
                        if user_lang_translation:
                            translation = user_lang_translation.translation
                        elif word.translations:
                            # Fallback to first available translation
                            translation = word.translations[0].translation
                    
                    if not translation:
                        print(f"⚠️ No translation found for word {word.kazakh_word} in language {user_language_code}")
                        continue

                    practice_word = PracticeWordItem(
                        id=word.id,
                        kazakh_word=word.kazakh_word,
                        kazakh_cyrillic=getattr(word, 'kazakh_cyrillic', None),
                        translation=translation,  # This is now in the correct language
                        difficulty_level=word.difficulty_level.level_number if hasattr(word, 'difficulty_level') and word.difficulty_level else 1,
                        times_seen=progress.times_seen,
                        last_practiced=progress.last_practiced_at,
                        is_review=status == LearningStatus.REVIEW,
                        learning_status="learning"
                    )
                    
                    practice_words.append(practice_word)
                    user_learning_words_count += 1
                    
                print(f"✅ Loaded {len(status_words)} words with status {status.value}")
                    
            except Exception as e:
                print(f"❌ Error loading words with status {status.value}: {e}")
                continue
        
        print(f"📊 Total from learning list: {user_learning_words_count} words")
        
        # If we need more words, add random words
        if len(practice_words) < request.word_count:
            remaining_count = request.word_count - len(practice_words)
            print(f"🎲 Adding {remaining_count} random words")
            
            try:
                # Get random words that user hasn't added to learning list
                random_words = await KazakhWordCRUD.get_random_words_not_in_user_list(
                    db, current_user.id, remaining_count, request.category_id, request.difficulty_level_id
                )
                
                for word in random_words:
                    # Get translation in user's preferred language
                    translation = ""
                    if hasattr(word, 'translations') and word.translations:
                        user_lang_translation = next(
                            (t for t in word.translations if t.language.language_code == user_language_code),
                            None
                        )
                        
                        if user_lang_translation:
                            translation = user_lang_translation.translation
                        elif word.translations:
                            translation = word.translations[0].translation
                    
                    if not translation:
                        continue  # Skip words without translation

                    practice_word = PracticeWordItem(
                        id=word.id,
                        kazakh_word=word.kazakh_word,
                        kazakh_cyrillic=getattr(word, 'kazakh_cyrillic', None),
                        translation=translation,  # This is now in the correct language
                        difficulty_level=word.difficulty_level.level_number if hasattr(word, 'difficulty_level') and word.difficulty_level else 1,
                        times_seen=0,
                        last_practiced=None,
                        is_review=False,
                        learning_status="random"
                    )
                    
                    practice_words.append(practice_word)
                    
                print(f"✅ Added {len(random_words)} random words")
                
            except Exception as e:
                print(f"❌ Error adding random words: {e}")
        
        # Check if we have any words
        if not practice_words:
            raise HTTPException(
                status_code=404,
                detail="No words available for practice. Please add words to your learning list."
            )

        # Smart shuffling: prioritize learning words, then add random ones
        learning_words = [pw for pw in practice_words if pw.learning_status == "learning"]
        random_words = [pw for pw in practice_words if pw.learning_status == "random"]
        
        # Shuffle each group separately
        import random
        random.shuffle(learning_words)
        random.shuffle(random_words)
        
        # Combine: 70% learning words at the beginning, then insert random ones
        final_words = []
        learning_priority_count = min(len(learning_words), int(len(practice_words) * 0.7))
        
        # Add priority learning words
        final_words.extend(learning_words[:learning_priority_count])
        
        # Add remaining words with shuffling
        remaining_learning = learning_words[learning_priority_count:]
        all_remaining = remaining_learning + random_words
        random.shuffle(all_remaining)
        final_words.extend(all_remaining)

        print(f"🎯 Final composition: {user_learning_words_count} from learning list + {len(random_words)} random")
        print(f"📝 Priority: {learning_priority_count} learning words at the beginning")

        return PracticeSessionResponse(
            session_id=session.id,
            words=final_words,
            session_type=request.session_type,
            total_words=len(final_words)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in start_practice_session: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start practice session: {str(e)}"
        )
    
@router.get("/words/learned", response_model=List[UserWordProgressWithWord])
async def get_learned_words(
        status: Optional[LearningStatusEnum] = Query(None),
        category_id: Optional[int] = Query(None),
        search: Optional[str] = Query(None),
        favorites_only: bool = Query(False),
        limit: int = Query(100, ge=1, le=200),
        offset: int = Query(0, ge=0),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Получить изученные слова пользователя с расширенными фильтрами
    """
    # Фильтруем только изученные и освоенные слова
    allowed_statuses = [LearningStatus.LEARNED, LearningStatus.MASTERED]
    
    # Если передан конкретный статус, проверяем что он в разрешенных
    model_status = None
    if status:
        status_mapping = {
            LearningStatusEnum.LEARNED: LearningStatus.LEARNED,
            LearningStatusEnum.MASTERED: LearningStatus.MASTERED,
        }
        model_status = status_mapping.get(status)
        if not model_status:
            raise HTTPException(
                status_code=400, 
                detail="Only 'learned' and 'mastered' statuses are allowed"
            )

    # Базовый запрос
    query = select(UserWordProgress).options(
        selectinload(UserWordProgress.kazakh_word).selectinload(KazakhWord.translations),
        selectinload(UserWordProgress.kazakh_word).selectinload(KazakhWord.category),
        selectinload(UserWordProgress.kazakh_word).selectinload(KazakhWord.difficulty_level)
    ).where(
        UserWordProgress.user_id == current_user.id,
        UserWordProgress.status.in_(allowed_statuses)
    )

    # Применяем фильтры
    if model_status:
        query = query.where(UserWordProgress.status == model_status)
    
    if category_id:
        query = query.join(KazakhWord).where(KazakhWord.category_id == category_id)
    
    if favorites_only:
        query = query.where(
            or_(
                UserWordProgress.is_favorite == True,
                UserWordProgress.user_notes.contains('favorite')
            )
        )
    
    if search:
        search_term = f"%{search.lower()}%"
        query = query.join(KazakhWord).where(
            or_(
                KazakhWord.kazakh_word.ilike(search_term),
                KazakhWord.kazakh_cyrillic.ilike(search_term)
            )
        )

    # Пагинация
    query = query.offset(offset).limit(limit)
    
    result = await db.execute(query)
    progress_list = result.scalars().all()

    # Формируем ответ
    results = []
    for progress in progress_list:
        # ✅ ДОБАВЬТЕ ИЗВЛЕЧЕНИЕ ИЗОБРАЖЕНИЙ
        images = []
        if hasattr(progress.kazakh_word, 'images') and progress.kazakh_word.images:
            images = [
                {
                    "id": img.id,
                    "image_url": img.image_url,
                    "is_primary": img.is_primary,
                    "image_type": img.image_type,
                    "alt_text": img.alt_text
                }
                for img in progress.kazakh_word.images
            ]
        
        # ✅ ДОБАВЬТЕ ИЗВЛЕЧЕНИЕ PRIMARY IMAGE
        primary_image = None
        if progress.kazakh_word.images:
            # Ищем primary image
            for image in progress.kazakh_word.images:
                if image.is_primary:
                    primary_image = image.image_url
                    break
            # Если primary не найден, берем первое доступное
            if not primary_image and progress.kazakh_word.images:
                primary_image = progress.kazakh_word.images[0].image_url
        word_dict = {
            "id": progress.kazakh_word.id,
            "kazakh_word": progress.kazakh_word.kazakh_word,
            "kazakh_cyrillic": progress.kazakh_word.kazakh_cyrillic,
            "category_name": progress.kazakh_word.category.category_name if progress.kazakh_word.category else "Unknown",
            "difficulty_level": progress.kazakh_word.difficulty_level.level_number if progress.kazakh_word.difficulty_level else 1,
            "translations": [
                {
                    "translation": t.translation,
                    "language_code": t.language.language_code
                }
                for t in progress.kazakh_word.translations
            ],
            # ✅ ДОБАВЬТЕ ЭТИ ПОЛЯ:
            "images": images,
            "primary_image": primary_image
        }

        result = UserWordProgressWithWord(
            id=progress.id,
            user_id=progress.user_id,
            kazakh_word_id=progress.kazakh_word_id,
            status=LearningStatusEnum(progress.status.value),
            times_seen=progress.times_seen,
            times_correct=progress.times_correct,
            times_incorrect=progress.times_incorrect,
            difficulty_rating=DifficultyRatingEnum(
                progress.difficulty_rating.value) if progress.difficulty_rating else None,
            user_notes=progress.user_notes,
            added_at=progress.added_at,
            first_learned_at=progress.first_learned_at,
            last_practiced_at=progress.last_practiced_at,
            next_review_at=progress.next_review_at,
            repetition_interval=progress.repetition_interval,
            ease_factor=progress.ease_factor,
            created_at=progress.created_at,
            updated_at=progress.updated_at,
            kazakh_word=word_dict
        )
        results.append(result)

    return results

@router.post("/words/{word_id}/favorite", response_model=UserWordProgressResponse)
async def toggle_word_favorite(
        word_id: int,
        is_favorite: bool = True,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Добавить/убрать слово из избранного
    """
    # Найти прогресс слова
    progress = await UserWordProgressCRUD.get_user_word_progress(
        db, current_user.id, word_id
    )
    
    if not progress:
        raise HTTPException(status_code=404, detail="Word not found in learning list")

    # Обновить статус избранного
    if hasattr(progress, 'is_favorite'):
        progress.is_favorite = is_favorite
    else:
        # Fallback: использовать user_notes
        if is_favorite:
            existing_notes = progress.user_notes or ""
            if "favorite" not in existing_notes:
                progress.user_notes = f"{existing_notes} favorite".strip()
        else:
            if progress.user_notes:
                progress.user_notes = progress.user_notes.replace("favorite", "").strip()

    progress.updated_at = datetime.utcnow()
    
    try:
        await db.commit()
        await db.refresh(progress)
        return progress
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update favorite status: {str(e)}")


# ===== ПУТЕВОДИТЕЛИ - DATABASE DRIVEN =====

@router.get("/guides", response_model=List[Dict[str, Any]])
async def get_learning_guides(
        difficulty: Optional[str] = Query(None),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Получить список доступных путеводителей из базы данных
    """
    try:
        # Get guides with user progress
        guides_with_progress = await UserGuideCRUD.get_guides_with_progress(
            db, current_user.id, difficulty
        )
        
        # Format response
        formatted_guides = []
        for item in guides_with_progress:
            guide = item['guide']
            progress = item['progress']
            
            formatted_guides.append({
                'id': guide.guide_key,
                'title': guide.title,
                'description': guide.description,
                'icon': guide.icon_name,
                'color': guide.color,
                'difficulty': guide.difficulty_level,
                'estimated_time': f"{guide.estimated_minutes} мин" if guide.estimated_minutes else "30 мин",
                'word_count': guide.target_word_count,
                'topics': guide.topics or [],
                'keywords': guide.keywords or [],
                'status': item['status'].value if item['status'] else 'not_started',
                'progress': {
                    'words_completed': item['words_completed'],
                    'total_words_added': item['total_words_added'],
                    'completion_percentage': item['completion_percentage']
                },
                'last_accessed': progress.last_accessed_at.isoformat() if progress and progress.last_accessed_at else None
            })
        
        return formatted_guides
        
    except Exception as e:
        print(f"Error getting guides: {e}")
        raise HTTPException(status_code=500, detail="Failed to get learning guides")


@router.post("/guides/{guide_id}/start")
async def start_learning_guide(
        guide_id: str,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Начать изучение путеводителя - получить слова из базы данных
    """
    try:
        # Get guide from database
        guide = await LearningGuideCRUD.get_guide_by_key(db, guide_id)
        if not guide:
            raise HTTPException(status_code=404, detail="Guide not found")
        
        # Start guide progress
        progress = await UserGuideCRUD.start_guide(db, current_user.id, guide.id)
        
        # Method 1: Get pre-mapped words for this guide
        guide_words = await LearningGuideCRUD.get_guide_words(db, guide.id)
        
        # Method 2: If no pre-mapped words, search by keywords
        if not guide_words and guide.keywords:
            print(f"No pre-mapped words found, searching by keywords: {guide.keywords}")
            found_words = await GuideWordSearchCRUD.search_words_by_keywords(
                db, guide.keywords, limit=guide.target_word_count
            )
            
            # Optionally add these words to guide mapping for future use
            if found_words:
                word_ids = [w.id for w in found_words]
                await LearningGuideCRUD.add_words_to_guide(db, guide.id, word_ids)
                
                # Get the mapped words
                guide_words = await LearningGuideCRUD.get_guide_words(db, guide.id)
        
        # Method 3: If still no words, search by topics
        if not guide_words and guide.topics:
            print(f"No keywords found, searching by topics: {guide.topics}")
            found_words = await GuideWordSearchCRUD.get_words_by_topics(
                db, guide.topics, limit=guide.target_word_count
            )
            
            if found_words:
                word_ids = [w.id for w in found_words]
                await LearningGuideCRUD.add_words_to_guide(db, guide.id, word_ids)
                guide_words = await LearningGuideCRUD.get_guide_words(db, guide.id)
        
        if not guide_words:
            raise HTTPException(
                status_code=404, 
                detail="No words found for this guide. Please contact administrator."
            )
        
        # Add words to user's learning list
        added_count = 0
        already_added = 0
        
        for word_item in guide_words:
            word = word_item['word']
            
            try:
                # Check if word already in user's learning list
                existing = await UserWordProgressCRUD.get_user_word_progress(
                    db, current_user.id, word.id
                )
                
                if not existing:
                    await UserWordProgressCRUD.add_word_to_learning_list(
                        db, current_user.id, word.id, LearningStatus.WANT_TO_LEARN
                    )
                    added_count += 1
                else:
                    already_added += 1
                    
            except Exception as e:
                print(f"Warning: Could not add word {word.id}: {e}")
        
        # Update guide progress
        total_words = len(guide_words)
        await UserGuideCRUD.update_guide_progress(
            db, current_user.id, guide.id, 
            words_completed=0, 
            total_words_added=total_words
        )
        
        return {
            "message": f"Guide '{guide.title}' started successfully",
            "guide_id": guide_id,
            "guide_title": guide.title,
            "words_found": total_words,
            "words_added": added_count,
            "words_already_in_list": already_added,
            "progress": {
                "status": "in_progress",
                "words_completed": 0,
                "total_words_added": total_words,
                "completion_percentage": 0
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error starting guide: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to start guide: {str(e)}")


@router.get("/guides/{guide_id}/words")
async def get_guide_words(
        guide_id: str,
        limit: int = Query(50, ge=1, le=100),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Получить слова для конкретного путеводителя
    """
    try:
        guide = await LearningGuideCRUD.get_guide_by_key(db, guide_id)
        if not guide:
            raise HTTPException(status_code=404, detail="Guide not found")
        
        guide_words = await LearningGuideCRUD.get_guide_words(db, guide.id, limit)
        
        # Format words for response
        formatted_words = []
        for word_item in guide_words:
            word = word_item['word']
            mapping = word_item['mapping']
            
            # Get user's progress for this word
            user_progress = await UserWordProgressCRUD.get_user_word_progress(
                db, current_user.id, word.id
            )
            
            formatted_words.append({
                'word': {
                    'id': word.id,
                    'kazakh_word': word.kazakh_word,
                    'kazakh_cyrillic': word.kazakh_cyrillic,
                    'category': word.category.name if word.category else None,
                    'difficulty': word.difficulty_level.name if word.difficulty_level else None,
                    'translations': [
                        {
                            'language': t.language.language_code,
                            'translation': t.translation
                        } for t in word.translations
                    ]
                },
                'guide_info': {
                    'importance_score': mapping.importance_score,
                    'order_in_guide': mapping.order_in_guide
                },
                'user_progress': {
                    'status': user_progress.status.value if user_progress else None,
                    'is_in_learning_list': user_progress is not None,
                    'correct_count': user_progress.correct_count if user_progress else 0,
                    'total_attempts': user_progress.total_attempts if user_progress else 0
                }
            })
        
        return {
            'guide_id': guide_id,
            'guide_title': guide.title,
            'words': formatted_words,
            'total_words': len(formatted_words)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting guide words: {e}")
        raise HTTPException(status_code=500, detail="Failed to get guide words")


@router.post("/guides/{guide_id}/complete")
async def complete_guide(
        guide_id: str,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Отметить путеводитель как завершенный
    """
    try:
        guide = await LearningGuideCRUD.get_guide_by_key(db, guide_id)
        if not guide:
            raise HTTPException(status_code=404, detail="Guide not found")
        
        # Get current progress
        progress = await UserGuideCRUD.get_user_guide_progress(db, current_user.id, guide.id)
        if not progress:
            raise HTTPException(status_code=404, detail="Guide not started")
        
        # Count completed words (words with LEARNED status)
        completed_words_query = select(func.count(UserWordProgress.id)).where(
            and_(
                UserWordProgress.user_id == current_user.id,
                UserWordProgress.status == LearningStatus.LEARNED
            )
        )
        
        # Get guide words to check completion
        guide_words = await LearningGuideCRUD.get_guide_words(db, guide.id)
        guide_word_ids = [w['word'].id for w in guide_words]
        
        if guide_word_ids:
            completed_words_query = completed_words_query.where(
                UserWordProgress.kazakh_word_id.in_(guide_word_ids)
            )
        
        completed_count_result = await db.execute(completed_words_query)
        completed_count = completed_count_result.scalar()
        
        # Update progress
        updated_progress = await UserGuideCRUD.update_guide_progress(
            db, current_user.id, guide.id,
            words_completed=completed_count,
            total_words_added=progress.total_words_added
        )
        
        return {
            'message': f"Guide '{guide.title}' progress updated",
            'guide_id': guide_id,
            'status': updated_progress.status.value,
            'words_completed': completed_count,
            'total_words': progress.total_words_added,
            'completion_percentage': (
                (completed_count / progress.total_words_added * 100) 
                if progress.total_words_added > 0 
                else 0
            )
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error completing guide: {e}")
        raise HTTPException(status_code=500, detail="Failed to complete guide")


@router.get("/guides/{guide_id}/progress")
async def get_guide_progress(
        guide_id: str,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Получить прогресс по конкретному путеводителю
    """
    try:
        guide = await LearningGuideCRUD.get_guide_by_key(db, guide_id)
        if not guide:
            raise HTTPException(status_code=404, detail="Guide not found")
        
        progress = await UserGuideCRUD.get_user_guide_progress(db, current_user.id, guide.id)
        
        if not progress:
            return {
                'guide_id': guide_id,
                'status': 'not_started',
                'words_completed': 0,
                'total_words_added': 0,
                'completion_percentage': 0,
                'started_at': None,
                'completed_at': None,
                'last_accessed_at': None
            }
        
        return {
            'guide_id': guide_id,
            'status': progress.status.value,
            'words_completed': progress.words_completed,
            'total_words_added': progress.total_words_added,
            'completion_percentage': (
                (progress.words_completed / progress.total_words_added * 100) 
                if progress.total_words_added > 0 
                else 0
            ),
            'started_at': progress.started_at.isoformat() if progress.started_at else None,
            'completed_at': progress.completed_at.isoformat() if progress.completed_at else None,
            'last_accessed_at': progress.last_accessed_at.isoformat() if progress.last_accessed_at else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting guide progress: {e}")
        raise HTTPException(status_code=500, detail="Failed to get guide progress")
    
@router.get("/words", response_model=List[UserWordProgressWithWord])
async def get_learning_words(
        response: Response,
        status: Optional[LearningStatusEnum] = None,
        category_id: Optional[int] = None,
        difficulty_level_id: Optional[int] = None,
        limit: int = 100,
        offset: int = 0,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user_with_refresh)
):
    """Get user's learning words with filters and pagination"""
    # Handle automatic token refresh
    TokenRefreshResponse.add_token_header(response, current_user)

    # Build filter dict
    filters = LearningListFilters(
        status=status,
        category_id=category_id,
        difficulty_level_id=difficulty_level_id,
        limit=limit,
        offset=offset
    )

    # Get words using existing CRUD method
    words = await UserWordProgressCRUD.get_user_words_with_filters(
        db, current_user.id, filters
    )

    # Format response with word details
    result = []
    for progress in words:
        word = progress.kazakh_word
        word_dict = {
            "id": word.id,
            "kazakh_word": word.kazakh_word,
            "kazakh_cyrillic": word.kazakh_cyrillic,
            "category_name": word.category.category_name if word.category else "Unknown",
            "difficulty_level": word.difficulty_level.level_number if word.difficulty_level else 1,
            "translations": [
                {
                    "translation": t.translation,
                    "language_code": t.language.language_code
                }
                for t in word.translations
            ]
        }

        result.append(UserWordProgressWithWord(
            id=progress.id,
            user_id=progress.user_id,
            kazakh_word_id=progress.kazakh_word_id,
            status=LearningStatusEnum(progress.status.value),
            times_seen=progress.times_seen,
            times_correct=progress.times_correct,
            times_incorrect=progress.times_incorrect,
            difficulty_rating=DifficultyRatingEnum(progress.difficulty_rating.value) if progress.difficulty_rating else None,
            user_notes=progress.user_notes,
            added_at=progress.added_at,
            first_learned_at=progress.first_learned_at,
            last_practiced_at=progress.last_practiced_at,
            next_review_at=progress.next_review_at,
            repetition_interval=progress.repetition_interval,
            ease_factor=progress.ease_factor,
            created_at=progress.created_at,
            updated_at=progress.updated_at,
            kazakh_word=word_dict
        ))

    return result    

@router.post("/words/{word_id}/review")
async def trigger_word_review(
    word_id: int,
    review_type: str = Query("immediate", description="immediate or scheduled"),
    days_from_now: int = Query(7, description="Days from now for scheduled review"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Trigger immediate or scheduled review for a word"""
    
    # Verify word exists and user has progress with it
    progress = await UserWordProgressCRUD.get_user_word_progress(
        db, current_user.id, word_id
    )
    
    if not progress:
        raise HTTPException(
            status_code=404, 
            detail="Word not found in your learning list"
        )
    
    # Only allow review for learned/mastered words
    if progress.status not in [LearningStatus.LEARNED, LearningStatus.MASTERED]:
        raise HTTPException(
            status_code=400,
            detail="Only learned or mastered words can be scheduled for review"
        )
    
    now = datetime.utcnow()
    
    if review_type == "immediate":
        # Set for immediate review
        next_review_at = now
        repetition_interval = 1
    else:
        # Schedule for future
        next_review_at = now + timedelta(days=days_from_now)
        repetition_interval = days_from_now
    
    # Update the word progress
    await UserWordProgressCRUD.update_word_progress(
        db, current_user.id, word_id,
        status=LearningStatus.REVIEW,
        next_review_at=next_review_at,
        repetition_interval=repetition_interval,
        updated_at=now
    )
    
    return {
        "message": f"Word scheduled for {review_type} review",
        "word_id": word_id,
        "review_type": review_type,
        "next_review_at": next_review_at.isoformat()
    }


@router.get("/review/statistics")
async def get_review_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get review statistics for current user"""
    now = datetime.utcnow()
    today_end = now.replace(hour=23, minute=59, second=59)
    
    # Words due for review now
    due_now_stmt = (
        select(func.count(UserWordProgress.id))
        .where(
            and_(
                UserWordProgress.user_id == current_user.id,
                UserWordProgress.status == LearningStatus.REVIEW,
                UserWordProgress.next_review_at <= now
            )
        )
    )
    
    # Words due today
    due_today_stmt = (
        select(func.count(UserWordProgress.id))
        .where(
            and_(
                UserWordProgress.user_id == current_user.id,
                UserWordProgress.status == LearningStatus.REVIEW,
                UserWordProgress.next_review_at <= today_end,
                UserWordProgress.next_review_at > now
            )
        )
    )
    
    # Overdue words (learned/mastered words past their review date)
    overdue_stmt = (
        select(func.count(UserWordProgress.id))
        .where(
            and_(
                UserWordProgress.user_id == current_user.id,
                UserWordProgress.status.in_([LearningStatus.LEARNED, LearningStatus.MASTERED]),
                UserWordProgress.next_review_at < now
            )
        )
    )
    
    due_now_result = await db.execute(due_now_stmt)
    due_today_result = await db.execute(due_today_stmt)
    overdue_result = await db.execute(overdue_stmt)
    
    return {
        "due_now": due_now_result.scalar() or 0,
        "due_today": due_today_result.scalar() or 0,
        "overdue": overdue_result.scalar() or 0
    }


@router.post("/review/batch-trigger")
async def batch_trigger_reviews(
    word_ids: List[int],
    review_type: str = "immediate",
    days_from_now: int = 7,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Trigger review for multiple words"""
    results = []
    successful_count = 0
    
    now = datetime.utcnow()
    
    for word_id in word_ids:
        try:
            # Get word progress
            progress = await UserWordProgressCRUD.get_user_word_progress(
                db, current_user.id, word_id
            )
            
            if not progress:
                results.append({
                    "word_id": word_id,
                    "success": False,
                    "error": "Word not found in learning list"
                })
                continue
            
            if progress.status not in [LearningStatus.LEARNED, LearningStatus.MASTERED]:
                results.append({
                    "word_id": word_id,
                    "success": False,
                    "error": "Word is not learned or mastered"
                })
                continue
            
            # Set review schedule
            if review_type == "immediate":
                next_review_at = now
                repetition_interval = 1
            else:
                next_review_at = now + timedelta(days=days_from_now)
                repetition_interval = days_from_now
            
            # Update the word
            await UserWordProgressCRUD.update_word_progress(
                db, current_user.id, word_id,
                status=LearningStatus.REVIEW,
                next_review_at=next_review_at,
                repetition_interval=repetition_interval,
                updated_at=now
            )
            
            results.append({
                "word_id": word_id,
                "success": True
            })
            successful_count += 1
            
        except Exception as e:
            results.append({
                "word_id": word_id,
                "success": False,
                "error": str(e)
            })
    
    return {
        "message": f"Processed {len(word_ids)} words, {successful_count} successful",
        "results": results,
        "successful_count": successful_count,
        "total_count": len(word_ids)
    }