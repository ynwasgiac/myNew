# main.py
from fastapi import FastAPI, Depends, HTTPException, Query, Response, Path
from sqlalchemy import select, or_, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.orm import selectinload, joinedload
from starlette.middleware.cors import CORSMiddleware

# Import from our database package
from database import get_db, init_database, WordImage, KazakhWord, ExampleSentence, ExampleSentenceTranslation, \
    WordType, Translation
from database.crud import (
    LanguageCRUD, CategoryCRUD, WordTypeCRUD, DifficultyLevelCRUD,
    KazakhWordCRUD, TranslationCRUD, PronunciationCRUD, WordSoundCRUD
)
from database.schemas import (
    LanguageResponse, CategoryResponse, WordTypeResponse, DifficultyLevelResponse,
    KazakhWordResponse, KazakhWordSummary, KazakhWordCreate, KazakhWordSimpleResponse,
    WordSearchParams, WordSearchResponse, PracticeWordRequest, PracticeWordResponse,
    CategoryTranslationResponse, WordTypeTranslationResponse,
    DifficultyLevelTranslationResponse, TranslationResponse,
    PronunciationResponse, ExampleSentenceTranslationResponse,
    ExampleSentenceResponse, WordImageResponse, WordSoundCreate, WordSoundResponse, PaginatedWordsResponse
)
from database.auth_schemas import (
    MainLanguageUpdateResponse, SetMainLanguageRequest, UserMainLanguageResponse
)
from database.auth_crud import UserCRUD

# Add these imports to your main.py (if not already present)
from database.crud import WordImageCRUD
from database.schemas import WordImageCreate, WordImageResponse

# Import authentication and learning
from auth.routes import router as auth_router
from auth.token_refresh import refresh_router, TokenRefreshResponse, get_current_user_with_refresh
from auth.dependencies import get_current_user, get_current_user_optional, get_current_admin
from database.auth_models import User

# Import learning routes
from learning.routes import router as learning_router
from admin_routes import admin_router

# Create FastAPI app
app = FastAPI(
    title="Kazakh Language Learning API",
    description="API for learning Kazakh language with multilingual support, authentication, progress tracking, and user language preferences",
    version="2.1.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React dev server
        "http://localhost:8080",  # Vue dev server
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8080",
        "http://localhost:5173",  # Vite dev server
        "http://127.0.0.1:5173",
        "file://",  # For local HTML files
        "*"  # Allow all origins in development (remove in production)
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

# Include authentication routes
app.include_router(auth_router)
app.include_router(refresh_router)

# Include learning routes
app.include_router(learning_router)
app.include_router(admin_router)


# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    """Initialize database with proper async handling"""
    try:
        await init_database()
        print("✅ Database initialized successfully")
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        # Don't crash the app, but log the error
        import traceback
        traceback.print_exc()

# Add a database health check endpoint:
@app.get("/debug/db-health")
async def database_health_check(db: AsyncSession = Depends(get_db)):
    """Check if database is working properly"""
    try:
        # Simple async query to test connection
        result = await db.execute(select(func.now()))
        current_time = result.scalar()
        
        # Test if we can access a basic table
        from database.auth_models import User
        user_count = await db.execute(select(func.count(User.id)))
        total_users = user_count.scalar()
        
        return {
            "status": "healthy",
            "current_time": str(current_time),
            "total_users": total_users,
            "message": "Database connection working properly"
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "message": "Database connection failed"
        }


# Helper function to get user's preferred language
def get_user_language_preference(current_user: Optional[User]) -> str:
    """Get user's preferred language or default to English"""
    if current_user and current_user.main_language:
        return current_user.main_language.language_code
    return "en"  # Default to English


# Public endpoints (no authentication required)
@app.get("/")
def read_root():
    return {
        "message": "Kazakh Language Learning API",
        "version": "2.1.0",
        "description": "Learn Kazakh with multilingual support, progress tracking, and personalized language preferences",
        "features": [
            "User authentication and roles",
            "User language preferences",
            "Word learning progress tracking",
            "Spaced repetition system",
            "Practice sessions and quizzes",
            "Learning goals and achievements",
            "Comprehensive statistics",
            "Multilingual interface support"
        ],
        "authentication": "Required for most endpoints. Use /auth/register and /auth/login",
        "language_management": "Set your preferred interface language via /auth/set-main-language",
        "endpoints": {
            "auth": "/auth/*",
            "learning": "/learning/*",
            "words": "/words/*",
            "categories": "/categories/*",
            "languages": "/languages/*"
        }
    }


@app.get("/health")
async def health_check():
    """Public health check endpoint"""
    return {"status": "healthy", "service": "kazakh-language-api", "version": "2.1.0"}


# Language endpoints - now use user's preferred language as default
@app.get("/languages/", response_model=List[LanguageResponse])
async def get_languages(
        active_only: bool = True,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Get all supported languages"""
    return await LanguageCRUD.get_all(db, active_only=active_only)


@app.get("/languages/{language_code}", response_model=LanguageResponse)
async def get_language(
        language_code: str,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Get language by code"""
    language = await LanguageCRUD.get_by_code(db, language_code)
    if not language:
        raise HTTPException(status_code=404, detail="Language not found")
    return language


# Category endpoints - now use user's preferred language as default
@app.get("/categories/", response_model=List[CategoryResponse])
async def get_categories(
        language_code: Optional[str] = Query(None,
                                             description="Language code for translations (uses user preference if not specified)"),
        active_only: bool = True,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Get all word categories with translations in user's preferred language"""

    # Use user's preferred language if not specified
    if not language_code:
        language_code = get_user_language_preference(current_user)

    categories = await CategoryCRUD.get_all_with_translations(db, language_code, active_only)

    # Convert categories to proper response format
    response_categories = []
    for category in categories:
        translations = [
            CategoryTranslationResponse.from_orm_with_language(t)
            for t in category.translations
        ]

        category_response = CategoryResponse(
            id=category.id,
            category_name=category.category_name,
            description=category.description,
            is_active=category.is_active,
            created_at=category.created_at,
            translations=translations
        )
        response_categories.append(category_response)

    return response_categories


@app.get("/categories/{category_id}", response_model=CategoryResponse)
async def get_category(
        category_id: int,
        language_code: Optional[str] = Query(None,
                                             description="Language code for translations (uses user preference if not specified)"),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Get category by ID with translations in user's preferred language"""

    # Use user's preferred language if not specified
    if not language_code:
        language_code = get_user_language_preference(current_user)

    category = await CategoryCRUD.get_by_id(db, category_id, language_code)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    translations = [
        CategoryTranslationResponse.from_orm_with_language(t)
        for t in category.translations
    ]

    return CategoryResponse(
        id=category.id,
        category_name=category.category_name,
        description=category.description,
        is_active=category.is_active,
        created_at=category.created_at,
        translations=translations
    )


# Word Type endpoints - now use user's preferred language as default
@app.get("/word-types/", response_model=List[WordTypeResponse])
async def get_word_types(
        language_code: Optional[str] = Query(None,
                                             description="Language code for translations (uses user preference if not specified)"),
        active_only: bool = True,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Get all word types with translations in user's preferred language"""

    # Use user's preferred language if not specified
    if not language_code:
        language_code = get_user_language_preference(current_user)

    word_types = await WordTypeCRUD.get_all_with_translations(db, language_code, active_only)

    response_word_types = []
    for word_type in word_types:
        translations = [
            WordTypeTranslationResponse.from_orm_with_language(t)
            for t in word_type.translations
        ]

        word_type_response = WordTypeResponse(
            id=word_type.id,
            type_name=word_type.type_name,
            description=word_type.description,
            is_active=word_type.is_active,
            created_at=word_type.created_at,
            translations=translations
        )
        response_word_types.append(word_type_response)

    return response_word_types


# Difficulty Level endpoints - now use user's preferred language as default
@app.get("/difficulty-levels/", response_model=List[DifficultyLevelResponse])
async def get_difficulty_levels(
        language_code: Optional[str] = Query(None,
                                             description="Language code for translations (uses user preference if not specified)"),
        active_only: bool = True,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Get all difficulty levels with translations in user's preferred language"""

    # Use user's preferred language if not specified
    if not language_code:
        language_code = get_user_language_preference(current_user)

    levels = await DifficultyLevelCRUD.get_all_with_translations(db, language_code, active_only)

    response_levels = []
    for level in levels:
        translations = [
            DifficultyLevelTranslationResponse.from_orm_with_language(t)
            for t in level.translations
        ]

        level_response = DifficultyLevelResponse(
            id=level.id,
            level_number=level.level_number,
            level_name=level.level_name,
            description=level.description,
            is_active=level.is_active,
            created_at=level.created_at,
            translations=translations
        )
        response_levels.append(level_response)

    return response_levels


# Kazakh Word endpoints - now use user's preferred language as default
@app.post("/words/", response_model=KazakhWordSimpleResponse, status_code=201)
async def create_kazakh_word(
        word_data: KazakhWordCreate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)  # Only admins can create words
):
    """Create a new Kazakh word (admin only)"""
    new_word = await KazakhWordCRUD.create(
        db,
        word_data.kazakh_word,
        word_data.kazakh_cyrillic,
        word_data.word_type_id,
        word_data.category_id,
        word_data.difficulty_level_id
    )

    return KazakhWordSimpleResponse(
        id=new_word.id,
        kazakh_word=new_word.kazakh_word,
        kazakh_cyrillic=new_word.kazakh_cyrillic,
        word_type_id=new_word.word_type_id,
        category_id=new_word.category_id,
        difficulty_level_id=new_word.difficulty_level_id,
        created_at=new_word.created_at
    )

@app.get("/words/", response_model=PaginatedWordsResponse)
async def get_words_paginated(
    response: Response,
    page: int = Query(1, ge=1, description="Page number (starts from 1)"),
    page_size: int = Query(20, ge=1, le=50, description="Number of words per page (max 50)"),
    category_id: Optional[int] = Query(None, description="Filter by category"),
    word_type_id: Optional[int] = Query(None, description="Filter by word type"),
    difficulty_level_id: Optional[int] = Query(None, description="Filter by difficulty level"),
    search: Optional[str] = Query(None, min_length=2, description="Search in Kazakh word or translation"),
    language_code: Optional[str] = Query(None, description="Language code for translations"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_refresh)
):
    """Get paginated list of Kazakh words with filters and search"""

    # Handle automatic token refresh
    TokenRefreshResponse.add_token_header(response, current_user)

    # Use user's preferred language if not specified
    if not language_code:
        language_code = get_user_language_preference(current_user)

    # Calculate offset
    offset = (page - 1) * page_size

    # Build base query for counting
    count_query = select(func.count(KazakhWord.id)).select_from(KazakhWord)
    
    # Build main query
    main_query = (
        select(KazakhWord)
        .options(
            joinedload(KazakhWord.word_type),
            joinedload(KazakhWord.category),
            joinedload(KazakhWord.difficulty_level),
            selectinload(KazakhWord.translations).joinedload(Translation.language),
            selectinload(KazakhWord.images)
        )
    )

    # Apply filters to both queries
    filters = []
    
    if category_id:
        filters.append(KazakhWord.category_id == category_id)
    
    if word_type_id:
        filters.append(KazakhWord.word_type_id == word_type_id)
    
    if difficulty_level_id:
        filters.append(KazakhWord.difficulty_level_id == difficulty_level_id)

    # Apply search filter
    if search:
        search_conditions = [
            KazakhWord.kazakh_word.ilike(f"%{search}%"),
            KazakhWord.kazakh_cyrillic.ilike(f"%{search}%")
        ]
        
        # Also search in translations for the specified language
        translation_subquery = (
            select(Translation.kazakh_word_id)
            .join(Language)
            .where(
                and_(
                    Translation.translation.ilike(f"%{search}%"),
                    Language.language_code == language_code
                )
            )
        )
        search_conditions.append(KazakhWord.id.in_(translation_subquery))
        
        filters.append(or_(*search_conditions))

    # Apply all filters
    if filters:
        count_query = count_query.where(and_(*filters))
        main_query = main_query.where(and_(*filters))

    # Get total count
    total_result = await db.execute(count_query)
    total_count = total_result.scalar()

    # Apply pagination and ordering to main query
    main_query = (
        main_query
        .offset(offset)
        .limit(page_size)
        .order_by(KazakhWord.kazakh_word)
    )

    # Execute main query
    result = await db.execute(main_query)
    words = result.scalars().all()

    # Post-process to filter translations and images
    summaries = []
    for word in words:
        # Filter translations by language
        filtered_translations = [
            t for t in word.translations
            if t.language.language_code == language_code
        ]
        
        primary_translation = filtered_translations[0].translation if filtered_translations else None
        
        # Get primary image
        primary_image = None
        primary_images = [img for img in word.images if img.is_primary]
        if primary_images:
            primary_image = primary_images[0].image_url

        summaries.append(KazakhWordSummary(
            id=word.id,
            kazakh_word=word.kazakh_word,
            kazakh_cyrillic=word.kazakh_cyrillic,
            word_type_name=word.word_type.type_name,
            category_name=word.category.category_name,
            difficulty_level=word.difficulty_level.level_number,
            primary_translation=primary_translation,
            primary_image=primary_image
        ))

    # Calculate pagination info
    total_pages = (total_count + page_size - 1) // page_size
    has_next = page < total_pages
    has_previous = page > 1

    return PaginatedWordsResponse(
        words=summaries,
        pagination={
            "current_page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "start_index": offset + 1 if summaries else 0,
            "end_index": offset + len(summaries),
        },
        total_count=total_count,
        has_next=has_next,
        has_previous=has_previous
    )

@app.get("/words/legacy/", response_model=List[KazakhWordSummary])
async def get_words_legacy(
        response: Response,
        skip: int = Query(0, ge=0, description="Number of words to skip"),
        limit: int = Query(20, ge=1, le=100, description="Number of words to return"),
        category_id: Optional[int] = Query(None, description="Filter by category"),
        word_type_id: Optional[int] = Query(None, description="Filter by word type"),
        difficulty_level_id: Optional[int] = Query(None, description="Filter by difficulty level"),
        language_code: Optional[str] = Query(None,
                                             description="Language code for translations (uses user preference if not specified)"),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user_with_refresh)
):
    """Get paginated list of Kazakh words with filters in user's preferred language"""

    # Handle automatic token refresh
    TokenRefreshResponse.add_token_header(response, current_user)

    # Use user's preferred language if not specified
    if not language_code:
        language_code = get_user_language_preference(current_user)

    words = await KazakhWordCRUD.get_all_paginated(
        db, skip, limit, category_id, word_type_id, difficulty_level_id, language_code
    )

    # Convert to summary format
    summaries = []
    for word in words:
        primary_translation = word.translations[0].translation if word.translations else None
        primary_image = None
        if word.images:
            primary_image = word.images[0].image_url

        summaries.append(KazakhWordSummary(
            id=word.id,
            kazakh_word=word.kazakh_word,
            kazakh_cyrillic=word.kazakh_cyrillic,
            word_type_name=word.word_type.type_name,
            category_name=word.category.category_name,
            difficulty_level=word.difficulty_level.level_number,
            primary_translation=primary_translation,
            primary_image=primary_image
        ))

    return summaries


@app.get("/words/{word_id}", response_model=KazakhWordResponse)
async def get_word(
        word_id: int,
        language_code: Optional[str] = Query(None,
                                             description="Language code for translations (uses user preference if not specified)"),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Get detailed information about a Kazakh word in user's preferred language"""

    # Use user's preferred language if not specified
    if not language_code:
        language_code = get_user_language_preference(current_user)

    word = await KazakhWordCRUD.get_by_id_full(db, word_id, language_code)
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    # Manually construct the response to handle nested translations
    # Build word_type response
    word_type_translations = [
        WordTypeTranslationResponse.from_orm_with_language(t)
        for t in word.word_type.translations
        if t.language.language_code == language_code
    ]
    word_type_response = WordTypeResponse(
        id=word.word_type.id,
        type_name=word.word_type.type_name,
        description=word.word_type.description,
        is_active=word.word_type.is_active,
        created_at=word.word_type.created_at,
        translations=word_type_translations
    )

    # Build category response
    category_translations = [
        CategoryTranslationResponse.from_orm_with_language(t)
        for t in word.category.translations
        if t.language.language_code == language_code
    ]
    category_response = CategoryResponse(
        id=word.category.id,
        category_name=word.category.category_name,
        description=word.category.description,
        is_active=word.category.is_active,
        created_at=word.category.created_at,
        translations=category_translations
    )

    # Build difficulty level response
    difficulty_translations = [
        DifficultyLevelTranslationResponse.from_orm_with_language(t)
        for t in word.difficulty_level.translations
        if t.language.language_code == language_code
    ]
    difficulty_response = DifficultyLevelResponse(
        id=word.difficulty_level.id,
        level_number=word.difficulty_level.level_number,
        level_name=word.difficulty_level.level_name,
        description=word.difficulty_level.description,
        is_active=word.difficulty_level.is_active,
        created_at=word.difficulty_level.created_at,
        translations=difficulty_translations
    )

    # Build translations response
    translations_response = [
        TranslationResponse.from_orm_with_language(t)
        for t in word.translations
    ]

    # Build pronunciations response
    pronunciations_response = [
        PronunciationResponse.from_orm_with_language(p)
        for p in word.pronunciations
    ]

    # Build example sentences response
    example_sentences_response = []
    for sentence in word.example_sentences:
        sentence_translations = [
            ExampleSentenceTranslationResponse.from_orm_with_language(t)
            for t in sentence.translations
        ]
        example_sentence_response = ExampleSentenceResponse(
            id=sentence.id,
            kazakh_sentence=sentence.kazakh_sentence,
            difficulty_level=sentence.difficulty_level,
            usage_context=sentence.usage_context,
            created_at=sentence.created_at,
            translations=sentence_translations
        )
        example_sentences_response.append(example_sentence_response)

    # Build final response
    return KazakhWordResponse(
        id=word.id,
        kazakh_word=word.kazakh_word,
        kazakh_cyrillic=word.kazakh_cyrillic,
        created_at=word.created_at,
        word_type=word_type_response,
        category=category_response,
        difficulty_level=difficulty_response,
        translations=translations_response,
        pronunciations=pronunciations_response,
        images=[WordImageResponse.from_attributes(img) for img in word.images],
        example_sentences=example_sentences_response
    )


@app.get("/words/search/", response_model=List[KazakhWordSummary])
async def search_words(
        q: str = Query(..., description="Search term"),
        language_code: Optional[str] = Query(None,
                                             description="Language code for translations (uses user preference if not specified)"),
        limit: int = Query(20, ge=1, le=50, description="Maximum number of results"),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Search Kazakh words by term or translation in user's preferred language"""

    # Use user's preferred language if not specified
    if not language_code:
        language_code = get_user_language_preference(current_user)

    words = await KazakhWordCRUD.search_words(db, q, language_code, limit)

    # Convert to summary format
    summaries = []
    for word in words:
        primary_translation = word.translations[0].translation if word.translations else None
        primary_image = None
        if word.images:
            primary_image = word.images[0].image_url

        # Safely get attributes with fallbacks
        word_type_name = "Unknown"
        category_name = "Unknown"
        difficulty_level = 1

        try:
            if hasattr(word, 'word_type') and word.word_type:
                word_type_name = word.word_type.type_name
            if hasattr(word, 'category') and word.category:
                category_name = word.category.category_name
            if hasattr(word, 'difficulty_level') and word.difficulty_level:
                difficulty_level = word.difficulty_level.level_number
        except AttributeError:
            # Handle case where relationships might not be loaded
            pass

        summaries.append(KazakhWordSummary(
            id=word.id,
            kazakh_word=word.kazakh_word,
            kazakh_cyrillic=word.kazakh_cyrillic,
            word_type_name=word_type_name,
            category_name=category_name,
            difficulty_level=difficulty_level,
            primary_translation=primary_translation,
            primary_image=primary_image
        ))

    return summaries


@app.get("/words/random/", response_model=List[PracticeWordResponse])
async def get_random_words(
        count: int = Query(10, ge=1, le=50, description="Number of random words"),
        difficulty_level_id: Optional[int] = Query(None, description="Filter by difficulty level"),
        category_id: Optional[int] = Query(None, description="Filter by category"),
        language_code: Optional[str] = Query(None,
                                             description="Language code for translations (uses user preference if not specified)"),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Get random words for practice in user's preferred language"""

    # Use user's preferred language if not specified
    if not language_code:
        language_code = get_user_language_preference(current_user)

    words = await KazakhWordCRUD.get_random_words(
        db, count, difficulty_level_id, category_id, language_code
    )

    # Convert to practice format
    practice_words = []
    for word in words:
        translation = ""
        if word.translations and len(word.translations) > 0:
            translation = word.translations[0].translation

        pronunciation = None
        if word.pronunciations and len(word.pronunciations) > 0:
            pronunciation = word.pronunciations[0].pronunciation

        image_url = None
        if word.images and len(word.images) > 0:
            image_url = word.images[0].image_url

        difficulty_level = 1
        if hasattr(word, 'difficulty_level') and word.difficulty_level:
            difficulty_level = word.difficulty_level.level_number

        practice_words.append(PracticeWordResponse(
            id=word.id,
            kazakh_word=word.kazakh_word,
            kazakh_cyrillic=word.kazakh_cyrillic,
            translation=translation,
            pronunciation=pronunciation,
            image_url=image_url,
            difficulty_level=difficulty_level
        ))

    return practice_words


# User language endpoints
@app.post("/user/language", response_model=MainLanguageUpdateResponse)
async def set_user_language(
    language_data: SetMainLanguageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Set user's main language preference"""
    try:
        # Set the user's main language using the CRUD method
        updated_user = await UserCRUD.set_user_main_language(
            db, 
            current_user.id, 
            language_data.language_code.lower()  # Ensure lowercase
        )
        
        if not updated_user:
            raise HTTPException(
                status_code=404,
                detail="Language not found"
            )

        # The updated_user already has the language relationship loaded
        # because update_user includes selectinload(User.main_language)
        main_language = None
        if updated_user.main_language:
            main_language = UserMainLanguageResponse(
                language_code=updated_user.main_language.language_code,
                language_name=updated_user.main_language.language_name
            )

        return MainLanguageUpdateResponse(
            success=True,
            message="Language preference updated successfully",
            main_language=main_language
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

@app.delete("/user/language", response_model=MainLanguageUpdateResponse)
async def clear_user_language(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clear user's main language preference"""
    try:
        updated_user = await UserCRUD.clear_user_main_language(db, current_user.id)
        
        if not updated_user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        return MainLanguageUpdateResponse(
            success=True,
            message="Language preference cleared successfully",
            main_language=None
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


@app.post("/word-sounds/", response_model=WordSoundResponse, status_code=201)
async def create_word_sound(
    sound_data: WordSoundCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)  # Only admins can create sounds
):
    """Create a new word sound (admin only)
    
    Note: If you are sending a Windows file path in JSON, use double backslashes (\\) or forward slashes (/).
    Example:
        "sound_path": "D:/python/KazakhLearn/sounds/1.mp3"
        or
        "sound_path": "D:\\python\\KazakhLearn\\sounds\\1.mp3"
    """
    # Require at least one of sound_path or sound_url
    if not sound_data.sound_path and not sound_data.sound_url:
        raise HTTPException(status_code=422, detail="Either sound_path or sound_url must be provided.")
    # Always convert all single backslashes to double backslashes in sound_path if present
    safe_sound_path = sound_data.sound_path.replace('\\', '\\\\') if sound_data.sound_path else None
    new_sound = await WordSoundCRUD.create(
        db,
        kazakh_word_id=sound_data.kazakh_word_id,
        sound_path=safe_sound_path,
        sound_url=sound_data.sound_url,
        sound_type=sound_data.sound_type,
        alt_text=sound_data.alt_text
    )
    return WordSoundResponse.from_attributes(new_sound)


@app.get("/word-sounds/{word_id}", response_model=List[WordSoundResponse])
async def get_word_sounds_by_word_id(
    word_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all sounds for a given Kazakh word ID"""
    sounds = await WordSoundCRUD.get_by_word_id(db, word_id)
    return [WordSoundResponse.from_attributes(s) for s in sounds]


@app.get("/categories/{category_id}/words", response_model=List[KazakhWordSummary])
async def get_words_by_category(
    category_id: int,
    language_code: Optional[str] = Query(None, description="Language code for translations (uses user preference if not specified)"),
    skip: int = Query(0, ge=0, description="Number of words to skip"),
    limit: int = Query(100, ge=1, le=200, description="Number of words to return"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all words by category in user's preferred language"""
    if not language_code:
        language_code = get_user_language_preference(current_user)

    words = await KazakhWordCRUD.get_all_paginated(
        db, skip, limit, category_id, None, None, language_code
    )

    summaries = []
    for word in words:
        primary_translation = word.translations[0].translation if word.translations else None
        primary_image = None
        if word.images:
            primary_image = word.images[0].image_url

        summaries.append(KazakhWordSummary(
            id=word.id,
            kazakh_word=word.kazakh_word,
            kazakh_cyrillic=word.kazakh_cyrillic,
            word_type_name=word.word_type.type_name,
            category_name=word.category.category_name,
            difficulty_level=word.difficulty_level.level_number,
            primary_translation=primary_translation,
            primary_image=primary_image
        ))

    return summaries

# Add these additional endpoints to your main.py file for complete word image management

@app.put("/word-images/{image_id}/primary", response_model=dict)
async def set_primary_image(
    image_id: int,
    word_id: int = Query(..., description="Kazakh word ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)  # Only admins can modify
):
    """Set an image as primary for a word (admin only)"""
    success = await WordImageCRUD.update_primary_status(db, word_id, image_id)
    if not success:
        raise HTTPException(status_code=404, detail="Image not found or update failed")
    return {"success": True, "message": "Primary image updated successfully"}


@app.delete("/word-images/{image_id}", response_model=dict)
async def delete_word_image(
    image_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)  # Only admins can delete
):
    """Delete a word image (admin only)"""
    success = await WordImageCRUD.delete_by_id(db, image_id)
    if not success:
        raise HTTPException(status_code=404, detail="Image not found or deletion failed")
    return {"success": True, "message": "Image deleted successfully"}


@app.get("/word-images/single/{image_id}", response_model=WordImageResponse)
async def get_word_image_by_id(
    image_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific word image by its ID"""
    image = await WordImageCRUD.get_by_id(db, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    return WordImageResponse.from_attributes(image)


@app.get("/categories/{category_id}/images", response_model=List[WordImageResponse])
async def get_images_by_category(
    category_id: int,
    primary_only: bool = Query(False, description="Get only primary images"),
    skip: int = Query(0, ge=0, description="Number of images to skip"),
    limit: int = Query(50, ge=1, le=100, description="Number of images to return"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all images for words in a specific category"""
    query = (
        select(WordImage)
        .join(KazakhWord)
        .where(KazakhWord.category_id == category_id)
        .offset(skip)
        .limit(limit)
        .order_by(WordImage.created_at.desc())
    )
    
    if primary_only:
        query = query.where(WordImage.is_primary == True)
    
    result = await db.execute(query)
    images = result.scalars().all()
    
    return [WordImageResponse.from_attributes(img) for img in images]

# Add these endpoints to your main.py file

@app.post("/word-images/", response_model=WordImageResponse, status_code=201)
async def create_word_image(
    image_data: WordImageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)  # Only admins can create images
):
    """Create a new word image (admin only)
    
    Note: If you are sending a Windows file path in JSON, use forward slashes (/) or double backslashes (\\).
    Example:
        "image_url": "D:/python/KazakhLearn/images/1.jpg"
        or
        "image_url": "D:\\\\python\\\\KazakhLearn\\\\images\\\\1.jpg"
    """
    # Convert single backslashes to double backslashes in image_url for Windows compatibility
    safe_image_url = image_data.image_url.replace('\\', '\\\\') if image_data.image_url else None
    
    new_image = await WordImageCRUD.create(
        db,
        kazakh_word_id=image_data.kazakh_word_id,
        image_url=safe_image_url,
        image_type=image_data.image_type,
        alt_text=image_data.alt_text,
        is_primary=image_data.is_primary,
        source=image_data.source
    )
    return WordImageResponse.from_attributes(new_image)


@app.get("/word-images/{word_id}", response_model=List[WordImageResponse])
async def get_word_images_by_word_id(
    word_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all images for a given Kazakh word ID"""
    images = await WordImageCRUD.get_by_word_id(db, word_id)
    return [WordImageResponse.from_attributes(img) for img in images]


@app.get("/word-images/primary/{word_id}", response_model=Optional[WordImageResponse])
async def get_primary_word_image(
    word_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the primary image for a given Kazakh word ID"""
    image = await WordImageCRUD.get_primary_by_word_id(db, word_id)
    if not image:
        return None
    return WordImageResponse.from_attributes(image)

# Add these endpoints to your main.py file

# Import the new CRUD classes and schemas
from database.crud import ExampleSentenceCRUD, ExampleSentenceTranslationCRUD
from database.schemas import (
    ExampleSentenceCreate, ExampleSentenceUpdate, ExampleSentenceDetailResponse,
    ExampleSentenceTranslationCreate, ExampleSentenceTranslationUpdate,
    ExampleSentenceListResponse, BulkExampleSentenceCreate,
    SearchExampleSentencesRequest, ExampleSentenceStats
)

# ===== EXAMPLE SENTENCES ENDPOINTS =====

@app.post("/example-sentences/", response_model=ExampleSentenceDetailResponse, status_code=201)
async def create_example_sentence(
    sentence_data: ExampleSentenceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)  # Only admins can create
):
    """Create a new example sentence (admin only)"""
    
    # Verify that the word exists
    word = await KazakhWordCRUD.get_by_id(db, sentence_data.kazakh_word_id)
    if not word:
        raise HTTPException(status_code=404, detail="Kazakh word not found")
    
    new_sentence = await ExampleSentenceCRUD.create(
        db,
        kazakh_word_id=sentence_data.kazakh_word_id,
        kazakh_sentence=sentence_data.kazakh_sentence,
        difficulty_level=sentence_data.difficulty_level,
        usage_context=sentence_data.usage_context
    )
    
    # Get the sentence with all relationships loaded
    sentence_with_details = await ExampleSentenceCRUD.get_by_id(
        db, new_sentence.id, get_user_language_preference(current_user)
    )
    
    return ExampleSentenceDetailResponse(
        id=sentence_with_details.id,
        kazakh_sentence=sentence_with_details.kazakh_sentence,
        difficulty_level=sentence_with_details.difficulty_level,
        usage_context=sentence_with_details.usage_context,
        created_at=sentence_with_details.created_at,
        translations=[
            ExampleSentenceTranslationResponse.from_orm_with_language(t)
            for t in sentence_with_details.translations
        ],
        kazakh_word={
            "id": sentence_with_details.kazakh_word.id,
            "kazakh_word": sentence_with_details.kazakh_word.kazakh_word,
            "kazakh_cyrillic": sentence_with_details.kazakh_word.kazakh_cyrillic
        } if sentence_with_details.kazakh_word else None
    )


@app.get("/example-sentences/{sentence_id}", response_model=ExampleSentenceDetailResponse)
async def get_example_sentence(
    sentence_id: int,
    language_code: Optional[str] = Query(None, description="Language code for translations"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get example sentence by ID with translations"""
    
    if not language_code:
        language_code = get_user_language_preference(current_user)
    
    sentence = await ExampleSentenceCRUD.get_by_id(db, sentence_id, language_code)
    if not sentence:
        raise HTTPException(status_code=404, detail="Example sentence not found")
    
    return ExampleSentenceDetailResponse(
        id=sentence.id,
        kazakh_sentence=sentence.kazakh_sentence,
        difficulty_level=sentence.difficulty_level,
        usage_context=sentence.usage_context,
        created_at=sentence.created_at,
        translations=[
            ExampleSentenceTranslationResponse.from_orm_with_language(t)
            for t in sentence.translations
        ],
        kazakh_word={
            "id": sentence.kazakh_word.id,
            "kazakh_word": sentence.kazakh_word.kazakh_word,
            "kazakh_cyrillic": sentence.kazakh_word.kazakh_cyrillic
        } if sentence.kazakh_word else None
    )


@app.put("/example-sentences/{sentence_id}", response_model=ExampleSentenceDetailResponse)
async def update_example_sentence(
    sentence_id: int,
    sentence_data: ExampleSentenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)  # Only admins can update
):
    """Update example sentence (admin only)"""
    
    updated_sentence = await ExampleSentenceCRUD.update(
        db,
        sentence_id,
        kazakh_sentence=sentence_data.kazakh_sentence,
        difficulty_level=sentence_data.difficulty_level,
        usage_context=sentence_data.usage_context
    )
    
    if not updated_sentence:
        raise HTTPException(status_code=404, detail="Example sentence not found")
    
    # Get the sentence with all relationships loaded
    sentence_with_details = await ExampleSentenceCRUD.get_by_id(
        db, sentence_id, get_user_language_preference(current_user)
    )
    
    return ExampleSentenceDetailResponse(
        id=sentence_with_details.id,
        kazakh_sentence=sentence_with_details.kazakh_sentence,
        difficulty_level=sentence_with_details.difficulty_level,
        usage_context=sentence_with_details.usage_context,
        created_at=sentence_with_details.created_at,
        translations=[
            ExampleSentenceTranslationResponse.from_orm_with_language(t)
            for t in sentence_with_details.translations
        ],
        kazakh_word={
            "id": sentence_with_details.kazakh_word.id,
            "kazakh_word": sentence_with_details.kazakh_word.kazakh_word,
            "kazakh_cyrillic": sentence_with_details.kazakh_word.kazakh_cyrillic
        } if sentence_with_details.kazakh_word else None
    )


@app.delete("/example-sentences/{sentence_id}", response_model=dict)
async def delete_example_sentence(
    sentence_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)  # Only admins can delete
):
    """Delete example sentence (admin only)"""
    
    success = await ExampleSentenceCRUD.delete(db, sentence_id)
    if not success:
        raise HTTPException(status_code=404, detail="Example sentence not found")
    
    return {"success": True, "message": "Example sentence deleted successfully"}


@app.get("/words/{word_id}/example-sentences", response_model=List[ExampleSentenceDetailResponse])
async def get_word_example_sentences(
    word_id: int,
    language_code: Optional[str] = Query(None, description="Language code for translations"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all example sentences for a specific word"""
    
    if not language_code:
        language_code = get_user_language_preference(current_user)
    
    # Verify word exists
    word = await KazakhWordCRUD.get_by_id(db, word_id)
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    
    sentences = await ExampleSentenceCRUD.get_by_word_id(db, word_id, language_code)
    
    response_sentences = []
    for sentence in sentences:
        response_sentences.append(ExampleSentenceDetailResponse(
            id=sentence.id,
            kazakh_sentence=sentence.kazakh_sentence,
            difficulty_level=sentence.difficulty_level,
            usage_context=sentence.usage_context,
            created_at=sentence.created_at,
            translations=[
                ExampleSentenceTranslationResponse.from_orm_with_language(t)
                for t in sentence.translations
            ]
        ))
    
    return response_sentences


# ===== EXAMPLE SENTENCE TRANSLATIONS ENDPOINTS =====

@app.post("/example-sentence-translations/", response_model=ExampleSentenceTranslationResponse, status_code=201)
async def create_example_sentence_translation(
    translation_data: ExampleSentenceTranslationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)  # Only admins can create
):
    """Create a new example sentence translation (admin only)"""
    
    # Verify sentence exists
    sentence = await ExampleSentenceCRUD.get_by_id(db, translation_data.example_sentence_id)
    if not sentence:
        raise HTTPException(status_code=404, detail="Example sentence not found")
    
    # Verify language exists
    language = await LanguageCRUD.get_by_code(db, translation_data.language_code)
    if not language:
        raise HTTPException(status_code=404, detail="Language not found")
    
    # Check if translation already exists for this sentence and language
    existing_translation = await ExampleSentenceTranslationCRUD.get_by_sentence_and_language(
        db, translation_data.example_sentence_id, translation_data.language_code
    )
    if existing_translation:
        raise HTTPException(
            status_code=400, 
            detail="Translation already exists for this sentence and language"
        )
    
    new_translation = await ExampleSentenceTranslationCRUD.create(
        db,
        example_sentence_id=translation_data.example_sentence_id,
        language_id=language.id,
        translated_sentence=translation_data.translated_sentence
    )
    
    return ExampleSentenceTranslationResponse(
        id=new_translation.id,
        translated_sentence=new_translation.translated_sentence,
        language_code=translation_data.language_code,
        created_at=new_translation.created_at
    )


@app.put("/example-sentence-translations/{translation_id}", response_model=ExampleSentenceTranslationResponse)
async def update_example_sentence_translation(
    translation_id: int,
    translation_data: ExampleSentenceTranslationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)  # Only admins can update
):
    """Update example sentence translation (admin only)"""
    
    updated_translation = await ExampleSentenceTranslationCRUD.update(
        db, translation_id, translation_data.translated_sentence
    )
    
    if not updated_translation:
        raise HTTPException(status_code=404, detail="Translation not found")
    
    # Get language code for response
    language = await LanguageCRUD.get_by_id(db, updated_translation.language_id)
    
    return ExampleSentenceTranslationResponse(
        id=updated_translation.id,
        translated_sentence=updated_translation.translated_sentence,
        language_code=language.language_code if language else "unknown",
        created_at=updated_translation.created_at
    )


@app.delete("/example-sentence-translations/{translation_id}", response_model=dict)
async def delete_example_sentence_translation(
    translation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)  # Only admins can delete
):
    """Delete example sentence translation (admin only)"""
    
    success = await ExampleSentenceTranslationCRUD.delete(db, translation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Translation not found")
    
    return {"success": True, "message": "Translation deleted successfully"}


@app.get("/example-sentences/{sentence_id}/translations", response_model=List[ExampleSentenceTranslationResponse])
async def get_sentence_translations(
    sentence_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all translations for an example sentence"""
    
    # Verify sentence exists
    sentence = await ExampleSentenceCRUD.get_by_id(db, sentence_id)
    if not sentence:
        raise HTTPException(status_code=404, detail="Example sentence not found")
    
    translations = await ExampleSentenceTranslationCRUD.get_all_for_sentence(db, sentence_id)
    
    return [
        ExampleSentenceTranslationResponse(
            id=t.id,
            translated_sentence=t.translated_sentence,
            language_code=t.language.language_code,
            created_at=t.created_at
        )
        for t in translations
    ]


# ===== BULK OPERATIONS =====

@app.post("/example-sentences/bulk", response_model=List[ExampleSentenceDetailResponse], status_code=201)
async def create_bulk_example_sentences(
    bulk_data: BulkExampleSentenceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)  # Only admins can create
):
    """Create multiple example sentences with translations (admin only)"""
    
    # Verify word exists
    word = await KazakhWordCRUD.get_by_id(db, bulk_data.kazakh_word_id)
    if not word:
        raise HTTPException(status_code=404, detail="Kazakh word not found")
    
    created_sentences = []
    
    for sentence_data in bulk_data.sentences:
        # Create the sentence
        new_sentence = await ExampleSentenceCRUD.create(
            db,
            kazakh_word_id=bulk_data.kazakh_word_id,
            kazakh_sentence=sentence_data["kazakh_sentence"],
            difficulty_level=sentence_data.get("difficulty_level", 1),
            usage_context=sentence_data.get("usage_context")
        )
        
        # Create translations if provided
        translations = []
        if "translations" in sentence_data:
            for lang_code, translation_text in sentence_data["translations"].items():
                language = await LanguageCRUD.get_by_code(db, lang_code)
                if language:
                    translation = await ExampleSentenceTranslationCRUD.create(
                        db,
                        example_sentence_id=new_sentence.id,
                        language_id=language.id,
                        translated_sentence=translation_text
                    )
                    translations.append(ExampleSentenceTranslationResponse(
                        id=translation.id,
                        translated_sentence=translation.translated_sentence,
                        language_code=lang_code,
                        created_at=translation.created_at
                    ))
        
        created_sentences.append(ExampleSentenceDetailResponse(
            id=new_sentence.id,
            kazakh_sentence=new_sentence.kazakh_sentence,
            difficulty_level=new_sentence.difficulty_level,
            usage_context=new_sentence.usage_context,
            created_at=new_sentence.created_at,
            translations=translations
        ))
    
    return created_sentences


# ===== SEARCH AND STATISTICS =====

@app.post("/example-sentences/search", response_model=ExampleSentenceListResponse)
async def search_example_sentences(
    search_request: SearchExampleSentencesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Search example sentences with filters"""
    
    # Build query
    query = select(ExampleSentence).options(
        selectinload(ExampleSentence.translations).selectinload(ExampleSentenceTranslation.language),
        selectinload(ExampleSentence.kazakh_word)
    )
    
    # Apply filters
    if search_request.word_id:
        query = query.where(ExampleSentence.kazakh_word_id == search_request.word_id)
    
    if search_request.difficulty_level:
        query = query.where(ExampleSentence.difficulty_level == search_request.difficulty_level)
    
    if search_request.usage_context:
        query = query.where(ExampleSentence.usage_context.ilike(f"%{search_request.usage_context}%"))
    
    if search_request.search_term:
        query = query.where(
            or_(
                ExampleSentence.kazakh_sentence.ilike(f"%{search_request.search_term}%"),
                ExampleSentence.usage_context.ilike(f"%{search_request.search_term}%")
            )
        )
    
    # Get total count
    count_query = select(func.count(ExampleSentence.id)).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total_count = total_result.scalar()
    
    # Apply pagination and ordering
    offset = (search_request.page - 1) * search_request.page_size
    query = query.offset(offset).limit(search_request.page_size).order_by(ExampleSentence.created_at.desc())
    
    # Execute query
    result = await db.execute(query)
    sentences = result.scalars().all()
    
    # Filter translations by language and build response
    response_sentences = []
    for sentence in sentences:
        filtered_translations = [
            t for t in sentence.translations
            if t.language.language_code == search_request.language_code
        ]
        
        response_sentences.append(ExampleSentenceDetailResponse(
            id=sentence.id,
            kazakh_sentence=sentence.kazakh_sentence,
            difficulty_level=sentence.difficulty_level,
            usage_context=sentence.usage_context,
            created_at=sentence.created_at,
            translations=[
                ExampleSentenceTranslationResponse.from_orm_with_language(t)
                for t in filtered_translations
            ],
            kazakh_word={
                "id": sentence.kazakh_word.id,
                "kazakh_word": sentence.kazakh_word.kazakh_word,
                "kazakh_cyrillic": sentence.kazakh_word.kazakh_cyrillic
            } if sentence.kazakh_word else None
        ))
    
    has_more = total_count > (offset + search_request.page_size)
    
    return ExampleSentenceListResponse(
        sentences=response_sentences,
        total_count=total_count,
        page=search_request.page,
        page_size=search_request.page_size,
        has_more=has_more
    )


@app.get("/example-sentences/statistics", response_model=ExampleSentenceStats)
async def get_example_sentence_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)  # Only admins can view stats
):
    """Get statistics about example sentences (admin only)"""
    
    # Total sentences
    total_result = await db.execute(select(func.count(ExampleSentence.id)))
    total_sentences = total_result.scalar() or 0
    
    # Sentences by difficulty level
    difficulty_result = await db.execute(
        select(
            ExampleSentence.difficulty_level,
            func.count(ExampleSentence.id)
        ).group_by(ExampleSentence.difficulty_level)
    )
    sentences_by_difficulty = {
        level: count for level, count in difficulty_result
    }
    
    # Sentences by word type
    word_type_result = await db.execute(
        select(
            WordType.type_name,
            func.count(ExampleSentence.id)
        )
        .select_from(ExampleSentence)
        .join(KazakhWord, ExampleSentence.kazakh_word_id == KazakhWord.id)
        .join(WordType, KazakhWord.word_type_id == WordType.id)
        .group_by(WordType.type_name)
    )
    sentences_by_word_type = {
        word_type: count for word_type, count in word_type_result
    }
    
    # Sentences with translations
    translated_result = await db.execute(
        select(func.count(func.distinct(ExampleSentence.id)))
        .select_from(ExampleSentence)
        .join(ExampleSentenceTranslation, ExampleSentence.id == ExampleSentenceTranslation.example_sentence_id)
    )
    sentences_with_translations = translated_result.scalar() or 0
    
    # Average difficulty
    avg_difficulty_result = await db.execute(
        select(func.avg(ExampleSentence.difficulty_level))
    )
    average_difficulty = float(avg_difficulty_result.scalar() or 0)
    
    # Most common contexts
    context_result = await db.execute(
        select(
            ExampleSentence.usage_context,
            func.count(ExampleSentence.id)
        )
        .where(ExampleSentence.usage_context.isnot(None))
        .group_by(ExampleSentence.usage_context)
        .order_by(func.count(ExampleSentence.id).desc())
        .limit(10)
    )
    most_common_contexts = [
        {"context": context, "count": count}
        for context, count in context_result
    ]
    
    return ExampleSentenceStats(
        total_sentences=total_sentences,
        sentences_by_difficulty=sentences_by_difficulty,
        sentences_by_word_type=sentences_by_word_type,
        sentences_with_translations=sentences_with_translations,
        average_difficulty=round(average_difficulty, 2),
        most_common_contexts=most_common_contexts
    )


# ===== ADDITIONAL UTILITY ENDPOINTS =====

@app.get("/example-sentences/by-difficulty/{difficulty_level}", response_model=List[ExampleSentenceDetailResponse])
async def get_sentences_by_difficulty(
    difficulty_level: int = Path(..., ge=1, le=5, description="Difficulty level (1-5)"),
    language_code: Optional[str] = Query(None, description="Language code for translations"),
    skip: int = Query(0, ge=0, description="Number of sentences to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of sentences to return"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get example sentences by difficulty level"""
    
    if not language_code:
        language_code = get_user_language_preference(current_user)
    
    query = (
        select(ExampleSentence)
        .options(
            selectinload(ExampleSentence.translations).selectinload(ExampleSentenceTranslation.language),
            selectinload(ExampleSentence.kazakh_word)
        )
        .where(ExampleSentence.difficulty_level == difficulty_level)
        .offset(skip)
        .limit(limit)
        .order_by(ExampleSentence.created_at.desc())
    )
    
    result = await db.execute(query)
    sentences = result.scalars().all()
    
    response_sentences = []
    for sentence in sentences:
        filtered_translations = [
            t for t in sentence.translations
            if t.language.language_code == language_code
        ]
        
        response_sentences.append(ExampleSentenceDetailResponse(
            id=sentence.id,
            kazakh_sentence=sentence.kazakh_sentence,
            difficulty_level=sentence.difficulty_level,
            usage_context=sentence.usage_context,
            created_at=sentence.created_at,
            translations=[
                ExampleSentenceTranslationResponse.from_orm_with_language(t)
                for t in filtered_translations
            ],
            kazakh_word={
                "id": sentence.kazakh_word.id,
                "kazakh_word": sentence.kazakh_word.kazakh_word,
                "kazakh_cyrillic": sentence.kazakh_word.kazakh_cyrillic
            } if sentence.kazakh_word else None
        ))
    
    return response_sentences


@app.get("/example-sentences/random", response_model=List[ExampleSentenceDetailResponse])
async def get_random_example_sentences(
    count: int = Query(5, ge=1, le=20, description="Number of random sentences"),
    difficulty_level: Optional[int] = Query(None, ge=1, le=5, description="Filter by difficulty level"),
    word_type_id: Optional[int] = Query(None, description="Filter by word type"),
    category_id: Optional[int] = Query(None, description="Filter by category"),
    language_code: Optional[str] = Query(None, description="Language code for translations"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get random example sentences for practice"""
    
    if not language_code:
        language_code = get_user_language_preference(current_user)
    
    query = (
        select(ExampleSentence)
        .options(
            selectinload(ExampleSentence.translations).selectinload(ExampleSentenceTranslation.language),
            selectinload(ExampleSentence.kazakh_word)
        )
        .order_by(func.random())
        .limit(count)
    )
    
    # Apply filters
    if difficulty_level:
        query = query.where(ExampleSentence.difficulty_level == difficulty_level)
    
    if word_type_id or category_id:
        query = query.join(KazakhWord, ExampleSentence.kazakh_word_id == KazakhWord.id)
        if word_type_id:
            query = query.where(KazakhWord.word_type_id == word_type_id)
        if category_id:
            query = query.where(KazakhWord.category_id == category_id)
    
    result = await db.execute(query)
    sentences = result.scalars().all()
    
    response_sentences = []
    for sentence in sentences:
        filtered_translations = [
            t for t in sentence.translations
            if t.language.language_code == language_code
        ]
        
        response_sentences.append(ExampleSentenceDetailResponse(
            id=sentence.id,
            kazakh_sentence=sentence.kazakh_sentence,
            difficulty_level=sentence.difficulty_level,
            usage_context=sentence.usage_context,
            created_at=sentence.created_at,
            translations=[
                ExampleSentenceTranslationResponse.from_orm_with_language(t)
                for t in filtered_translations
            ],
            kazakh_word={
                "id": sentence.kazakh_word.id,
                "kazakh_word": sentence.kazakh_word.kazakh_word,
                "kazakh_cyrillic": sentence.kazakh_word.kazakh_cyrillic
            } if sentence.kazakh_word else None
        ))
    
    return response_sentences

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)