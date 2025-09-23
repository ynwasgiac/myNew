# database/learning_crud.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, func, desc, case
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from sqlalchemy import Integer
from .learning_models import (
    UserWordProgress, LearningStatus, DifficultyRating,
    UserLearningSession, UserSessionDetail, UserLearningGoal,
    UserAchievement, UserStreak
)
from .models import KazakhWord, Category, DifficultyLevel, Translation, Language


class UserWordProgressCRUD:
    """CRUD operations for user word progress"""

    @staticmethod
    async def add_word_to_learning_list(
            db: AsyncSession,
            user_id: int,
            word_id: int,
            status: LearningStatus = LearningStatus.WANT_TO_LEARN
    ) -> UserWordProgress:
        """Add a word to user's learning list"""
        # Check if already exists
        existing = await UserWordProgressCRUD.get_user_word_progress(db, user_id, word_id)
        if existing:
            return existing

        progress = UserWordProgress(
            user_id=user_id,
            kazakh_word_id=word_id,
            status=status
        )
        db.add(progress)
        await db.commit()
        await db.refresh(progress)
        return progress

    @staticmethod
    async def get_user_word_progress(
            db: AsyncSession,
            user_id: int,
            word_id: int
    ) -> Optional[UserWordProgress]:
        """Get user's progress for a specific word"""
        result = await db.execute(
            select(UserWordProgress)
            .options(
                selectinload(UserWordProgress.kazakh_word)
                .selectinload(KazakhWord.translations)
                .selectinload(Translation.language),
                selectinload(UserWordProgress.kazakh_word)
                .selectinload(KazakhWord.category),
                selectinload(UserWordProgress.kazakh_word)
                .selectinload(KazakhWord.difficulty_level),
                # ✅ ДОБАВЛЯЕМ ЗАГРУЗКУ ИЗОБРАЖЕНИЙ
                selectinload(UserWordProgress.kazakh_word)
                .selectinload(KazakhWord.images)
            )
            .where(
                and_(
                    UserWordProgress.user_id == user_id,
                    UserWordProgress.kazakh_word_id == word_id
                )
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_learning_words(
            db: AsyncSession,
            user_id: int,
            status: Optional[LearningStatus] = None,
            category_id: Optional[int] = None,
            difficulty_level_id: Optional[int] = None,
            limit: int = 50,
            offset: int = 0
    ) -> List[UserWordProgress]:
        """Get user's learning words with filters"""
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
                # ✅ ДОБАВЛЯЕМ ЗАГРУЗКУ ИЗОБРАЖЕНИЙ - ЭТО ГЛАВНОЕ ИСПРАВЛЕНИЕ!
                selectinload(UserWordProgress.kazakh_word)
                .selectinload(KazakhWord.images)
            )
            .where(UserWordProgress.user_id == user_id)
        )

        if status:
            query = query.where(UserWordProgress.status == status)

        if category_id:
            query = query.join(KazakhWord).where(KazakhWord.category_id == category_id)

        if difficulty_level_id:
            query = query.join(KazakhWord).where(KazakhWord.difficulty_level_id == difficulty_level_id)

        query = query.order_by(UserWordProgress.updated_at.desc()).offset(offset).limit(limit)

        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def update_word_progress(
            db: AsyncSession,
            user_id: int,
            word_id: int,
            status: Optional[LearningStatus] = None,
            was_correct: Optional[bool] = None,
            difficulty_rating: Optional[DifficultyRating] = None,
            user_notes: Optional[str] = None,
            next_review_at: Optional[datetime] = None,
            repetition_interval: Optional[int] = None
    ) -> Optional[UserWordProgress]:
        """
        Update user's progress for a word
        
        Args:
            db: Database session
            user_id: ID of the user
            word_id: ID of the word
            status: New learning status (optional)
            was_correct: Whether the answer was correct (optional)
            difficulty_rating: User's difficulty rating (optional)
            user_notes: User's personal notes (optional)
            next_review_at: Next review date (optional)
            repetition_interval: Repetition interval in days (optional)
            
        Returns:
            Updated UserWordProgress object or None if not found
        """
        progress = await UserWordProgressCRUD.get_user_word_progress(db, user_id, word_id)
        if not progress:
            return None

        update_data = {"updated_at": datetime.utcnow()}

        # Handle explicit status change
        if status:
            update_data["status"] = status
            if status == LearningStatus.LEARNED and not progress.first_learned_at:
                update_data["first_learned_at"] = datetime.utcnow()

        # Handle answer correctness and update statistics
        if was_correct is not None:
            update_data["times_seen"] = progress.times_seen + 1
            update_data["last_practiced_at"] = datetime.utcnow()

            if was_correct:
                update_data["times_correct"] = progress.times_correct + 1
            else:
                update_data["times_incorrect"] = progress.times_incorrect + 1

            # 🔥 NEW LOGIC: Automatic status change from REVIEW to LEARNED on correct answer
            if was_correct and progress.status == LearningStatus.REVIEW and not status:
                print(f"🎯 Automatically changing status from REVIEW to LEARNED for word {word_id}")
                update_data["status"] = LearningStatus.LEARNED
                if not progress.first_learned_at:
                    update_data["first_learned_at"] = datetime.utcnow()
                    print(f"   🎉 Setting first_learned_at for word {word_id}")

            # Update spaced repetition parameters
            spaced_rep_data = UserWordProgressCRUD._calculate_spaced_repetition(progress, was_correct)
            update_data.update(spaced_rep_data)

        # Handle difficulty rating
        if difficulty_rating:
            update_data["difficulty_rating"] = difficulty_rating

        # Handle user notes
        if user_notes is not None:
            update_data["user_notes"] = user_notes

        # Handle custom review schedule (for manual review scheduling)
        if next_review_at is not None:
            update_data["next_review_at"] = next_review_at
        
        if repetition_interval is not None:
            update_data["repetition_interval"] = repetition_interval

        # Execute the update
        stmt = (
            update(UserWordProgress)
            .where(
                and_(
                    UserWordProgress.user_id == user_id,
                    UserWordProgress.kazakh_word_id == word_id
                )
            )
            .values(**update_data)
        )

        await db.execute(stmt)
        await db.commit()

        # Return updated progress
        updated_progress = await UserWordProgressCRUD.get_user_word_progress(db, user_id, word_id)
        return updated_progress


    @staticmethod
    def _calculate_spaced_repetition(progress, was_correct: bool) -> Dict[str, Any]:
        """
        Calculate next review date using spaced repetition algorithm
        
        Args:
            progress: Current UserWordProgress object
            was_correct: Whether the answer was correct
            
        Returns:
            Dictionary with spaced repetition parameters
        """
        if was_correct:
            # Increase interval and ease factor for correct answers
            new_interval = max(1, int(progress.repetition_interval * progress.ease_factor))
            new_ease = min(2.8, progress.ease_factor + 0.1)
        else:
            # Reset interval and decrease ease factor for incorrect answers
            new_interval = 1
            new_ease = max(1.3, progress.ease_factor - 0.2)

        # Calculate next review date
        next_review = datetime.utcnow() + timedelta(days=new_interval)

        return {
            "repetition_interval": new_interval,
            "ease_factor": new_ease,
            "next_review_at": next_review
        }

    @staticmethod
    async def get_words_for_review(
            db: AsyncSession,
            user_id: int,
            limit: int = 20
    ) -> List[UserWordProgress]:
        """Get words that need review"""
        query = (
            select(UserWordProgress)
            .options(
                selectinload(UserWordProgress.kazakh_word)
                .selectinload(KazakhWord.translations)
                .selectinload(Translation.language)
            )
            .where(
                and_(
                    UserWordProgress.user_id == user_id,
                    UserWordProgress.next_review_at <= datetime.utcnow(),
                    UserWordProgress.status.in_([
                        LearningStatus.REVIEW
                    ])
                )
            )
            .order_by(UserWordProgress.next_review_at)
            .limit(limit)
        )

        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def remove_word_from_learning(
            db: AsyncSession,
            user_id: int,
            word_id: int
    ) -> bool:
        """Remove word from user's learning list"""
        stmt = delete(UserWordProgress).where(
            and_(
                UserWordProgress.user_id == user_id,
                UserWordProgress.kazakh_word_id == word_id
            )
        )
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount > 0


class UserLearningSessionCRUD:
    """CRUD operations for learning sessions"""


    @staticmethod
    async def count_words_learned_today(
            db: AsyncSession,
            user_id: int,
            target_date
    ) -> int:
        """Count words learned on a specific date"""
        start_of_day = datetime.combine(target_date, datetime.min.time())
        end_of_day = datetime.combine(target_date, datetime.max.time())

        result = await db.execute(
            select(func.count(UserWordProgress.id))
            .where(
                and_(
                    UserWordProgress.user_id == user_id,
                    UserWordProgress.status.in_([LearningStatus.LEARNED, LearningStatus.MASTERED]),
                    UserWordProgress.first_learned_at >= start_of_day,
                    UserWordProgress.first_learned_at <= end_of_day
                )
            )
        )
        return result.scalar() or 0


    # In UserLearningSessionCRUD class:
    @staticmethod
    async def count_sessions_today(
            db: AsyncSession,
            user_id: int,
            target_date
    ) -> int:
        """Count learning sessions on a specific date"""
        start_of_day = datetime.combine(target_date, datetime.min.time())
        end_of_day = datetime.combine(target_date, datetime.max.time())

        result = await db.execute(
            select(func.count(UserLearningSession.id))
            .where(
                and_(
                    UserLearningSession.user_id == user_id,
                    UserLearningSession.started_at >= start_of_day,
                    UserLearningSession.started_at <= end_of_day,
                    UserLearningSession.finished_at.isnot(None)  # Only completed sessions
                )
            )
        )
        return result.scalar() or 0

    @staticmethod
    async def create_session(
            db: AsyncSession,
            user_id: int,
            session_type: str,
            category_id: Optional[int] = None,
            difficulty_level_id: Optional[int] = None
    ) -> UserLearningSession:
        """Create a new learning session"""
        session = UserLearningSession(
            user_id=user_id,
            session_type=session_type,
            category_id=category_id,
            difficulty_level_id=difficulty_level_id
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session

    @staticmethod
    async def finish_session(
            db: AsyncSession,
            session_id: int,
            duration_seconds: Optional[int] = None
    ) -> Optional[UserLearningSession]:
        """Finish a learning session"""
        # Calculate session stats
        details_result = await db.execute(
            select(
                func.count(UserSessionDetail.id).label('total_words'),
                func.sum(func.cast(UserSessionDetail.was_correct, Integer)).label('correct_count')
            )
            .where(UserSessionDetail.session_id == session_id)
        )
        stats = details_result.first()
        
        total_words = stats.total_words or 0
        correct_count = stats.correct_count or 0
        incorrect_count = total_words - correct_count

        # Update data with BOTH fields
        update_data = {
            "finished_at": datetime.utcnow(),
            "total_questions": total_words,           # Total questions in session
            "words_studied": total_words,             # Words actually studied (same value for now)
            "correct_answers": correct_count,
            "incorrect_answers": incorrect_count
        }

        if duration_seconds:
            update_data["duration_seconds"] = duration_seconds

        stmt = (
            update(UserLearningSession)
            .where(UserLearningSession.id == session_id)
            .values(**update_data)
            .returning(UserLearningSession)
        )

        result = await db.execute(stmt)
        await db.commit()
        return result.scalar_one_or_none()

    @staticmethod
    async def add_session_detail(
            db: AsyncSession,
            session_id: int,
            word_id: int,
            was_correct: bool,
            question_type: str,
            user_answer: Optional[str] = None,
            correct_answer: Optional[str] = None,
            response_time_ms: Optional[int] = None,
            question_language: Optional[str] = None,
            answer_language: Optional[str] = None
    ) -> UserSessionDetail:
        """Add detail to a learning session"""
        detail = UserSessionDetail(
            session_id=session_id,
            kazakh_word_id=word_id,
            was_correct=was_correct,
            question_type=question_type,
            user_answer=user_answer,
            correct_answer=correct_answer,
            response_time_ms=response_time_ms,
            question_language=question_language,
            answer_language=answer_language
        )
        db.add(detail)
        await db.commit()
        await db.refresh(detail)
        return detail

    @staticmethod
    async def get_user_sessions(
            db: AsyncSession,
            user_id: int,
            limit: int = 50,
            offset: int = 0
    ) -> List[UserLearningSession]:
        """Get user's learning sessions"""
        query = (
            select(UserLearningSession)
            .options(
                selectinload(UserLearningSession.category),
                selectinload(UserLearningSession.difficulty_level)
            )
            .where(UserLearningSession.user_id == user_id)
            .order_by(desc(UserLearningSession.started_at))
            .offset(offset)
            .limit(limit)
        )

        result = await db.execute(query)
        return result.scalars().all()


class UserLearningGoalCRUD:
    """CRUD operations for learning goals"""

    @staticmethod
    async def create_goal(
            db: AsyncSession,
            user_id: int,
            goal_type: str,
            target_value: int,
            target_date: Optional[datetime] = None,
            category_id: Optional[int] = None,
            difficulty_level_id: Optional[int] = None
    ) -> UserLearningGoal:
        """Create a learning goal"""
        goal = UserLearningGoal(
            user_id=user_id,
            goal_type=goal_type,
            target_value=target_value,
            target_date=target_date,
            category_id=category_id,
            difficulty_level_id=difficulty_level_id
        )
        db.add(goal)
        await db.commit()
        await db.refresh(goal)
        return goal

    @staticmethod
    async def get_user_goals(
            db: AsyncSession,
            user_id: int,
            active_only: bool = True
    ) -> List[UserLearningGoal]:
        """Get user's learning goals"""
        query = (
            select(UserLearningGoal)
            .options(
                selectinload(UserLearningGoal.category),
                selectinload(UserLearningGoal.difficulty_level)
            )
            .where(UserLearningGoal.user_id == user_id)
        )

        if active_only:
            query = query.where(UserLearningGoal.is_active == True)

        query = query.order_by(UserLearningGoal.created_at.desc())

        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def update_goal_progress(
            db: AsyncSession,
            goal_id: int,
            progress_increment: int = 1
    ) -> Optional[UserLearningGoal]:
        """Update goal progress"""
        # Get current goal
        result = await db.execute(
            select(UserLearningGoal).where(UserLearningGoal.id == goal_id)
        )
        goal = result.scalar_one_or_none()

        if not goal:
            return None

        new_value = goal.current_value + progress_increment
        update_data = {
            "current_value": new_value,
            "updated_at": datetime.utcnow()
        }

        # Check if goal is completed
        if new_value >= goal.target_value and not goal.is_completed:
            update_data.update({
                "is_completed": True,
                "completed_date": datetime.utcnow()
            })

        stmt = (
            update(UserLearningGoal)
            .where(UserLearningGoal.id == goal_id)
            .values(**update_data)
            .returning(UserLearningGoal)
        )

        result = await db.execute(stmt)
        await db.commit()
        return result.scalar_one_or_none()


class UserStreakCRUD:
    """CRUD operations for user streaks"""

    @staticmethod
    async def update_streak(
            db: AsyncSession,
            user_id: int,
            streak_type: str = "daily"
    ) -> UserStreak:
        """Update user's streak"""
        # Get or create streak
        result = await db.execute(
            select(UserStreak).where(
                and_(
                    UserStreak.user_id == user_id,
                    UserStreak.streak_type == streak_type
                )
            )
        )
        streak = result.scalar_one_or_none()

        today = datetime.utcnow().date()

        if not streak:
            # Create new streak
            streak = UserStreak(
                user_id=user_id,
                streak_type=streak_type,
                current_streak=1,
                longest_streak=1,
                last_activity_date=datetime.utcnow(),
                streak_start_date=datetime.utcnow()
            )
            db.add(streak)
        else:
            last_activity = streak.last_activity_date.date() if streak.last_activity_date else None

            if last_activity == today:
                # Already updated today
                return streak
            elif last_activity == today - timedelta(days=1):
                # Continue streak
                streak.current_streak += 1
                streak.longest_streak = max(streak.longest_streak, streak.current_streak)
                streak.last_activity_date = datetime.utcnow()
            else:
                # Reset streak
                streak.current_streak = 1
                streak.last_activity_date = datetime.utcnow()
                streak.streak_start_date = datetime.utcnow()

            streak.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(streak)
        return streak

    @staticmethod
    async def get_user_streak(
            db: AsyncSession,
            user_id: int,
            streak_type: str = "daily"
    ) -> Optional[UserStreak]:
        """Get user's streak"""
        result = await db.execute(
            select(UserStreak).where(
                and_(
                    UserStreak.user_id == user_id,
                    UserStreak.streak_type == streak_type
                )
            )
        )
        return result.scalar_one_or_none()


class UserLearningStatsCRUD:
    """CRUD operations for learning statistics"""

    @staticmethod
    async def get_user_learning_stats(
            db: AsyncSession,
            user_id: int
    ) -> Dict[str, Any]:
        """Get comprehensive learning statistics for user"""

        # Total words in learning
        total_result = await db.execute(
            select(func.count(UserWordProgress.id))
            .where(UserWordProgress.user_id == user_id)
        )
        total_words = total_result.scalar() or 0

        # Words by status
        status_result = await db.execute(
            select(
                UserWordProgress.status,
                func.count(UserWordProgress.id)
            )
            .where(UserWordProgress.user_id == user_id)
            .group_by(UserWordProgress.status)
        )
        status_counts = {status.value: 0 for status in LearningStatus}
        for status, count in status_result:
            status_counts[status.value] = count

        # Learning sessions this week
        week_ago = datetime.utcnow() - timedelta(days=7)
        sessions_result = await db.execute(
            select(func.count(UserLearningSession.id))
            .where(
                and_(
                    UserLearningSession.user_id == user_id,
                    UserLearningSession.started_at >= week_ago
                )
            )
        )
        sessions_this_week = sessions_result.scalar() or 0

        # Accuracy rate
        accuracy_result = await db.execute(
            select(
                func.sum(UserWordProgress.times_correct).label('total_correct'),
                func.sum(UserWordProgress.times_seen).label('total_seen')
            )
            .where(UserWordProgress.user_id == user_id)
        )
        accuracy_data = accuracy_result.first()
        accuracy_rate = 0
        if accuracy_data.total_seen and accuracy_data.total_seen > 0:
            accuracy_rate = (accuracy_data.total_correct / accuracy_data.total_seen) * 100

        # Current streak - ADD THE MISSING PARAMETER
        streak = await UserStreakCRUD.get_user_streak(db, user_id, "daily")  # Added "daily" parameter
        current_streak = streak.current_streak if streak else 0

        # Words due for review
        review_result = await db.execute(
            select(func.count(UserWordProgress.id))
            .where(
                and_(
                    UserWordProgress.user_id == user_id,
                    UserWordProgress.next_review_at <= datetime.utcnow(),
                    UserWordProgress.status.in_([
                        LearningStatus.REVIEW
                    ])
                )
            )
        )
        words_due_review = review_result.scalar() or 0

        return {
            "total_words": total_words,
            "words_by_status": status_counts,
            "sessions_this_week": sessions_this_week,
            "accuracy_rate": round(accuracy_rate, 1),
            "current_streak": current_streak,
            "words_due_review": words_due_review,
            "total_correct": accuracy_data.total_correct or 0,
            "total_seen": accuracy_data.total_seen or 0
        }

    @staticmethod
    async def get_category_progress(
            db: AsyncSession,
            user_id: int
    ) -> List[Dict[str, Any]]:
        """Get learning progress by category"""
        result = await db.execute(
            select(
                Category.id,
                Category.category_name,
                func.count(UserWordProgress.id).label('words_learning'),
                func.sum(
                    case(
                        (UserWordProgress.status == LearningStatus.LEARNED, 1),
                        (UserWordProgress.status == LearningStatus.MASTERED, 1),
                        else_=0
                    )
                ).label('words_learned')
            )
            .select_from(UserWordProgress)
            .join(KazakhWord, UserWordProgress.kazakh_word_id == KazakhWord.id)
            .join(Category, KazakhWord.category_id == Category.id)
            .where(UserWordProgress.user_id == user_id)
            .group_by(Category.id, Category.category_name)
        )

        return [
            {
                "category_id": row.id,
                "category_name": row.category_name,
                "words_learning": row.words_learning,
                "words_learned": row.words_learned or 0,
                "completion_rate": round(
                    (row.words_learned or 0) / row.words_learning * 100, 1
                ) if row.words_learning > 0 else 0
            }
            for row in result
        ]
    
@staticmethod
async def get_not_learned_words(
    db: AsyncSession,
    user_id: int,
    category_id: Optional[int] = None,
    difficulty_level_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0
) -> List[UserWordProgress]:
    """
    Get user's words that are NOT learned (excludes LEARNED and MASTERED statuses)
    Specifically for learning module to ensure no learned words appear
    """
    # ✅ ЯВНО ИСКЛЮЧАЕМ ИЗУЧЕННЫЕ СТАТУСЫ
    excluded_statuses = [LearningStatus.LEARNED, LearningStatus.MASTERED]
    allowed_statuses = [
        LearningStatus.WANT_TO_LEARN,
        LearningStatus.LEARNING,
        LearningStatus.REVIEW
    ]
    
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
            # ✅ ДОБАВЛЯЕМ ЗАГРУЗКУ ИЗОБРАЖЕНИЙ
            selectinload(UserWordProgress.kazakh_word)
            .selectinload(KazakhWord.images)
        )
        .where(
            and_(
                UserWordProgress.user_id == user_id,
                # ✅ ДВОЙНАЯ ПРОВЕРКА: включаем только разрешенные статусы
                UserWordProgress.status.in_(allowed_statuses),
                # ✅ И ИСКЛЮЧАЕМ ИЗУЧЕННЫЕ СТАТУСЫ
                ~UserWordProgress.status.in_(excluded_statuses)
            )
        )
    )

    if category_id:
        query = query.join(KazakhWord).where(KazakhWord.category_id == category_id)

    if difficulty_level_id:
        query = query.join(KazakhWord).where(KazakhWord.difficulty_level_id == difficulty_level_id)

    # Приоритет: want_to_learn -> learning -> review
    status_priority = {
        LearningStatus.WANT_TO_LEARN: 1,
        LearningStatus.LEARNING: 2, 
        LearningStatus.REVIEW: 3
    }
    
    query = query.order_by(
        func.case(
            *[(UserWordProgress.status == status, priority) 
              for status, priority in status_priority.items()],
            else_=4
        ),
        UserWordProgress.updated_at.desc()
    ).offset(offset).limit(limit)

    result = await db.execute(query)
    words = result.scalars().all()
    
    # ✅ ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА В КОДЕ
    filtered_words = []
    for word in words:
        if word.status not in excluded_statuses:
            filtered_words.append(word)
        else:
            print(f"⚠️ WARNING: Filtered out learned word {word.kazakh_word.kazakh_word} with status {word.status}")
    
    return filtered_words

@staticmethod 
async def count_words_by_status_excluding_learned(
    db: AsyncSession,
    user_id: int,
    category_id: Optional[int] = None,
    difficulty_level_id: Optional[int] = None
) -> Dict[str, int]:
    """
    Count words by status, excluding LEARNED and MASTERED
    Useful for learning module statistics
    """
    # Base query
    query = select(
        UserWordProgress.status,
        func.count(UserWordProgress.id).label('count')
    ).where(
        and_(
            UserWordProgress.user_id == user_id,
            # ✅ ИСКЛЮЧАЕМ ИЗУЧЕННЫЕ СЛОВА ИЗ ПОДСЧЕТА
            ~UserWordProgress.status.in_([LearningStatus.LEARNED, LearningStatus.MASTERED])
        )
    )
    
    if category_id:
        query = query.join(KazakhWord).where(KazakhWord.category_id == category_id)

    if difficulty_level_id:
        query = query.join(KazakhWord).where(KazakhWord.difficulty_level_id == difficulty_level_id)
    
    query = query.group_by(UserWordProgress.status)
    
    result = await db.execute(query)
    status_counts = {row.status.value: row.count for row in result}
    
    # Ensure all statuses are present with 0 if not found
    all_statuses = ['want_to_learn', 'learning', 'review']
    for status in all_statuses:
        if status not in status_counts:
            status_counts[status] = 0
    
    status_counts['total'] = sum(status_counts.values())
    
    return status_counts

@staticmethod
async def get_learned_words_for_practice(
    db: AsyncSession,
    user_id: int,
    category_id: Optional[int] = None,
    difficulty_level_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0
) -> List[UserWordProgress]:
    """Get only learned words for practice sessions"""
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
                UserWordProgress.user_id == user_id,
                UserWordProgress.status == LearningStatus.LEARNED  # Only learned words
            )
        )
    )
    
    # Apply filters
    if category_id:
        query = query.join(KazakhWord).where(KazakhWord.category_id == category_id)
    
    if difficulty_level_id:
        query = query.join(KazakhWord).where(KazakhWord.difficulty_level_id == difficulty_level_id)
    
    # Add ordering and pagination
    query = query.order_by(UserWordProgress.last_practiced_at.asc()).offset(offset).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()

@staticmethod
async def get_user_word_progress(
    db: AsyncSession,
    user_id: int,
    word_id: int
) -> Optional[UserWordProgress]:
    """Get specific word progress for a user"""
    stmt = (
        select(UserWordProgress)
        .where(
            and_(
                UserWordProgress.user_id == user_id,
                UserWordProgress.kazakh_word_id == word_id
            )
        )
    )
    
    result = await db.execute(stmt)
    return result.scalar_one_or_none()

@staticmethod
async def update_word_progress(
    db: AsyncSession,
    user_id: int,
    word_id: int,
    status: Optional[LearningStatus] = None,
    next_review_at: Optional[datetime] = None,
    repetition_interval: Optional[int] = None,
    updated_at: Optional[datetime] = None,
    **kwargs
) -> Optional[UserWordProgress]:
    """Update word progress with any fields"""
    
    # Build update dictionary
    update_data = {}
    if status is not None:
        update_data["status"] = status
    if next_review_at is not None:
        update_data["next_review_at"] = next_review_at
    if repetition_interval is not None:
        update_data["repetition_interval"] = repetition_interval
    if updated_at is not None:
        update_data["updated_at"] = updated_at
    
    # Add any additional kwargs
    update_data.update(kwargs)
    
    if not update_data:
        return None
    
    stmt = (
        update(UserWordProgress)
        .where(
            and_(
                UserWordProgress.user_id == user_id,
                UserWordProgress.kazakh_word_id == word_id
            )
        )
        .values(**update_data)
        .returning(UserWordProgress)
    )
    
    result = await db.execute(stmt)
    await db.commit()
    return result.scalar_one_or_none()


@staticmethod
async def get_session_by_id(
        db: AsyncSession,
        session_id: int,
        user_id: Optional[int] = None
) -> Optional[UserLearningSession]:
    """Get a learning session by ID, optionally filtered by user"""
    query = select(UserLearningSession).where(UserLearningSession.id == session_id)

    if user_id:
        query = query.where(UserLearningSession.user_id == user_id)

    result = await db.execute(query)
    return result.scalar_one_or_none()


# Alternative method name for backward compatibility
@staticmethod
async def get_session(
        db: AsyncSession,
        session_id: int,
        user_id: Optional[int] = None
) -> Optional[UserLearningSession]:
    """Get a learning session by ID - alias for get_session_by_id"""
    return await UserLearningSessionCRUD.get_session_by_id(db, session_id, user_id)