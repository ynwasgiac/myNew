# ai_routes.py
import json
import logging
from datetime import datetime
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from database.auth_models import User
from database.crud import LanguageCRUD
from auth.dependencies import get_current_admin
from services.translation_service import translation_service
from ai_models import (
    GenerateExampleSentenceRequest,
    TranslateSentenceRequest,
    BatchTranslateSentenceRequest,
    GeneratedSentenceResponse,
    TranslatedSentenceResponse,
    AIServiceStatus
)

# Set up logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/ai", tags=["AI Services"])

def clean_json_response(response_text: str) -> str:
    """Clean JSON response from markdown formatting"""
    if not response_text:
        return "{}"

    # Remove markdown JSON formatting
    if response_text.strip().startswith('```json'):
        # Find the content between ```json and ```
        start_marker = '```json'
        end_marker = '```'

        start_idx = response_text.find(start_marker)
        if start_idx != -1:
            start_idx += len(start_marker)
            end_idx = response_text.find(end_marker, start_idx)
            if end_idx != -1:
                response_text = response_text[start_idx:end_idx].strip()

    # Remove other common markdown formatting
    response_text = response_text.strip()
    if response_text.startswith('```') and response_text.endswith('```'):
        lines = response_text.split('\\n')
        if len(lines) > 2:
            response_text = '\\n'.join(lines[1:-1])

    return response_text.strip()


# ===== AI ENDPOINTS =====

@router.post("/generate-example-sentence", response_model=GeneratedSentenceResponse)
async def generate_example_sentence(
        request: GenerateExampleSentenceRequest,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)  # Only admins can generate
):
    """Generate an example sentence using AI (admin only)"""

    try:
        logger.info(f"Generating example sentence for word: {request.kazakh_word}")

        # Create prompt for sentence generation
        sentence_length_guide = {
            "short": "3-5 words",
            "medium": "5-8 words",
            "long": "8-12 words"
        }
        length_guide = sentence_length_guide.get(request.sentence_length, "5-8 words")

        prompt = f"""You are an expert Kazakh language teacher creating example sentences for language learners.

TASK: Create a natural, grammatically correct example sentence using the Kazakh word "{request.kazakh_word}".

REQUIREMENTS:
- Use the word "{request.kazakh_word}" naturally in the sentence
- Difficulty level: {request.difficulty_level}/5 (1=beginner, 5=advanced)
- Context: {request.usage_context}
- Sentence length: {length_guide}
- Make it practical and useful for learners
- Ensure proper Kazakh grammar and word order
- Use common, everyday vocabulary appropriate for the difficulty level

RESPONSE FORMAT (JSON only):
{{
    "kazakh_sentence": "example sentence here",
    "difficulty_level": {request.difficulty_level},
    "usage_context": "{request.usage_context}",
    "confidence": 0.95,
    "explanation": "brief explanation of grammar or word usage"
}}

Respond with valid JSON only."""

        # Get OpenAI client
        if not translation_service.client:
            raise HTTPException(
                status_code=503,
                detail="AI service unavailable: OpenAI API key not configured"
            )

        # Get available model
        model = translation_service.preferred_model

        # Make API call
        response = await translation_service.client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert Kazakh language teacher who creates high-quality example sentences for language learning. Always respond with valid JSON format exactly as requested."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_tokens=300
        )

        # Parse response
        response_text = response.choices[0].message.content
        cleaned_response = clean_json_response(response_text)

        try:
            generated_data = json.loads(cleaned_response)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response after cleaning: {cleaned_response}")
            logger.error(f"Original response: {response_text}")
            raise HTTPException(
                status_code=500,
                detail="Failed to generate sentence: Invalid AI response format"
            )

        # Validate and return response
        return GeneratedSentenceResponse(
            kazakh_sentence=generated_data.get("kazakh_sentence", ""),
            difficulty_level=generated_data.get("difficulty_level", request.difficulty_level),
            usage_context=generated_data.get("usage_context", request.usage_context),
            confidence=float(generated_data.get("confidence", 0.8)),
            generated_at=datetime.utcnow()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating example sentence: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate example sentence: {str(e)}"
        )


@router.post("/translate-sentence", response_model=TranslatedSentenceResponse)
async def translate_sentence_with_ai(
        request: TranslateSentenceRequest,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)  # Only admins can translate
):
    """Translate a sentence using AI (admin only)"""

    def clean_json_response(response_text: str) -> str:
        """Clean JSON response from markdown formatting"""
        if not response_text:
            return "{}"
        
        # Remove markdown JSON formatting
        if response_text.strip().startswith('```json'):
            # Find the content between ```json and ```
            start_marker = '```json'
            end_marker = '```'
            
            start_idx = response_text.find(start_marker)
            if start_idx != -1:
                start_idx += len(start_marker)
                end_idx = response_text.find(end_marker, start_idx)
                if end_idx != -1:
                    response_text = response_text[start_idx:end_idx].strip()
        
        # Remove other common markdown formatting
        response_text = response_text.strip()
        if response_text.startswith('```') and response_text.endswith('```'):
            lines = response_text.split('\n')
            if len(lines) > 2:
                response_text = '\n'.join(lines[1:-1])
        
        return response_text.strip()

    try:
        logger.info(f"Translating sentence to {request.target_language_name}: {request.kazakh_sentence}")

        # Verify target language exists in database
        language = await LanguageCRUD.get_by_code(db, request.target_language_code)
        if not language:
            raise HTTPException(
                status_code=400,
                detail=f"Language '{request.target_language_code}' not found"
            )

        # Create translation prompt
        context_part = f"\nContext: {request.context}" if request.context else ""

        prompt = f"""You are an expert translator specializing in Kazakh language with deep cultural knowledge.

TASK: Translate the following Kazakh sentence into {request.target_language_name} with high accuracy.

SOURCE SENTENCE: "{request.kazakh_sentence}"{context_part}

REQUIREMENTS:
1. Provide accurate, natural translation that preserves meaning
2. Use appropriate register and style for {request.target_language_name}
3. Consider cultural context and idiomatic expressions
4. Maintain grammatical correctness in target language
5. Ensure the translation sounds natural to native speakers
6. For sentences with cultural references, adapt appropriately

RESPONSE FORMAT (JSON only):
{{
    "translated_sentence": "translation here",
    "confidence": 0.95,
    "language_code": "{request.target_language_code}",
    "language_name": "{request.target_language_name}",
    "notes": "optional explanation of translation choices"
}}

Respond with valid JSON only."""

        # Get OpenAI client
        if not translation_service.client:
            raise HTTPException(
                status_code=503,
                detail="AI service unavailable: OpenAI API key not configured"
            )

        # Use preferred model directly instead of missing method
        model = translation_service.preferred_model

        # Make API call
        response = await translation_service.client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": f"You are an expert translator specializing in Kazakh to {request.target_language_name} translation. Always respond with valid JSON format exactly as requested."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3,  # Lower temperature for more consistent translations
            max_tokens=200
        )

        # Parse response with cleaning
        response_text = response.choices[0].message.content
        cleaned_response = clean_json_response(response_text)

        try:
            translation_data = json.loads(cleaned_response)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI translation response after cleaning: {cleaned_response}")
            logger.error(f"Original response: {response_text}")
            raise HTTPException(
                status_code=500,
                detail="Failed to translate sentence: Invalid AI response format"
            )

        # Validate and return response
        return TranslatedSentenceResponse(
            translated_sentence=translation_data.get("translated_sentence", ""),
            confidence=float(translation_data.get("confidence", 0.8)),
            language_code=request.target_language_code,
            language_name=request.target_language_name,
            translated_at=datetime.utcnow()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error translating sentence: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to translate sentence: {str(e)}"
        )


@router.post("/batch-translate-sentence")
async def batch_translate_sentence(
        request: BatchTranslateSentenceRequest,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)  # Only admins can translate
):
    """Translate a sentence to multiple languages using AI (admin only)"""

    try:
        # Verify all target languages exist
        languages = {}
        for lang_code in request.target_languages:
            language = await LanguageCRUD.get_by_code(db, lang_code)
            if not language:
                raise HTTPException(
                    status_code=400,
                    detail=f"Language '{lang_code}' not found"
                )
            languages[lang_code] = language

        # Create translation tasks
        results = {}
        for lang_code, language in languages.items():
            try:
                translate_request = TranslateSentenceRequest(
                    kazakh_sentence=request.kazakh_sentence,
                    target_language_code=lang_code,
                    target_language_name=language.language_name,
                    context=request.context
                )
                result = await translate_sentence_with_ai(translate_request, db=db, current_user=current_user)
                results[lang_code] = result
            except Exception as e:
                logger.error(f"Translation failed for {lang_code}: {e}")
                # Create error response
                results[lang_code] = TranslatedSentenceResponse(
                    translated_sentence="Translation failed",
                    confidence=0.0,
                    language_code=lang_code,
                    language_name=languages[lang_code].language_name,
                    translated_at=datetime.utcnow()
                )

        return results

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in batch translation: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Batch translation failed: {str(e)}"
        )


# ===== AI SERVICE STATUS ENDPOINT =====

@router.get("/status", response_model=AIServiceStatus)
async def get_ai_service_status(
        current_user: User = Depends(get_current_admin)  # Only admins can check status
):
    """Check AI service availability and configuration (admin only)"""

    try:
        # Check if translation service is available
        is_available = translation_service.validate_api_key()

        # Test basic functionality if available
        test_successful = False
        available_models = []

        if is_available:
            try:
                # Простой тест OpenAI API
                test_response = await translation_service.client.chat.completions.create(
                    model=translation_service.preferred_model,
                    messages=[
                        {"role": "system", "content": "Test"},
                        {"role": "user", "content": "Test"}
                    ],
                    max_tokens=10
                )
                test_successful = True
            except:
                test_successful = False

            available_models = translation_service.json_models

        return AIServiceStatus(
            service_available=is_available,
            test_successful=test_successful,
            available_models=available_models,
            features={
                "sentence_generation": is_available,
                "sentence_translation": is_available,
                "batch_translation": is_available
            },
            status="operational" if is_available and test_successful else "limited" if is_available else "unavailable",
            last_checked=datetime.utcnow().isoformat()
        )

    except Exception as e:
        logger.error(f"Error checking AI service status: {e}")
        return AIServiceStatus(
            service_available=False,
            test_successful=False,
            available_models=[],
            features={
                "sentence_generation": False,
                "sentence_translation": False,
                "batch_translation": False
            },
            status="error",
            error=str(e),
            last_checked=datetime.utcnow().isoformat()
        )