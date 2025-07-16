from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from typing import List, Optional
from datetime import datetime, date, timedelta

from sqlalchemy.orm import selectinload

from .learning_models import (
    UserWordProgress, LearningStatus, UserLearningSession, UserSessionDetail
)
from .models import KazakhWord, Translation, Language


class UserWordProgressCRUD:
    """Extended CRUD operations for learning module"""
    
    @staticmethod
    async def get_words_by_statuses(
        db: AsyncSession,
        user_id: int,
        statuses: List[LearningStatus],
        category_id: Optional[int] = None,
        difficulty_level_id: Optional[int] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[UserWordProgress]:
        """Get user's words by multiple statuses"""
        query = (
            select(UserWordProgress)
            .options(
                selectinload(UserWordProgress.kazakh_word)
                .selectinload(KazakhWord.translations)
                .selectinload(Translation.language),
                selectinload(UserWordProgress.kazakh_word)
                .selectinload(KazakhWord.category),
                selectinload(UserWordProgress.kazakh_word)
                .selectinload(KazakhWord.difficulty_level)
            )
            .where(
                and_(
                    UserWordProgress.user_id == user_id,
                    UserWordProgress.status.in_(statuses)
                )
            )
        )

        if category_id:
            query = query.join(KazakhWord).where(KazakhWord.category_id == category_id)

        if difficulty_level_id:
            query = query.join(KazakhWord).where(KazakhWord.difficulty_level_id == difficulty_level_id)

        # Order by priority: want_to_learn first, then learning, then review
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
        return result.scalars().all()

    @staticmethod
    async def count_words_learned_today(
        db: AsyncSession,
        user_id: int,
        target_date: date
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

    @staticmethod
    async def get_learning_streak(
        db: AsyncSession,
        user_id: int
    ) -> dict:
        """Calculate user's learning streak"""
        # Get learning days in the last 30 days
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        result = await db.execute(
            select(
                func.date(UserWordProgress.first_learned_at).label('learning_date'),
                func.count(UserWordProgress.id).label('words_learned')
            )
            .where(
                and_(
                    UserWordProgress.user_id == user_id,
                    UserWordProgress.status.in_([LearningStatus.LEARNED, LearningStatus.MASTERED]),
                    UserWordProgress.first_learned_at >= thirty_days_ago
                )
            )
            .group_by(func.date(UserWordProgress.first_learned_at))
            .order_by(desc(func.date(UserWordProgress.first_learned_at)))
        )
        
        learning_days = result.fetchall()
        
        # Calculate current streak
        current_streak = 0
        today = datetime.utcnow().date()
        
        for i, (learning_date, words_count) in enumerate(learning_days):
            expected_date = today - timedelta(days=i)
            if learning_date == expected_date:
                current_streak += 1
            else:
                break
        
        return {
            "current_streak": current_streak,
            "total_learning_days": len(learning_days),
            "total_words_learned": sum(words for _, words in learning_days)
        }

    @staticmethod
    async def get_batch_recommendations(
        db: AsyncSession,
        user_id: int,
        batch_size: int = 3,
        max_batches: int = 5
    ) -> List[dict]:
        """Get recommended word batches for learning"""
        # Priority order: WANT_TO_LEARN -> LEARNING -> REVIEW
        statuses_priority = [
            LearningStatus.WANT_TO_LEARN,
            LearningStatus.LEARNING,
            LearningStatus.REVIEW
        ]
        
        all_words = []
        
        for status in statuses_priority:
            if len(all_words) >= batch_size * max_batches:
                break
                
            words = await UserWordProgressCRUD.get_user_learning_words(
                db, user_id, status=status, limit=batch_size * max_batches
            )
            
            for word_progress in words:
                if len(all_words) >= batch_size * max_batches:
                    break
                all_words.append(word_progress)
        
        # Group into batches
        batches = []
        for i in range(0, len(all_words), batch_size):
            batch_words = all_words[i:i + batch_size]
            if len(batch_words) == batch_size:  # Only complete batches
                batches.append({
                    "batch_number": len(batches) + 1,
                    "words": batch_words,
                    "difficulty_avg": sum(
                        w.kazakh_word.difficulty_level.level_number if w.kazakh_word.difficulty_level else 1
                        for w in batch_words
                    ) / len(batch_words),
                    "status_mix": {
                        status.value: sum(1 for w in batch_words if w.status == status)
                        for status in statuses_priority
                    }
                })
        
        return batches


class UserLearningSessionCRUD:
    """Extended CRUD for learning sessions"""
    
    @staticmethod
    async def count_sessions_today(
        db: AsyncSession,
        user_id: int,
        target_date: date
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
    async def get_session_analytics(
        db: AsyncSession,
        user_id: int,
        days: int = 7
    ) -> dict:
        """Get learning session analytics for the last N days"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        result = await db.execute(
            select(
                UserLearningSession.session_type,
                func.count(UserLearningSession.id).label('session_count'),
                func.avg(UserLearningSession.correct_answers).label('avg_correct'),
                func.avg(UserLearningSession.total_questions).label('avg_total'),
                func.avg(UserLearningSession.duration_seconds).label('avg_duration')
            )
            .where(
                and_(
                    UserLearningSession.user_id == user_id,
                    UserLearningSession.started_at >= cutoff_date,
                    UserLearningSession.finished_at.isnot(None)
                )
            )
            .group_by(UserLearningSession.session_type)
        )
        
        analytics = {}
        for session_type, count, avg_correct, avg_total, avg_duration in result:
            accuracy = (avg_correct / avg_total * 100) if avg_total and avg_total > 0 else 0
            analytics[session_type] = {
                "session_count": count,
                "average_accuracy": round(accuracy, 1),
                "average_duration_seconds": int(avg_duration) if avg_duration else 0,
                "total_questions": int(avg_total * count) if avg_total and count else 0
            }
        
        return analytics

    @staticmethod
    async def create_batch_session(
        db: AsyncSession,
        user_id: int,
        session_type: str,
        word_ids: List[int],
        category_id: Optional[int] = None,
        difficulty_level_id: Optional[int] = None
    ) -> UserLearningSession:
        """Create a learning session specifically for a word batch"""
        session = UserLearningSession(
            user_id=user_id,
            session_type=session_type,
            word_source="learning_list",
            total_questions=len(word_ids),
            learning_words_count=len(word_ids),
            random_words_count=0,
            category_id=category_id,
            difficulty_level_id=difficulty_level_id
        )
        
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session

    @staticmethod
    async def finish_batch_session(
        db: AsyncSession,
        session_id: int,
        results: List[dict],  # [{"word_id": int, "was_correct": bool, "response_time": int}]
        duration_seconds: Optional[int] = None
    ) -> UserLearningSession:
        """Finish a batch session with detailed results"""
        session = await UserLearningSessionCRUD.get_session_by_id(db, session_id)
        if not session:
            return None
        
        # Calculate session statistics
        total_correct = sum(1 for r in results if r.get("was_correct", False))
        total_questions = len(results)
        accuracy = (total_correct / total_questions * 100) if total_questions > 0 else 0
        
        # Update session
        session.finished_at = datetime.utcnow()
        session.correct_answers = total_correct
        session.incorrect_answers = total_questions - total_correct
        session.total_questions = total_questions
        session.duration_seconds = duration_seconds
        
        # Add session details
        for result in results:
            detail = UserSessionDetail(
                session_id=session.id,
                kazakh_word_id=result["word_id"],
                was_correct=result.get("was_correct", False),
                user_answer=result.get("user_answer"),
                correct_answer=result.get("correct_answer"),
                response_time_ms=result.get("response_time"),
                question_type=session.session_type,
                question_language="kk",  # Kazakh
                answer_language="en"    # English (or user's preferred language)
            )
            db.add(detail)
        
        await db.commit()
        await db.refresh(session)
        return session


class LearningModuleAnalytics:
    """Analytics specific to the learning module workflow"""
    
    @staticmethod
    async def get_batch_completion_stats(
        db: AsyncSession,
        user_id: int,
        days: int = 30
    ) -> dict:
        """Get statistics about batch completion patterns"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Get all batch sessions (practice_batch and quiz_batch)
        result = await db.execute(
            select(
                func.date(UserLearningSession.started_at).label('session_date'),
                UserLearningSession.session_type,
                func.count(UserLearningSession.id).label('session_count'),
                func.avg(UserLearningSession.correct_answers).label('avg_correct')
            )
            .where(
                and_(
                    UserLearningSession.user_id == user_id,
                    UserLearningSession.session_type.in_(['practice_batch', 'quiz_batch']),
                    UserLearningSession.started_at >= cutoff_date,
                    UserLearningSession.finished_at.isnot(None)
                )
            )
            .group_by(
                func.date(UserLearningSession.started_at),
                UserLearningSession.session_type
            )
            .order_by(desc(func.date(UserLearningSession.started_at)))
        )
        
        daily_stats = {}
        for session_date, session_type, count, avg_correct in result:
            date_str = session_date.strftime('%Y-%m-%d')
            if date_str not in daily_stats:
                daily_stats[date_str] = {
                    'practice_batches': 0,
                    'quiz_batches': 0,
                    'practice_accuracy': 0,
                    'quiz_accuracy': 0,
                    'total_batches': 0
                }
            
            if session_type == 'practice_batch':
                daily_stats[date_str]['practice_batches'] = count
                daily_stats[date_str]['practice_accuracy'] = round((avg_correct / 3) * 100, 1) if avg_correct else 0
            elif session_type == 'quiz_batch':
                daily_stats[date_str]['quiz_batches'] = count  
                daily_stats[date_str]['quiz_accuracy'] = round((avg_correct / 3) * 100, 1) if avg_correct else 0
            
            daily_stats[date_str]['total_batches'] = (
                daily_stats[date_str]['practice_batches'] + 
                daily_stats[date_str]['quiz_batches']
            )
        
        return {
            "daily_stats": daily_stats,
            "total_days_active": len(daily_stats),
            "average_batches_per_day": sum(d['total_batches'] for d in daily_stats.values()) / len(daily_stats) if daily_stats else 0
        }

    @staticmethod
    async def get_word_learning_efficiency(
        db: AsyncSession,
        user_id: int,
        word_ids: Optional[List[int]] = None
    ) -> dict:
        """Analyze how efficiently words are being learned"""
        query = select(
            UserWordProgress.kazakh_word_id,
            UserWordProgress.status,
            UserWordProgress.times_seen,
            UserWordProgress.times_correct,
            UserWordProgress.added_at,
            UserWordProgress.first_learned_at,
            KazakhWord.kazakh_word,
            KazakhWord.difficulty_level_id
        ).join(KazakhWord).where(UserWordProgress.user_id == user_id)
        
        if word_ids:
            query = query.where(UserWordProgress.kazakh_word_id.in_(word_ids))
        
        result = await db.execute(query)
        words_data = result.fetchall()
        
        efficiency_stats = {
            "total_words": len(words_data),
            "learned_words": 0,
            "average_attempts_to_learn": 0,
            "average_days_to_learn": 0,
            "by_difficulty": {},
            "learning_rate": 0
        }
        
        learned_words = []
        total_attempts = 0
        total_days = 0
        
        for word_data in words_data:
            (word_id, status, times_seen, times_correct, added_at, 
             first_learned_at, kazakh_word, difficulty_level_id) = word_data
            
            if status in [LearningStatus.LEARNED, LearningStatus.MASTERED]:
                efficiency_stats["learned_words"] += 1
                learned_words.append({
                    "word_id": word_id,
                    "kazakh_word": kazakh_word,
                    "attempts": times_seen,
                    "accuracy": (times_correct / times_seen * 100) if times_seen > 0 else 0,
                    "days_to_learn": (first_learned_at - added_at).days if first_learned_at and added_at else 0
                })
                
                total_attempts += times_seen
                if first_learned_at and added_at:
                    total_days += (first_learned_at - added_at).days
            
            # Group by difficulty
            difficulty_key = f"level_{difficulty_level_id or 1}"
            if difficulty_key not in efficiency_stats["by_difficulty"]:
                efficiency_stats["by_difficulty"][difficulty_key] = {
                    "total_words": 0,
                    "learned_words": 0,
                    "average_attempts": 0
                }
            
            efficiency_stats["by_difficulty"][difficulty_key]["total_words"] += 1
            if status in [LearningStatus.LEARNED, LearningStatus.MASTERED]:
                efficiency_stats["by_difficulty"][difficulty_key]["learned_words"] += 1
        
        # Calculate averages
        if learned_words:
            efficiency_stats["average_attempts_to_learn"] = round(total_attempts / len(learned_words), 1)
            efficiency_stats["average_days_to_learn"] = round(total_days / len(learned_words), 1)
            efficiency_stats["learning_rate"] = round((len(learned_words) / len(words_data)) * 100, 1)
        
        # Calculate difficulty-specific averages
        for difficulty_stats in efficiency_stats["by_difficulty"].values():
            if difficulty_stats["learned_words"] > 0:
                difficulty_stats["learning_rate"] = round(
                    (difficulty_stats["learned_words"] / difficulty_stats["total_words"]) * 100, 1
                )
        
        efficiency_stats["most_efficient_words"] = sorted(
            learned_words, 
            key=lambda x: x["attempts"]
        )[:5]
        
        efficiency_stats["fastest_learned_words"] = sorted(
            learned_words,
            key=lambda x: x["days_to_learn"]
        )[:5]
        
        return efficiency_stats

    @staticmethod
    async def get_learning_recommendations(
        db: AsyncSession,
        user_id: int
    ) -> dict:
        """Get personalized learning recommendations based on user's performance"""
        # Get recent performance data
        recent_sessions = await db.execute(
            select(UserLearningSession)
            .where(
                and_(
                    UserLearningSession.user_id == user_id,
                    UserLearningSession.started_at >= datetime.utcnow() - timedelta(days=7),
                    UserLearningSession.finished_at.isnot(None)
                )
            )
            .order_by(desc(UserLearningSession.started_at))
            .limit(10)
        )
        
        sessions = recent_sessions.scalars().all()
        
        if not sessions:
            return {
                "recommendation_type": "start_learning",
                "message": "Start your learning journey with some basic words!",
                "suggested_batch_size": 3,
                "focus_areas": ["basic_vocabulary"]
            }
        
        # Analyze performance
        total_accuracy = sum(
            (s.correct_answers / s.total_questions * 100) if s.total_questions > 0 else 0 
            for s in sessions
        ) / len(sessions)
        
        avg_session_time = sum(
            s.duration_seconds for s in sessions if s.duration_seconds
        ) / len([s for s in sessions if s.duration_seconds]) if any(s.duration_seconds for s in sessions) else 0
        
        recommendations = {
            "overall_accuracy": round(total_accuracy, 1),
            "average_session_time": int(avg_session_time),
            "recommendations": []
        }
        
        # Generate specific recommendations
        if total_accuracy < 60:
            recommendations["recommendations"].append({
                "type": "reduce_difficulty",
                "message": "Consider focusing on easier words to build confidence",
                "action": "Practice more level 1-2 words"
            })
        elif total_accuracy > 85:
            recommendations["recommendations"].append({
                "type": "increase_difficulty", 
                "message": "You're doing great! Try some harder words",
                "action": "Add level 3-4 words to your practice"
            })
        
        if avg_session_time > 600:  # More than 10 minutes
            recommendations["recommendations"].append({
                "type": "shorter_sessions",
                "message": "Consider shorter, more frequent sessions",
                "action": "Try 5-minute daily sessions instead"
            })
        
        # Check learning consistency
        session_dates = set(s.started_at.date() for s in sessions)
        if len(session_dates) < 3:  # Less than 3 different days in the last week
            recommendations["recommendations"].append({
                "type": "consistency",
                "message": "Try to practice a little bit every day",
                "action": "Set a daily reminder for 5-minute practice"
            })
        
        return recommendations


# Add these methods to the existing UserWordProgressCRUD class
class KazakhWordCRUD:
    """Extended CRUD for getting words for learning module"""
    
    @staticmethod
    async def get_random_words_for_learning(
        db: AsyncSession,
        count: int,
        difficulty_level_id: Optional[int] = None,
        category_id: Optional[int] = None,
        language_code: str = "en",
        exclude_word_ids: List[int] = None,
        user_id: Optional[int] = None
    ) -> List[KazakhWord]:
        """Get random words that are not already in user's learning list"""
        
        # Base query for random words
        query = select(KazakhWord).options(
            selectinload(KazakhWord.translations).selectinload(Translation.language),
            selectinload(KazakhWord.category),
            selectinload(KazakhWord.difficulty_level)
        )
        
        # Apply filters
        if difficulty_level_id:
            query = query.where(KazakhWord.difficulty_level_id == difficulty_level_id)
        
        if category_id:
            query = query.where(KazakhWord.category_id == category_id)
        
        if exclude_word_ids:
            query = query.where(~KazakhWord.id.in_(exclude_word_ids))
        
        # Exclude words already in user's learning list
        if user_id:
            subquery = select(UserWordProgress.kazakh_word_id).where(
                UserWordProgress.user_id == user_id
            )
            query = query.where(~KazakhWord.id.in_(subquery))
        
        # Ensure words have translations in the requested language
        query = query.join(Translation).join(Language).where(
            Language.language_code == language_code
        )
        
        # Random order and limit
        query = query.order_by(func.random()).limit(count * 2)  # Get more than needed
        
        result = await db.execute(query)
        words = result.scalars().all()
        
        # Filter to ensure each word has the required translation
        filtered_words = []
        for word in words:
            if len(filtered_words) >= count:
                break
                
            has_translation = any(
                t.language.language_code == language_code 
                for t in word.translations 
                if t.language
            )
            
            if has_translation:
                filtered_words.append(word)
        
        return filtered_words