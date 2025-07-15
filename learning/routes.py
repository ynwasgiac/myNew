# learning/routes.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
from datetime import datetime

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
            ]
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
    """Start a new practice session with proper async handling"""
    
    try:
        # Create learning session with proper error handling
        session = await UserLearningSessionCRUD.create_session(
            db, current_user.id, request.session_type,
            request.category_id, request.difficulty_level_id
        )
        
        # Get words for practice
        practice_words = []

        if request.include_review:
            # Get words due for review first
            try:
                review_words = await UserWordProgressCRUD.get_words_for_review(
                    db, current_user.id, min(request.word_count // 2, 10)
                )
                
                for progress in review_words:
                    # Ensure the kazakh_word relationship is loaded
                    if hasattr(progress, 'kazakh_word') and progress.kazakh_word:
                        word = progress.kazakh_word
                        
                        # Get translation for the requested language
                        translation = ""
                        if hasattr(word, 'translations') and word.translations:
                            for t in word.translations:
                                if hasattr(t, 'language') and t.language and t.language.language_code == request.language_code:
                                    translation = t.translation
                                    break
                            # Fallback to first translation if language not found
                            if not translation and word.translations:
                                translation = word.translations[0].translation

                        practice_words.append(PracticeWordItem(
                            id=word.id,
                            kazakh_word=word.kazakh_word,
                            kazakh_cyrillic=getattr(word, 'kazakh_cyrillic', None),
                            translation=translation,
                            difficulty_level=word.difficulty_level.level_number if hasattr(word, 'difficulty_level') and word.difficulty_level else 1,
                            times_seen=progress.times_seen,
                            last_practiced=progress.last_practiced_at,
                            is_review=True
                        ))
            except Exception as e:
                print(f"Warning: Could not load review words: {e}")
                # Continue without review words

        # Fill remaining slots with new/learning words
        remaining_count = request.word_count - len(practice_words)
        if remaining_count > 0:
            try:
                # Get user's learning words
                learning_words = await UserWordProgressCRUD.get_user_learning_words(
                    db, current_user.id, None, request.category_id,
                    request.difficulty_level_id, remaining_count, 0
                )

                for progress in learning_words:
                    if len(practice_words) >= request.word_count:
                        break

                    if hasattr(progress, 'kazakh_word') and progress.kazakh_word:
                        word = progress.kazakh_word
                        
                        # Get translation
                        translation = ""
                        if hasattr(word, 'translations') and word.translations:
                            for t in word.translations:
                                if hasattr(t, 'language') and t.language and t.language.language_code == request.language_code:
                                    translation = t.translation
                                    break
                            if not translation and word.translations:
                                translation = word.translations[0].translation

                        practice_words.append(PracticeWordItem(
                            id=word.id,
                            kazakh_word=word.kazakh_word,
                            kazakh_cyrillic=getattr(word, 'kazakh_cyrillic', None),
                            translation=translation,
                            difficulty_level=word.difficulty_level.level_number if hasattr(word, 'difficulty_level') and word.difficulty_level else 1,
                            times_seen=progress.times_seen,
                            last_practiced=progress.last_practiced_at,
                            is_review=False
                        ))
            except Exception as e:
                print(f"Warning: Could not load learning words: {e}")

        # If still not enough words, get random words from the specified category/difficulty
        if len(practice_words) < request.word_count:
            remaining_count = request.word_count - len(practice_words)
            try:
                random_words = await KazakhWordCRUD.get_random_words(
                    db, remaining_count, request.difficulty_level_id,
                    request.category_id, request.language_code
                )

                for word in random_words:
                    if len(practice_words) >= request.word_count:
                        break

                    # Check if already in practice_words
                    if not any(pw.id == word.id for pw in practice_words):
                        translation = ""
                        if hasattr(word, 'translations') and word.translations:
                            translation = word.translations[0].translation

                        practice_words.append(PracticeWordItem(
                            id=word.id,
                            kazakh_word=word.kazakh_word,
                            kazakh_cyrillic=getattr(word, 'kazakh_cyrillic', None),
                            translation=translation,
                            difficulty_level=getattr(word.difficulty_level, 'level_number', 1) if hasattr(word, 'difficulty_level') else 1,
                            times_seen=0,
                            last_practiced=None,
                            is_review=False
                        ))
            except Exception as e:
                print(f"Warning: Could not load random words: {e}")

        # Ensure we have at least some words
        if not practice_words:
            raise HTTPException(
                status_code=404, 
                detail="No words available for practice. Please add some words to your learning list first."
            )

        # Shuffle the words
        import random
        random.shuffle(practice_words)

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
        print(f"Error in start_practice_session: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start practice session: {str(e)}"
        )


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

@router.post("/practice/start-session", response_model=PracticeSessionResponse)
async def start_practice_session(
        request: PracticeSessionRequest,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Начать сессию практики с УЛУЧШЕННОЙ логикой выбора слов:
    1. Приоритет: слова из списка изучения (WANT_TO_LEARN, LEARNING, REVIEW)
    2. Дополнение: случайные слова из базы данных
    """
    try:
        # Создаем сессию
        session = await UserLearningSessionCRUD.create_session(
            db, current_user.id, request.session_type
        )

        practice_words = []
        user_learning_words_count = 0

        # ЭТАП 1: Получить слова из списка изучения пользователя
        print(f"🎯 Этап 1: Загружаем слова из списка изучения пользователя")
        
        # Получаем слова со статусами WANT_TO_LEARN, LEARNING, REVIEW
        learning_statuses = [
            LearningStatus.WANT_TO_LEARN,
            LearningStatus.LEARNING, 
            LearningStatus.REVIEW
        ]
        
        for status in learning_statuses:
            if len(practice_words) >= request.word_count:
                break
                
            try:
                status_words = await UserWordProgressCRUD.get_user_learning_words(
                    db, 
                    current_user.id, 
                    status=status,
                    category_id=request.category_id,
                    difficulty_level_id=request.difficulty_level_id,
                    limit=request.word_count,
                    offset=0
                )
                
                for progress in status_words:
                    if len(practice_words) >= request.word_count:
                        break
                        
                    word = progress.kazakh_word
                    if not word:
                        continue
                        
                    # Найти перевод на нужном языке
                    translation = ""
                    if hasattr(word, 'translations') and word.translations:
                        # Ищем перевод на языке пользователя
                        user_lang_translation = None
                        if request.language_code:
                            user_lang_translation = next(
                                (t for t in word.translations if t.language.language_code == request.language_code),
                                None
                            )
                        
                        if user_lang_translation:
                            translation = user_lang_translation.translation
                        elif word.translations:
                            translation = word.translations[0].translation

                    practice_word = PracticeWordItem(
                        id=word.id,
                        kazakh_word=word.kazakh_word,
                        kazakh_cyrillic=getattr(word, 'kazakh_cyrillic', None),
                        translation=translation,
                        difficulty_level=word.difficulty_level.level_number if hasattr(word, 'difficulty_level') and word.difficulty_level else 1,
                        times_seen=progress.times_seen,
                        last_practiced=progress.last_practiced_at,
                        is_review=status == LearningStatus.REVIEW,
                        learning_status=status.value  # Добавляем статус изучения
                    )
                    
                    practice_words.append(practice_word)
                    user_learning_words_count += 1
                    
                print(f"✅ Загружено {len(status_words)} слов со статусом {status.value}")
                    
            except Exception as e:
                print(f"⚠️ Ошибка загрузки слов со статусом {status.value}: {e}")

        print(f"📊 Итого из списка изучения: {user_learning_words_count} слов")

        # ЭТАП 2: Дополнить случайными словами, если не хватает
        if len(practice_words) < request.word_count:
            remaining_count = request.word_count - len(practice_words)
            print(f"🎲 Этап 2: Дополняем {remaining_count} случайными словами")
            
            try:
                # Получить ID слов, которые уже есть в practice_words
                existing_word_ids = [pw.id for pw in practice_words]
                
                random_words = await KazakhWordCRUD.get_random_words(
                    db, 
                    remaining_count * 2,  # Берем больше, чтобы отфильтровать дубликаты
                    request.difficulty_level_id,
                    request.category_id, 
                    request.language_code,
                    exclude_word_ids=existing_word_ids  # Исключаем уже выбранные слова
                )

                added_random = 0
                for word in random_words:
                    if added_random >= remaining_count:
                        break
                        
                    # Проверяем, что слово не добавлено ранее
                    if word.id in existing_word_ids:
                        continue
                        
                    translation = ""
                    if hasattr(word, 'translations') and word.translations:
                        # Ищем перевод на языке пользователя
                        user_lang_translation = None
                        if request.language_code:
                            user_lang_translation = next(
                                (t for t in word.translations if t.language.language_code == request.language_code),
                                None
                            )
                        
                        if user_lang_translation:
                            translation = user_lang_translation.translation
                        elif word.translations:
                            translation = word.translations[0].translation

                    practice_word = PracticeWordItem(
                        id=word.id,
                        kazakh_word=word.kazakh_word,
                        kazakh_cyrillic=getattr(word, 'kazakh_cyrillic', None),
                        translation=translation,
                        difficulty_level=getattr(word.difficulty_level, 'level_number', 1) if hasattr(word, 'difficulty_level') else 1,
                        times_seen=0,
                        last_practiced=None,
                        is_review=False,
                        learning_status="random"  # Помечаем как случайное слово
                    )
                    
                    practice_words.append(practice_word)
                    existing_word_ids.append(word.id)
                    added_random += 1
                    
                print(f"✅ Добавлено {added_random} случайных слов")
                    
            except Exception as e:
                print(f"⚠️ Ошибка загрузки случайных слов: {e}")

        # ЭТАП 3: Финальная проверка и перемешивание
        if not practice_words:
            raise HTTPException(
                status_code=404, 
                detail="Нет доступных слов для практики. Пожалуйста, добавьте слова в список изучения."
            )

        # Умное перемешивание: сначала слова изучения, потом случайные
        learning_words = [pw for pw in practice_words if pw.learning_status != "random"]
        random_words = [pw for pw in practice_words if pw.learning_status == "random"]
        
        # Перемешиваем каждую группу отдельно
        import random
        random.shuffle(learning_words)
        random.shuffle(random_words)
        
        # Объединяем: 70% слов изучения в начале, затем вставляем случайные
        final_words = []
        learning_priority_count = min(len(learning_words), int(len(practice_words) * 0.7))
        
        # Добавляем приоритетные слова изучения
        final_words.extend(learning_words[:learning_priority_count])
        
        # Добавляем оставшиеся слова с перемешиванием
        remaining_learning = learning_words[learning_priority_count:]
        all_remaining = remaining_learning + random_words
        random.shuffle(all_remaining)
        final_words.extend(all_remaining)

        print(f"🎯 Финальный состав: {user_learning_words_count} из списка изучения + {len(random_words)} случайных")
        print(f"📝 Приоритет: {learning_priority_count} слов изучения в начале")

        # Shuffle the words
        random.shuffle(practice_words)

        return PracticeSessionResponse(
            session_id=session.id,
            words=final_words,
            session_type=request.session_type,
            total_words=len(final_words),
            learning_words_count=user_learning_words_count,  # Добавляем в ответ
            random_words_count=len(random_words)  # Добавляем в ответ
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка в start_practice_session: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Не удалось начать сессию практики: {str(e)}"
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


# ===== ПУТЕВОДИТЕЛИ =====

@router.get("/guides", response_model=List[Dict[str, Any]])
async def get_learning_guides(
        difficulty: Optional[str] = Query(None),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Получить список доступных путеводителей
    """
    # Предопределенные путеводители (можно перенести в базу данных)
    guides = [
        {
            'id': 'greetings',
            'title': 'Приветствие и знакомство',
            'description': 'Основные фразы для знакомства и приветствия',
            'icon': 'Users',
            'color': 'blue',
            'difficulty': 'beginner',
            'estimated_time': '15-20 мин',
            'word_count': 15,
            'topics': ['Приветствие', 'Знакомство', 'Вежливость'],
            'keywords': ['сәлем', 'кешіріңіз', 'рахмет', 'қоштасу', 'таныстыру']
        },
        {
            'id': 'family',
            'title': 'Семья и родственники',
            'description': 'Слова для описания семейных отношений',
            'icon': 'Heart',
            'color': 'red',
            'difficulty': 'beginner',
            'estimated_time': '20-25 мин',
            'word_count': 20,
            'topics': ['Семья', 'Родственники', 'Отношения'],
            'keywords': ['отбасы', 'ата', 'ана', 'бала', 'туыс', 'жұбайлас']
        },
        {
            'id': 'home',
            'title': 'Дом и быт',
            'description': 'Предметы домашнего обихода и комнаты',
            'icon': 'Home',
            'color': 'green',
            'difficulty': 'beginner',
            'estimated_time': '25-30 мин',
            'word_count': 25,
            'topics': ['Дом', 'Мебель', 'Комнаты', 'Быт'],
            'keywords': ['үй', 'бөлме', 'жиһаз', 'ас үй', 'жатын бөлме']
        },
        {
            'id': 'food',
            'title': 'Еда и напитки',
            'description': 'Названия блюд, продуктов и напитков',
            'icon': 'Utensils',
            'color': 'orange',
            'difficulty': 'intermediate',
            'estimated_time': '30-35 мин',
            'word_count': 30,
            'topics': ['Еда', 'Напитки', 'Кухня', 'Рестораны'],
            'keywords': ['тамақ', 'ас', 'сусын', 'нан', 'ет', 'көкөніс']
        },
        {
            'id': 'transport',
            'title': 'Транспорт и путешествия',
            'description': 'Виды транспорта и слова для поездок',
            'icon': 'Car',
            'color': 'purple',
            'difficulty': 'intermediate',
            'estimated_time': '25-30 мин',
            'word_count': 22,
            'topics': ['Транспорт', 'Путешествия', 'Дорога'],
            'keywords': ['көлік', 'жол', 'саяхат', 'аэропорт', 'автобус']
        },
        {
            'id': 'work',
            'title': 'Работа и профессии',
            'description': 'Названия профессий и рабочая лексика',
            'icon': 'Briefcase',
            'color': 'indigo',
            'difficulty': 'intermediate',
            'estimated_time': '35-40 мин',
            'word_count': 28,
            'topics': ['Профессии', 'Работа', 'Офис', 'Карьера'],
            'keywords': ['жұмыс', 'маман', 'кеңсе', 'мансап', 'қызмет']
        },
        {
            'id': 'education',
            'title': 'Образование и учеба',
            'description': 'Школьная и университетская лексика',
            'icon': 'GraduationCap',
            'color': 'blue',
            'difficulty': 'advanced',
            'estimated_time': '40-45 мин',
            'word_count': 35,
            'topics': ['Школа', 'Университет', 'Наука', 'Учеба'],
            'keywords': ['білім', 'мектеп', 'университет', 'сабақ', 'ғылым']
        },
        {
            'id': 'time',
            'title': 'Время и календарь',
            'description': 'Дни недели, месяцы, время суток',
            'icon': 'Clock',
            'color': 'teal',
            'difficulty': 'beginner',
            'estimated_time': '20-25 мин',
            'word_count': 18,
            'topics': ['Время', 'Календарь', 'Дни недели', 'Месяцы'],
            'keywords': ['уақыт', 'күн', 'ай', 'жыл', 'сағат', 'апта']
        }
    ]

    # Фильтрация по сложности
    if difficulty:
        guides = [g for g in guides if g['difficulty'] == difficulty]

    return guides


@router.post("/guides/{guide_id}/start")
async def start_learning_guide(
        guide_id: str,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Начать изучение путеводителя - найти слова и добавить в список изучения
    """
    # Получить путеводитель (здесь упрощенно, в реальности из базы)
    guides_map = {
        'greetings': ['сәлем', 'кешіріңіз', 'рахмет', 'қоштасу', 'таныстыру'],
        'family': ['отбасы', 'ата', 'ана', 'бала', 'туыс', 'жұбайлас'],
        'home': ['үй', 'бөлме', 'жиһаз', 'ас үй', 'жатын бөлме'],
        'food': ['тамақ', 'ас', 'сусын', 'нан', 'ет', 'көкөніс'],
        'transport': ['көлік', 'жол', 'саяхат', 'аэропорт', 'автобус'],
        'work': ['жұмыс', 'маман', 'кеңсе', 'мансап', 'қызмет'],
        'education': ['білім', 'мектеп', 'университет', 'сабақ', 'ғылым'],
        'time': ['уақыт', 'күн', 'ай', 'жыл', 'сағат', 'апта']
    }
    
    keywords = guides_map.get(guide_id, [])
    if not keywords:
        raise HTTPException(status_code=404, detail="Guide not found")

    # Найти слова по ключевым словам
    found_words = []
    for keyword in keywords:
        query = select(KazakhWord).where(
            or_(
                KazakhWord.kazakh_word.ilike(f"%{keyword}%"),
                KazakhWord.kazakh_cyrillic.ilike(f"%{keyword}%")
            )
        ).limit(5)  # Максимум 5 слов на ключевое слово
        
        result = await db.execute(query)
        words = result.scalars().all()
        found_words.extend(words)

    # Удалить дубликаты
    unique_words = list({word.id: word for word in found_words}.values())
    
    if not unique_words:
        raise HTTPException(status_code=404, detail="No words found for this guide")

    # Добавить слова в список изучения
    added_count = 0
    for word in unique_words:
        try:
            # Проверить, не добавлено ли уже
            existing = await UserWordProgressCRUD.get_user_word_progress(
                db, current_user.id, word.id
            )
            if not existing:
                await UserWordProgressCRUD.add_word_to_learning_list(
                    db, current_user.id, word.id, LearningStatus.WANT_TO_LEARN
                )
                added_count += 1
        except Exception as e:
            print(f"Warning: Could not add word {word.id}: {e}")

    return {
        "message": f"Guide started successfully",
        "guide_id": guide_id,
        "words_found": len(unique_words),
        "words_added": added_count,
        "words_already_in_list": len(unique_words) - added_count
    }