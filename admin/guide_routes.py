# admin/guide_routes.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from database import get_db
from auth.dependencies import get_current_user, get_current_admin
from database.auth_models import User
from database.guide_crud import LearningGuideCRUD, GuideWordSearchCRUD
from database.learning_models import LearningGuide

router = APIRouter(prefix="/admin/guides", tags=["admin-guides"])


class GuideCreateRequest(BaseModel):
    guide_key: str
    title: str
    description: Optional[str] = None
    icon_name: Optional[str] = None
    color: Optional[str] = None
    difficulty_level: str
    estimated_minutes: Optional[int] = None
    target_word_count: int = 20
    keywords: List[str] = []
    topics: List[str] = []
    sort_order: int = 0


class GuideUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    icon_name: Optional[str] = None
    color: Optional[str] = None
    difficulty_level: Optional[str] = None
    estimated_minutes: Optional[int] = None
    target_word_count: Optional[int] = None
    keywords: Optional[List[str]] = None
    topics: Optional[List[str]] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class AddWordsToGuideRequest(BaseModel):
    word_ids: List[int]
    importance_scores: Optional[List[float]] = None
    order_positions: Optional[List[int]] = None


@router.get("/", response_model=List[Dict[str, Any]])
async def get_all_guides(
    include_inactive: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Get all guides for admin management"""
    
    guides = await LearningGuideCRUD.get_all_guides(
        db, is_active=not include_inactive
    )
    
    # Get word counts for each guide
    formatted_guides = []
    for guide in guides:
        guide_words = await LearningGuideCRUD.get_guide_words(db, guide.id)
        
        formatted_guides.append({
            'id': guide.id,
            'guide_key': guide.guide_key,
            'title': guide.title,
            'description': guide.description,
            'icon_name': guide.icon_name,
            'color': guide.color,
            'difficulty_level': guide.difficulty_level,
            'estimated_minutes': guide.estimated_minutes,
            'target_word_count': guide.target_word_count,
            'actual_word_count': len(guide_words),
            'keywords': guide.keywords,
            'topics': guide.topics,
            'sort_order': guide.sort_order,
            'is_active': guide.is_active,
            'created_at': guide.created_at.isoformat(),
            'updated_at': guide.updated_at.isoformat()
        })
    
    return formatted_guides


@router.post("/", response_model=Dict[str, Any])
async def create_guide(
    guide_data: GuideCreateRequest,
    auto_add_words: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Create a new learning guide"""
    
    try:
        # Check if guide key already exists
        existing = await LearningGuideCRUD.get_guide_by_key(db, guide_data.guide_key)
        if existing:
            raise HTTPException(
                status_code=400, 
                detail=f"Guide with key '{guide_data.guide_key}' already exists"
            )
        
        # Create guide
        guide = await LearningGuideCRUD.create_guide(db, guide_data.dict())
        
        # Automatically add words if requested
        added_words = 0
        if auto_add_words:
            if guide_data.keywords:
                # Search by keywords
                found_words = await GuideWordSearchCRUD.search_words_by_keywords(
                    db, guide_data.keywords, limit=guide_data.target_word_count
                )
                
                if found_words:
                    word_ids = [w.id for w in found_words]
                    added_words = await LearningGuideCRUD.add_words_to_guide(
                        db, guide.id, word_ids
                    )
            
            # If not enough words found, try topics
            if added_words < guide_data.target_word_count and guide_data.topics:
                additional_needed = guide_data.target_word_count - added_words
                topic_words = await GuideWordSearchCRUD.get_words_by_topics(
                    db, guide_data.topics, limit=additional_needed
                )
                
                if topic_words:
                    # Filter out already added words
                    existing_guide_words = await LearningGuideCRUD.get_guide_words(db, guide.id)
                    existing_word_ids = {w['word'].id for w in existing_guide_words}
                    
                    new_words = [w for w in topic_words if w.id not in existing_word_ids]
                    if new_words:
                        new_word_ids = [w.id for w in new_words]
                        additional_added = await LearningGuideCRUD.add_words_to_guide(
                            db, guide.id, new_word_ids
                        )
                        added_words += additional_added
        
        return {
            'message': f"Guide '{guide.title}' created successfully",
            'guide': {
                'id': guide.id,
                'guide_key': guide.guide_key,
                'title': guide.title,
                'target_word_count': guide.target_word_count,
                'actual_word_count': added_words
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating guide: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create guide: {str(e)}")


@router.put("/{guide_id}")
async def update_guide(
    guide_id: int,
    guide_data: GuideUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Update a learning guide"""
    
    try:
        # Get guide
        guide = await db.get(LearningGuide, guide_id)
        if not guide:
            raise HTTPException(status_code=404, detail="Guide not found")
        
        # Update fields
        update_data = guide_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(guide, field, value)
        
        await db.commit()
        await db.refresh(guide)
        
        return {
            'message': f"Guide '{guide.title}' updated successfully",
            'guide': {
                'id': guide.id,
                'guide_key': guide.guide_key,
                'title': guide.title,
                'is_active': guide.is_active
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating guide: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update guide: {str(e)}")


@router.delete("/{guide_id}")
async def delete_guide(
    guide_id: int,
    force: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Delete a learning guide"""
    
    try:
        guide = await db.get(LearningGuide, guide_id)
        if not guide:
            raise HTTPException(status_code=404, detail="Guide not found")
        
        if not force:
            # Soft delete - just mark as inactive
            guide.is_active = False
            await db.commit()
            
            return {
                'message': f"Guide '{guide.title}' deactivated successfully",
                'action': 'deactivated'
            }
        else:
            # Hard delete - remove from database
            await db.delete(guide)
            await db.commit()
            
            return {
                'message': f"Guide '{guide.title}' deleted successfully",
                'action': 'deleted'
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting guide: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete guide: {str(e)}")


@router.get("/{guide_id}/words")
async def get_guide_words_admin(
    guide_id: int,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Get words for a guide (admin view)"""
    
    try:
        guide = await db.get(LearningGuide, guide_id)
        if not guide:
            raise HTTPException(status_code=404, detail="Guide not found")
        
        guide_words = await LearningGuideCRUD.get_guide_words(db, guide_id, limit)
        
        return {
            'guide_id': guide_id,
            'guide_title': guide.title,
            'words': [
                {
                    'id': w['word'].id,
                    'kazakh_word': w['word'].kazakh_word,
                    'kazakh_cyrillic': w['word'].kazakh_cyrillic,
                    'importance_score': w['importance_score'],
                    'order_in_guide': w['order_in_guide'],
                    'category': w['word'].category.name if w['word'].category else None,
                    'difficulty': w['word'].difficulty_level.name if w['word'].difficulty_level else None
                }
                for w in guide_words
            ],
            'total_words': len(guide_words)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting guide words: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get guide words: {str(e)}")


@router.post("/{guide_id}/words")
async def add_words_to_guide(
    guide_id: int,
    request: AddWordsToGuideRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Add words to a guide"""
    
    try:
        guide = await db.get(LearningGuide, guide_id)
        if not guide:
            raise HTTPException(status_code=404, detail="Guide not found")
        
        added_count = await LearningGuideCRUD.add_words_to_guide(
            db, guide_id, request.word_ids, 
            request.importance_scores, request.order_positions
        )
        
        return {
            'message': f"Added {added_count} words to guide '{guide.title}'",
            'guide_id': guide_id,
            'words_added': added_count,
            'total_words_requested': len(request.word_ids)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error adding words to guide: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add words to guide: {str(e)}")


@router.post("/{guide_id}/auto-populate")
async def auto_populate_guide(
    guide_id: int,
    max_words: int = Query(50, ge=1, le=100),
    use_keywords: bool = Query(True),
    use_topics: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Auto-populate guide with words based on keywords and topics"""
    
    try:
        guide = await db.get(LearningGuide, guide_id)
        if not guide:
            raise HTTPException(status_code=404, detail="Guide not found")
        
        found_words = []
        
        # Search by keywords
        if use_keywords and guide.keywords:
            keyword_words = await GuideWordSearchCRUD.search_words_by_keywords(
                db, guide.keywords, limit=max_words
            )
            found_words.extend(keyword_words)
        
        # Search by topics
        if use_topics and guide.topics and len(found_words) < max_words:
            remaining_slots = max_words - len(found_words)
            topic_words = await GuideWordSearchCRUD.get_words_by_topics(
                db, guide.topics, limit=remaining_slots
            )
            
            # Filter out duplicates
            existing_ids = {w.id for w in found_words}
            new_topic_words = [w for w in topic_words if w.id not in existing_ids]
            found_words.extend(new_topic_words)
        
        if not found_words:
            return {
                'message': f"No words found for guide '{guide.title}'",
                'words_added': 0,
                'search_criteria': {
                    'keywords': guide.keywords if use_keywords else None,
                    'topics': guide.topics if use_topics else None
                }
            }
        
        # Add words to guide
        word_ids = [w.id for w in found_words]
        added_count = await LearningGuideCRUD.add_words_to_guide(
            db, guide_id, word_ids
        )
        
        return {
            'message': f"Auto-populated guide '{guide.title}' with {added_count} words",
            'guide_id': guide_id,
            'words_found': len(found_words),
            'words_added': added_count,
            'search_criteria': {
                'keywords': guide.keywords if use_keywords else None,
                'topics': guide.topics if use_topics else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error auto-populating guide: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to auto-populate guide: {str(e)}")


@router.get("/{guide_id}/stats")
async def get_guide_statistics(
    guide_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Get guide usage statistics"""
    
    try:
        guide = await db.get(LearningGuide, guide_id)
        if not guide:
            raise HTTPException(status_code=404, detail="Guide not found")
        
        # Get basic stats
        guide_words = await LearningGuideCRUD.get_guide_words(db, guide_id)
        
        # Get user progress stats
        from database.guide_crud import UserGuideCRUD
        from sqlalchemy import func, select
        from database.learning_models import UserGuideProgress
        
        # Count users who started this guide
        users_started_query = select(func.count(UserGuideProgress.id)).where(
            UserGuideProgress.guide_id == guide_id
        )
        users_started_result = await db.execute(users_started_query)
        users_started = users_started_result.scalar()
        
        # Count users who completed this guide
        users_completed_query = select(func.count(UserGuideProgress.id)).where(
            and_(
                UserGuideProgress.guide_id == guide_id,
                UserGuideProgress.status == 'completed'
            )
        )
        users_completed_result = await db.execute(users_completed_query)
        users_completed = users_completed_result.scalar()
        
        return {
            'guide_id': guide_id,
            'guide_title': guide.title,
            'statistics': {
                'target_word_count': guide.target_word_count,
                'actual_word_count': len(guide_words),
                'users_started': users_started,
                'users_completed': users_completed,
                'completion_rate': (users_completed / users_started * 100) if users_started > 0 else 0,
                'keywords_count': len(guide.keywords) if guide.keywords else 0,
                'topics_count': len(guide.topics) if guide.topics else 0
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting guide statistics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get guide statistics: {str(e)}")