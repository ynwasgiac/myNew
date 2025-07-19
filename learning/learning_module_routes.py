from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime

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
            
            for word_progress in words:
                if len(all_words) >= daily_goal:
                    break
                    
                word = word_progress.kazakh_word
                if not word:
                    continue
                    
                # Get translation in user's preferred language
                translation = ""
                user_lang_code = current_user.main_language.language_code if current_user.main_language else "en"
                
                if hasattr(word, 'translations') and word.translations:
                    user_translation = next(
                        (t for t in word.translations if t.language.language_code == user_lang_code),
                        None
                    )
                    if user_translation:
                        translation = user_translation.translation
                    elif word.translations:
                        translation = word.translations[0].translation
                
                word_data = {
                    "id": word.id,
                    "kazakh_word": word.kazakh_word,
                    "kazakh_cyrillic": word.kazakh_cyrillic,
                    "translation": translation,
                    "pronunciation": word.pronunciation,
                    "image_url": word.image_url,
                    "status": word_progress.status.value,
                    "times_seen": word_progress.times_seen,
                    "times_correct": word_progress.times_correct,
                    "difficulty_level": word.difficulty_level.level_number if word.difficulty_level else 1,
                    "category_name": word.category.category_name if word.category else "Unknown"
                }
                
                all_words.append(word_data)
        
        # If not enough words from learning list, get random words
        if len(all_words) < daily_goal:
            remaining_needed = daily_goal - len(all_words)
            existing_word_ids = [w["id"] for w in all_words]
            
            try:
                random_words = await KazakhWordCRUD.get_random_words(
                    db, 
                    remaining_needed, 
                    difficulty_level_id,
                    category_id, 
                    user_lang_code,
                    exclude_word_ids=existing_word_ids
                )
                
                for word in random_words:
                    translation = ""
                    if hasattr(word, 'translations') and word.translations:
                        translation = word.translations[0].translation
                    
                    word_data = {
                        "id": word.id,
                        "kazakh_word": word.kazakh_word,
                        "kazakh_cyrillic": getattr(word, 'kazakh_cyrillic', None),
                        "translation": translation,
                        "pronunciation": getattr(word, 'pronunciation', None),
                        "image_url": getattr(word, 'image_url', None),
                        "status": "want_to_learn",  # Default status for new words
                        "times_seen": 0,
                        "times_correct": 0,
                        "difficulty_level": word.difficulty_level.level_number if hasattr(word, 'difficulty_level') and word.difficulty_level else 1,
                        "category_name": word.category.category_name if hasattr(word, 'category') and word.category else "Unknown"
                    }
                    
                    all_words.append(word_data)
                    
                    # Auto-add random words to learning list
                    await UserWordProgressCRUD.add_word_to_learning_list(
                        db, current_user.id, word.id, LearningStatus.WANT_TO_LEARN
                    )
            
            except Exception as e:
                print(f"Warning: Could not load random words: {e}")
        
        # Organize into batches of 3
        batches = []
        for i in range(0, len(all_words), 3):
            batch = all_words[i:i+3]
            if len(batch) == 3:  # Only complete batches
                batches.append({
                    "batch_number": len(batches) + 1,
                    "words": batch
                })
        
        return {
            "total_words": len(all_words),
            "total_batches": len(batches),
            "words_per_batch": 3,
            "batches": batches,
            "daily_goal": daily_goal
        }
        
    except Exception as e:
        print(f"Error in get_words_not_learned: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get learning words: {str(e)}"
        )


@router.post("/batch/practice/start")
async def start_batch_practice(
    word_ids: List[int],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Start a practice session for a specific batch of 3 words
    """
    try:
        if len(word_ids) != 3:
            raise HTTPException(
                status_code=400,
                detail="Batch must contain exactly 3 words"
            )
        
        # Create learning session
        session = await UserLearningSessionCRUD.create_session(
            db, current_user.id, "practice_batch"
        )
        
        # Get word details
        practice_words = []
        user_lang_code = current_user.main_language.language_code if current_user.main_language else "en"
        
        for word_id in word_ids:
            word = await KazakhWordCRUD.get_by_id(db, word_id)
            if not word:
                continue
                
            # Get translation
            translation = ""
            if hasattr(word, 'translations') and word.translations:
                user_translation = next(
                    (t for t in word.translations if t.language.language_code == user_lang_code),
                    None
                )
                if user_translation:
                    translation = user_translation.translation
                elif word.translations:
                    translation = word.translations[0].translation
            
            practice_words.append({
                "id": word.id,
                "kazakh_word": word.kazakh_word,
                "kazakh_cyrillic": word.kazakh_cyrillic,
                "translation": translation,
                "pronunciation": word.pronunciation,
                "image_url": word.image_url,
                "difficulty_level": word.difficulty_level.level_number if word.difficulty_level else 1
            })
        
        return {
            "session_id": session.id,
            "session_type": "practice_batch",
            "words": practice_words,
            "total_words": len(practice_words)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in start_batch_practice: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start practice session: {str(e)}"
        )


@router.post("/batch/quiz/start")
async def start_batch_quiz(
    word_ids: List[int],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Start a quiz session for a specific batch of 3 words
    """
    try:
        if len(word_ids) != 3:
            raise HTTPException(
                status_code=400,
                detail="Batch must contain exactly 3 words"
            )
        
        # Create learning session
        session = await UserLearningSessionCRUD.create_session(
            db, current_user.id, "quiz_batch"
        )
        
        # Get word details and generate quiz questions
        quiz_questions = []
        user_lang_code = current_user.main_language.language_code if current_user.main_language else "en"
        
        # Get all words for generating wrong options
        all_words = []
        for word_id in word_ids:
            word = await KazakhWordCRUD.get_by_id(db, word_id)
            if word:
                all_words.append(word)
        
        # Generate questions
        for word in all_words:
            # Get correct translation
            correct_translation = ""
            if hasattr(word, 'translations') and word.translations:
                user_translation = next(
                    (t for t in word.translations if t.language.language_code == user_lang_code),
                    None
                )
                if user_translation:
                    correct_translation = user_translation.translation
                elif word.translations:
                    correct_translation = word.translations[0].translation
            
            # Generate wrong options from other words in the batch
            wrong_options = []
            for other_word in all_words:
                if other_word.id != word.id:
                    other_translation = ""
                    if hasattr(other_word, 'translations') and other_word.translations:
                        other_user_translation = next(
                            (t for t in other_word.translations if t.language.language_code == user_lang_code),
                            None
                        )
                        if other_user_translation:
                            other_translation = other_user_translation.translation
                        elif other_word.translations:
                            other_translation = other_word.translations[0].translation
                    
                    if other_translation and other_translation != correct_translation:
                        wrong_options.append(other_translation)
            
            # Add generic wrong options if needed
            generic_options = ["water", "house", "tree", "book", "person", "food", "time", "day"]
            for option in generic_options:
                if len(wrong_options) >= 3:
                    break
                if option not in wrong_options and option != correct_translation.lower():
                    wrong_options.append(option)
            
            # Create options array and shuffle
            all_options = [correct_translation] + wrong_options[:3]
            import random
            random.shuffle(all_options)
            correct_index = all_options.index(correct_translation)
            
            quiz_questions.append({
                "id": word.id,
                "question": f"What does '{word.kazakh_word}' mean?",
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
        if len(word_ids) != 3:
            raise HTTPException(
                status_code=400,
                detail="Batch must contain exactly 3 words"
            )
        
        # Create result maps for easy lookup
        practice_map = {r["word_id"]: r["was_correct"] for r in practice_results}
        quiz_map = {r["word_id"]: r["was_correct"] for r in quiz_results}
        
        words_learned = []
        batch_summary = {
            "total_words": len(word_ids),
            "practice_correct": sum(practice_map.values()),
            "quiz_correct": sum(quiz_map.values()),
            "words_learned": [],
            "words_to_review": []
        }
        
        # Process each word
        for word_id in word_ids:
            practice_correct = practice_map.get(word_id, False)
            quiz_correct = quiz_map.get(word_id, False)
            
            # Get word details for summary
            word = await KazakhWordCRUD.get_by_id(db, word_id)
            word_name = word.kazakh_word if word else f"Word {word_id}"
            
            # If correct in both practice and quiz, mark as learned
            if practice_correct and quiz_correct:
                try:
                    await UserWordProgressCRUD.update_word_progress(
                        db, 
                        current_user.id, 
                        word_id,
                        status=LearningStatus.LEARNED,
                        was_correct=True
                    )
                    words_learned.append(word_name)
                    batch_summary["words_learned"].append({
                        "word_id": word_id,
                        "kazakh_word": word_name,
                        "new_status": "learned"
                    })
                except Exception as e:
                    print(f"Failed to update word {word_id} status: {e}")
            else:
                # Keep in learning status for review
                try:
                    await UserWordProgressCRUD.update_word_progress(
                        db,
                        current_user.id,
                        word_id,
                        status=LearningStatus.LEARNING,
                        was_correct=False
                    )
                    batch_summary["words_to_review"].append({
                        "word_id": word_id,
                        "kazakh_word": word_name,
                        "practice_correct": practice_correct,
                        "quiz_correct": quiz_correct
                    })
                except Exception as e:
                    print(f"Failed to update word {word_id} for review: {e}")
        
        # Update user learning statistics
        # This could trigger achievements, streaks, etc.
        
        return {
            "success": True,
            "batch_completed": True,
            "summary": batch_summary,
            "message": f"Batch completed! {len(words_learned)} words learned."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in complete_learning_batch: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to complete batch: {str(e)}"
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
    
# Add this endpoint to learning/learning_module_routes.py

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
        # Determine count from user settings if not provided
        if count is None:
            # Get user's daily goal from settings (default to 10)
            count = 10  # Default daily goal
            if current_user.main_language:
                count = getattr(current_user.main_language, 'daily_goal', 10)
        
        # Validate count
        if count <= 0 or count > 50:
            raise HTTPException(
                status_code=400,
                detail="Count must be between 1 and 50"
            )
        
        # Get user's language preference
        user_lang_code = current_user.main_language.language_code if current_user.main_language else "en"
        
        # Get words already in user's learning list to exclude them
        existing_progress = await UserWordProgressCRUD.get_user_learning_words(
            db, current_user.id, limit=2000, offset=0  # Get all user's words
        )
        existing_word_ids = [wp.kazakh_word_id for wp in existing_progress]
        
        # Get random words with translations in user's language
        # Request more than needed to account for filtering
        search_multiplier = 3  # Start with 3x the needed count
        max_attempts = 5
        found_words = []
        
        for attempt in range(max_attempts):
            search_count = count * search_multiplier
            
            # Base query for random words with proper joins
            query = select(KazakhWord).options(
                selectinload(KazakhWord.translations).selectinload(Translation.language),
                selectinload(KazakhWord.category),
                selectinload(KazakhWord.difficulty_level)
            )
            
            # Apply category filter
            if category_id:
                query = query.where(KazakhWord.category_id == category_id)
            
            # Apply difficulty filter
            if difficulty_level_id:
                query = query.where(KazakhWord.difficulty_level_id == difficulty_level_id)
            
            # Exclude words already in user's learning list
            if existing_word_ids:
                query = query.where(~KazakhWord.id.in_(existing_word_ids))
            
            # Join with translations to ensure words have translations in user's language
            query = query.join(Translation).join(Language).where(
                Language.language_code == user_lang_code
            )
            
            # Get random selection
            query = query.order_by(func.random()).limit(search_count)
            
            result = await db.execute(query)
            candidate_words = result.scalars().all()
            
            # Filter to ensure each word has a valid translation in user's language
            for word in candidate_words:
                if len(found_words) >= count:
                    break
                
                # Verify translation exists and is not empty
                user_translation = None
                if hasattr(word, 'translations') and word.translations:
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
        
        # Take exactly the count we need
        selected_words = found_words[:count]
        
        # Add words to user's learning list
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
                    "status": "want_to_learn"
                })
                
            except Exception as e:
                failed_additions.append({
                    "word_id": word.id,
                    "kazakh_word": word.kazakh_word,
                    "error": str(e)
                })
                print(f"Failed to add word {word.id} ({word.kazakh_word}): {e}")
        
        # Verify we added the exact count requested
        if len(added_words) != count:
            raise HTTPException(
                status_code=500,
                detail=f"Expected to add {count} words but only added {len(added_words)}. "
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
    