from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, update, and_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from sqlalchemy.orm import selectinload

from database import KazakhWord, Translation, Language
from database.connection import get_db
from database.auth_models import User
from auth.dependencies import get_current_user
from database.learning_models import LearningStatus, UserWordProgress
from database.learning_schemas import (
    PracticeSessionRequest, PracticeSessionResponse, 
    UserWordProgressUpdate, LearningStatusEnum
)
from database.learning_crud import UserWordProgressCRUD, UserLearningSessionCRUD
from database.crud import KazakhWordCRUD

router = APIRouter(prefix="/learning-module", tags=["Learning Module"])


# ===== HELPER FUNCTIONS =====

def calculate_spaced_repetition(progress, was_correct: bool) -> Dict[str, Any]:
    """Calculate next review date using spaced repetition algorithm"""
    if was_correct:
        # Increase interval
        new_interval = max(1, int(progress.repetition_interval * progress.ease_factor))
        new_ease = min(2.8, progress.ease_factor + 0.1)
    else:
        # Reset interval, decrease ease
        new_interval = 1
        new_ease = max(1.3, progress.ease_factor - 0.2)

    next_review = datetime.utcnow() + timedelta(days=new_interval)

    return {
        "repetition_interval": new_interval,
        "ease_factor": new_ease,
        "next_review_at": next_review
    }


# ===== LEARNING MODULE SPECIFIC ENDPOINTS =====

@router.get("/words/not-learned")
async def get_words_not_learned(
    daily_goal: int = Query(10, ge=3, le=50, description="Daily learning goal from user settings"),
    category_id: Optional[int] = Query(None),
    difficulty_level_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get words that are not yet learned (status: want_to_learn, learning, review)
    Returns enough words for the daily goal, grouped by batches of 3
    """
    try:
        # Get words with non-learned statuses
        not_learned_statuses = [
            LearningStatus.WANT_TO_LEARN,
            LearningStatus.LEARNING, 
            LearningStatus.REVIEW
        ]
        
        all_words = []
        
        # Get words from each status
        for status in not_learned_statuses:
            if len(all_words) >= daily_goal:
                break
                
            words = await UserWordProgressCRUD.get_user_learning_words(
                db, 
                current_user.id, 
                status=status,
                category_id=category_id,
                difficulty_level_id=difficulty_level_id,
                limit=daily_goal,
                offset=0
            )
            
            # Convert to dict format for frontend
            for word_progress in words:
                word = word_progress.kazakh_word
                
                # Get primary translation for user's language
                primary_translation = "No translation"
                if word.translations:
                    for translation in word.translations:
                        if (hasattr(translation, 'language') and 
                            translation.language and 
                            translation.language.language_code == current_user.main_language.language_code):
                            primary_translation = translation.translation
                            break
                
                all_words.append({
                    "id": word.id,
                    "kazakh_word": word.kazakh_word,
                    "kazakh_cyrillic": word.kazakh_cyrillic,
                    "translation": primary_translation,
                    "pronunciation": getattr(word, 'pronunciation', None),
                    "image_url": getattr(word, 'image_url', None),
                    "status": word_progress.status.value,
                    "times_seen": word_progress.times_seen,
                    "times_correct": word_progress.times_correct,
                    "difficulty_level": word.difficulty_level.level_number if word.difficulty_level else 1,
                    "category_name": word.category.category_name if word.category else "Unknown"
                })
                
                if len(all_words) >= daily_goal:
                    break
        
        # Group into batches of 3
        batches = []
        for i in range(0, len(all_words), 3):
            batch_words = all_words[i:i+3]
            if len(batch_words) == 3:  # Only add complete batches
                batches.append({
                    "batch_number": len(batches) + 1,
                    "words": batch_words
                })
        
        return {
            "batches": batches,
            "total_words": len(all_words),
            "words_per_batch": 3,
            "total_batches": len(batches),
            "daily_goal": daily_goal,
            "goal_met": len(all_words) >= daily_goal
        }
        
    except Exception as e:
        print(f"Error in get_words_not_learned: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get learning words: {str(e)}"
        )


@router.post("/batch/start-practice")
async def start_batch_practice(
    word_ids: List[int],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Start a practice session for a batch of words"""
    try:
        if len(word_ids) != 3:
            raise HTTPException(
                status_code=400,
                detail="Batch must contain exactly 3 words"
            )
        
        # Create practice session
        session = await UserLearningSessionCRUD.create_session(
            db, 
            current_user.id, 
            "practice_batch"
        )
        
        # Get words with translations
        words = []
        for word_id in word_ids:
            word = await KazakhWordCRUD.get_by_id_full(db, word_id, current_user.main_language.language_code)
            if word:
                primary_translation = word.translations[0].translation if word.translations else "No translation"
                words.append({
                    "id": word.id,
                    "kazakh_word": word.kazakh_word,
                    "kazakh_cyrillic": word.kazakh_cyrillic,
                    "translation": primary_translation,
                    "image_url": getattr(word, 'image_url', None),
                    "category_name": word.category.category_name if word.category else "Unknown"
                })
        
        return {
            "session_id": session.id,
            "session_type": "practice_batch",
            "words": words,
            "total_words": len(words)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in start_batch_practice: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start practice session: {str(e)}"
        )


@router.post("/batch/start-quiz")
async def start_batch_quiz(
    word_ids: List[int],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Start a quiz session for a batch of words"""
    try:
        if len(word_ids) != 3:
            raise HTTPException(
                status_code=400,
                detail="Batch must contain exactly 3 words"
            )
        
        # Create quiz session
        session = await UserLearningSessionCRUD.create_session(
            db, 
            current_user.id, 
            "quiz_batch"
        )
        
        # Get words and generate quiz questions
        quiz_questions = []
        words = []
        
        for word_id in word_ids:
            word = await KazakhWordCRUD.get_by_id_full(db, word_id, current_user.main_language.language_code)
            if word:
                words.append(word)
        
        # Generate quiz questions
        for word in words:
            correct_translation = word.translations[0].translation if word.translations else "No translation"
            
            # Generate wrong options from other words
            wrong_options = []
            for other_word in words:
                if other_word.id != word.id and other_word.translations:
                    wrong_options.append(other_word.translations[0].translation)
            
            # Add more generic wrong options if needed
            while len(wrong_options) < 3:
                generic_options = ["water", "house", "tree", "book", "person", "mountain", "river", "food"]
                for option in generic_options:
                    if option not in wrong_options and option != correct_translation:
                        wrong_options.append(option)
                        break
                if len(wrong_options) >= 3:
                    break
            
            # Create all options and shuffle
            all_options = [correct_translation] + wrong_options[:3]
            import random
            random.shuffle(all_options)
            correct_index = all_options.index(correct_translation)
            
            quiz_questions.append({
                "id": word.id,
                "question": f"What does \"{word.kazakh_word}\" mean?",
                "kazakh_word": word.kazakh_word,
                "kazakh_cyrillic": word.kazakh_cyrillic,
                "options": all_options,
                "correct_answer_index": correct_index,
                "correct_answer": correct_translation
            })
        
        return {
            "session_id": session.id,
            "session_type": "quiz_batch", 
            "questions": quiz_questions,
            "total_questions": len(quiz_questions)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in start_batch_quiz: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start quiz session: {str(e)}"
        )


@router.post("/batch/complete")
async def complete_learning_batch(
    word_ids: List[int],
    practice_results: List[dict],  # [{"word_id": int, "was_correct": bool}]
    quiz_results: List[dict],      # [{"word_id": int, "was_correct": bool}]
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Complete a learning batch and update word statuses
    Words that were correct in BOTH practice and quiz are marked as learned
    """
    try:
        print(f"\n🎯 === BATCH COMPLETION DEBUG START ===")
        print(f"👤 User ID: {current_user.id}")
        print(f"📝 Word IDs: {word_ids}")
        print(f"📚 Practice results: {practice_results}")
        print(f"🧠 Quiz results: {quiz_results}")
        
        if len(word_ids) != 3:
            raise HTTPException(
                status_code=400,
                detail="Batch must contain exactly 3 words"
            )
        
        # Create result maps for easy lookup
        practice_map = {r["word_id"]: r["was_correct"] for r in practice_results}
        quiz_map = {r["word_id"]: r["was_correct"] for r in quiz_results}
        
        print(f"🗺️ Practice map: {practice_map}")
        print(f"🗺️ Quiz map: {quiz_map}")
        
        words_learned = []
        batch_summary = {
            "total_words": len(word_ids),
            "practice_correct": sum(practice_map.values()),
            "quiz_correct": sum(quiz_map.values()),
            "words_learned": [],
            "words_to_review": []
        }
        
        # ✅ ДЕТАЛЬНАЯ ОБРАБОТКА КАЖДОГО СЛОВА
        for i, word_id in enumerate(word_ids):
            print(f"\n--- 📖 PROCESSING WORD {i+1}/3: ID={word_id} ---")
            
            practice_correct = practice_map.get(word_id, False)
            quiz_correct = quiz_map.get(word_id, False)
            
            print(f"✅ Practice result for word {word_id}: {practice_correct}")
            print(f"🧠 Quiz result for word {word_id}: {quiz_correct}")
            print(f"🎯 Both correct: {practice_correct and quiz_correct}")
            
            # Get word details for summary
            word = await KazakhWordCRUD.get_by_id(db, word_id)
            word_name = word.kazakh_word if word else f"Word {word_id}"
            print(f"📚 Word name: {word_name}")
            
            try:
                # Получаем текущий прогресс
                progress = await UserWordProgressCRUD.get_user_word_progress(db, current_user.id, word_id)
                if not progress:
                    print(f"❌ No progress found for word {word_id}")
                    continue
                
                print(f"📊 Current progress:")
                print(f"   - Status: {progress.status}")
                print(f"   - Times seen: {progress.times_seen}")
                print(f"   - Times correct: {progress.times_correct}")
                print(f"   - Times incorrect: {progress.times_incorrect}")
                
                # Подготавливаем обновления
                update_data = {"updated_at": datetime.utcnow()}
                
                # Считаем общее количество правильных ответов (practice + quiz)
                correct_answers = 0
                if practice_correct:
                    correct_answers += 1
                    print(f"   ➕ Adding 1 for practice correct")
                if quiz_correct:
                    correct_answers += 1
                    print(f"   ➕ Adding 1 for quiz correct")
                
                print(f"📈 Total correct answers for this batch: {correct_answers}/2")
                
                # Обновляем статистику
                new_times_seen = progress.times_seen + 2
                new_times_correct = progress.times_correct + correct_answers
                update_data["times_seen"] = new_times_seen
                update_data["times_correct"] = new_times_correct
                update_data["last_practiced_at"] = datetime.utcnow()
                
                print(f"📊 New statistics:")
                print(f"   - Times seen: {progress.times_seen} → {new_times_seen}")
                print(f"   - Times correct: {progress.times_correct} → {new_times_correct}")
                
                # Если неправильные ответы - обновляем и их
                incorrect_answers = 2 - correct_answers  # Из 2 возможных
                if incorrect_answers > 0:
                    new_times_incorrect = progress.times_incorrect + incorrect_answers
                    update_data["times_incorrect"] = new_times_incorrect
                    print(f"   - Times incorrect: {progress.times_incorrect} → {new_times_incorrect}")
                
                # Определяем статус
                if practice_correct and quiz_correct:
                    # Оба правильные - LEARNED
                    update_data["status"] = LearningStatus.LEARNED
                    if not progress.first_learned_at:
                        update_data["first_learned_at"] = datetime.utcnow()
                        print(f"   🎉 Setting first_learned_at")
                    
                    words_learned.append(word_name)
                    batch_summary["words_learned"].append({
                        "word_id": word_id,
                        "kazakh_word": word_name,
                        "new_status": "learned"
                    })
                    print(f"   ✅ STATUS: LEARNED (both practice and quiz correct)")
                else:
                    # Остается в обучении
                    update_data["status"] = LearningStatus.LEARNING
                    batch_summary["words_to_review"].append({
                        "word_id": word_id,
                        "kazakh_word": word_name,
                        "practice_correct": practice_correct,
                        "quiz_correct": quiz_correct
                    })
                    print(f"   📚 STATUS: LEARNING (practice: {practice_correct}, quiz: {quiz_correct})")
                
                # Обновляем spaced repetition
                overall_correct = practice_correct and quiz_correct
                spaced_rep_data = calculate_spaced_repetition(progress, overall_correct)
                update_data.update(spaced_rep_data)
                print(f"   🔄 Spaced repetition updated (overall_correct: {overall_correct})")
                
                print(f"📝 Full update_data for word {word_id}:")
                for key, value in update_data.items():
                    print(f"   - {key}: {value}")
                
                # ✅ ВЫПОЛНЯЕМ ОБНОВЛЕНИЕ (но пока не коммитим)
                stmt = (
                    update(UserWordProgress)
                    .where(
                        and_(
                            UserWordProgress.user_id == current_user.id,
                            UserWordProgress.kazakh_word_id == word_id
                        )
                    )
                    .values(**update_data)
                )
                
                result = await db.execute(stmt)
                affected_rows = result.rowcount
                print(f"   💾 SQL update executed, affected rows: {affected_rows}")
                
                if affected_rows == 0:
                    print(f"   ⚠️ WARNING: No rows affected by update for word {word_id}")
                else:
                    print(f"   ✅ Successfully prepared update for word {word_id}")
                
            except Exception as e:
                print(f"   ❌ Exception while processing word {word_id}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        print(f"\n💾 === COMMITTING ALL CHANGES ===")
        
        # ✅ ОДИН COMMIT ДЛЯ ВСЕХ ИЗМЕНЕНИЙ
        await db.commit()
        print(f"✅ All batch updates committed successfully")
        
        print(f"\n📊 === FINAL SUMMARY ===")
        print(f"Words learned: {len(words_learned)}")
        print(f"Words to review: {len(batch_summary['words_to_review'])}")
        print(f"Batch summary: {batch_summary}")
        
        # ✅ ПРОВЕРИМ РЕЗУЛЬТАТЫ ПОСЛЕ COMMIT
        print(f"\n🔍 === POST-COMMIT VERIFICATION ===")
        for word_id in word_ids:
            progress = await UserWordProgressCRUD.get_user_word_progress(db, current_user.id, word_id)
            if progress:
                print(f"Word {word_id}: status={progress.status}, times_seen={progress.times_seen}, times_correct={progress.times_correct}")
            else:
                print(f"Word {word_id}: NOT FOUND")
        
        print(f"🎯 === BATCH COMPLETION DEBUG END ===\n")
        
        return {
            "success": True,
            "batch_completed": True,
            "summary": batch_summary,
            "message": f"Batch completed! {len(words_learned)} words learned."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in complete_learning_batch: {e}")
        import traceback
        traceback.print_exc()
        # Откатываем изменения в случае ошибки
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to complete learning batch: {str(e)}"
        )


@router.post("/batch/words/set-learning-status")
async def set_words_to_learning_status(
    word_ids: List[int],
    batch_number: Optional[int] = Query(1, description="Current batch number"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Immediately set words to LEARNING status when they are shown to user.
    This happens when user sees the 3 words in Batch 1, not when finishing.
    """
    try:
        if len(word_ids) != 3:
            raise HTTPException(
                status_code=400,
                detail="Batch must contain exactly 3 words"
            )
        
        # Only update status for Batch 1
        if batch_number != 1:
            return {
                "success": True,
                "batch_number": batch_number,
                "message": f"No status update needed for Batch {batch_number}",
                "words_updated": []
            }
        
        words_updated = []
        
        # Process each word
        for word_id in word_ids:
            try:
                # Get current progress
                current_progress = await UserWordProgressCRUD.get_user_word_progress(
                    db, current_user.id, word_id
                )
                
                # Only update if word exists and is currently WANT_TO_LEARN
                if current_progress and current_progress.status == LearningStatus.WANT_TO_LEARN:
                    await UserWordProgressCRUD.update_word_progress(
                        db,
                        current_user.id,
                        word_id,
                        status=LearningStatus.LEARNING
                    )
                    
                    # Get word details for response
                    word = await KazakhWordCRUD.get_by_id(db, word_id)
                    words_updated.append({
                        "word_id": word_id,
                        "kazakh_word": word.kazakh_word if word else f"Word {word_id}",
                        "previous_status": "want_to_learn",
                        "new_status": "learning"
                    })
                    
            except Exception as e:
                print(f"Failed to update word {word_id} status: {e}")
        
        return {
            "success": True,
            "batch_number": batch_number,
            "words_updated": words_updated,
            "message": f"Batch 1: {len(words_updated)} words automatically moved to learning status!"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in set_words_to_learning_status: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update word statuses: {str(e)}"
        )


@router.get("/user/daily-progress")
async def get_daily_progress(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get user's daily learning progress
    """
    try:
        # Get today's learning statistics
        today = datetime.utcnow().date()
        
        # Count words learned today
        words_learned_today = await UserWordProgressCRUD.count_words_learned_today(
            db, current_user.id, today
        )
        
        # Count practice sessions today
        sessions_today = await UserLearningSessionCRUD.count_sessions_today(
            db, current_user.id, today
        )
        
        # Get daily goal (this would come from user settings)
        daily_goal = 10  # Default, should be from user preferences
        if current_user.main_language:
            # Assuming we add daily_goal to user preferences
            daily_goal = getattr(current_user.main_language, 'daily_goal', 10)
        
        progress_percentage = min((words_learned_today / daily_goal) * 100, 100) if daily_goal > 0 else 0
        
        return {
            "daily_goal": daily_goal,
            "words_learned_today": words_learned_today,
            "sessions_completed_today": sessions_today,
            "progress_percentage": round(progress_percentage, 1),
            "goal_reached": words_learned_today >= daily_goal,
            "words_remaining": max(0, daily_goal - words_learned_today)
        }
        
    except Exception as e:
        print(f"Error in get_daily_progress: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get daily progress: {str(e)}"
        )


@router.post("/words/add-random")
async def add_random_words_to_learning(
    count: Optional[int] = Query(None, description="Number of words to add (uses user's daily goal if not specified)"),
    category_id: Optional[int] = Query(None, description="Filter by category"),
    difficulty_level_id: Optional[int] = Query(None, description="Filter by difficulty level"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add exactly the specified number of random words to user's learning list.
    Only adds words that have translations in the user's native language.
    Guarantees exact count or returns error if not enough words available.
    """
    try:
        # Use daily goal if count not specified
        if count is None:
            count = 10  # Default daily goal, should come from user preferences
            
        # Get user's native language code
        user_lang_code = current_user.main_language.language_code if current_user.main_language else "en"
        
        print(f"🎯 Adding {count} random words for user {current_user.id} with language {user_lang_code}")
        
        # Get words user already has in learning list
        existing_progress = await UserWordProgressCRUD.get_user_learning_words(
            db, current_user.id, limit=10000, offset=0
        )
        existing_word_ids = {progress.kazakh_word_id for progress in existing_progress}
        
        print(f"📚 User already has {len(existing_word_ids)} words in learning list")
        
        # Search for available words
        found_words = []
        search_multiplier = 2  # Start with 2x the needed count
        max_attempts = 5
        
        for attempt in range(max_attempts):
            search_limit = count * search_multiplier
            
            print(f"🔍 Search attempt {attempt + 1}: looking for {search_limit} words")
            
            # Build query for available words
            query = (
                select(KazakhWord)
                .options(
                    selectinload(KazakhWord.translations)
                    .selectinload(Translation.language),
                    selectinload(KazakhWord.category),
                    selectinload(KazakhWord.difficulty_level)
                )
                .where(~KazakhWord.id.in_(existing_word_ids))
                .order_by(func.random())
                .limit(search_limit)
            )
            
            # Apply filters
            if category_id:
                query = query.where(KazakhWord.category_id == category_id)
            if difficulty_level_id:
                query = query.where(KazakhWord.difficulty_level_id == difficulty_level_id)
            
            result = await db.execute(query)
            words = result.scalars().all()
            
            print(f"📝 Found {len(words)} candidate words from database")
            
            # Filter words that have translations in user's language
            for word in words:
                # Check if word has translation in user's language
                user_translation = None
                if word.translations:
                    for translation in word.translations:
                        if (hasattr(translation, 'language') and 
                            translation.language and 
                            translation.language.language_code == user_lang_code and
                            translation.translation and 
                            translation.translation.strip()):
                            user_translation = translation.translation
                            break
                
                # Only add if we have a valid translation
                if user_translation:
                    found_words.append({
                        'word': word,
                        'translation': user_translation
                    })
            
            # If we found enough words, break
            if len(found_words) >= count:
                break
            
            # Increase search multiplier for next attempt
            search_multiplier += 2
        
        # Check if we found enough words
        if len(found_words) < count:
            available_count = len(found_words)
            filter_info = []
            if category_id:
                filter_info.append(f"category_id={category_id}")
            if difficulty_level_id:
                filter_info.append(f"difficulty_level_id={difficulty_level_id}")
            
            filter_text = f" with filters ({', '.join(filter_info)})" if filter_info else ""
            
            raise HTTPException(
                status_code=404,
                detail=f"Only {available_count} words available with {user_lang_code.upper()} translations{filter_text}. "
                       f"Requested {count} words. Try removing filters or choosing a different category/difficulty."
            )
        
        # Take exactly the requested count
        selected_words = found_words[:count]
        
        print(f"✅ Selected exactly {len(selected_words)} words")
        
        # Add words to learning list
        added_words = []
        failed_additions = []
        
        for word_data in selected_words:
            word = word_data['word']
            translation = word_data['translation']
            
            try:
                # Add to learning list with WANT_TO_LEARN status
                progress = await UserWordProgressCRUD.add_word_to_learning_list(
                    db, current_user.id, word.id, LearningStatus.WANT_TO_LEARN
                )
                
                added_words.append({
                    "id": word.id,
                    "kazakh_word": word.kazakh_word,
                    "kazakh_cyrillic": word.kazakh_cyrillic,
                    "translation": translation,
                    "category_name": word.category.category_name if word.category else "Unknown",
                    "difficulty_level": word.difficulty_level.level_number if word.difficulty_level else 1,
                    "status": progress.status.value
                })
                
            except Exception as e:
                print(f"❌ Failed to add word {word.id}: {e}")
                failed_additions.append(word.id)
        
        if failed_additions:
            print(f"⚠️ Failed to add {len(failed_additions)} words: {failed_additions}")
        
        if len(added_words) < count:
            raise HTTPException(
                status_code=500,
                detail=f"Successfully added {len(added_words)} out of {count} requested words. "
                       f"Database errors occurred for {len(failed_additions)} words."
            )
        
        # Success response
        return {
            "success": True,
            "words_added": len(added_words),
            "requested_count": count,
            "user_language": user_lang_code.upper(),
            "words": added_words,
            "message": f"Successfully added exactly {len(added_words)} words with {user_lang_code.upper()} translations to your learning list!",
            "filters_applied": {
                "category_id": category_id,
                "difficulty_level_id": difficulty_level_id,
                "language_code": user_lang_code
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in add_random_words_to_learning: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to add random words: {str(e)}"
        )


@router.get("/user/recommendations")
async def get_learning_recommendations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get learning recommendations based on user's progress
    """
    try:
        # This would include analysis of user's learning patterns
        # For now, return basic recommendations
        
        recommendations = [
            {
                "type": "practice_frequency",
                "message": "Try to practice daily for better retention",
                "action": "Set a daily learning goal"
            },
            {
                "type": "difficulty_progression", 
                "message": "Gradually increase difficulty as you improve",
                "action": "Add some Level 2 words to your list"
            }
        ]
        
        return {
            "overall_accuracy": 85.0,  # Would be calculated from user's actual data
            "average_session_time": 12.5,  # In minutes
            "recommendations": recommendations
        }
        
    except Exception as e:
        print(f"Error in get_learning_recommendations: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get recommendations: {str(e)}"
        )


@router.get("/analytics/batches")
async def get_batch_analytics(
    days: int = Query(7, ge=1, le=90, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get batch completion analytics for the user
    """
    try:
        # This would analyze user's batch completion patterns
        # For now, return mock data structure
        
        return {
            "period_days": days,
            "total_batches_completed": 12,
            "average_accuracy": 78.5,
            "words_learned": 28,
            "daily_breakdown": []  # Would contain daily statistics
        }
        
    except Exception as e:
        print(f"Error in get_batch_analytics: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get batch analytics: {str(e)}"
        )