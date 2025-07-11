# services/translation_service.py
import os
import asyncio
import logging
import re
from typing import List, Dict, Optional, Tuple, Union
from openai import AsyncOpenAI
from pydantic import BaseModel
import json

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# Set up logging
logger = logging.getLogger(__name__)

class TranslationRequest(BaseModel):
    kazakh_word: str
    kazakh_cyrillic: Optional[str] = None
    target_language_code: str
    target_language_name: str
    context: Optional[str] = None

class TranslationResult(BaseModel):
    primary_translation: str
    alternative_translations: List[str]
    confidence: float
    language_code: str
    language_name: str

class TranslationService:
    def __init__(self):
        # Get API key from environment variable
        api_key = os.getenv('OPENAI_API_KEY')
        
        if not api_key:
            logger.error("OPENAI_API_KEY environment variable not found")
            self.client = None
        else:
            # Initialize OpenAI client with environment variable API key
            self.client = AsyncOpenAI(api_key=api_key)
            logger.info("OpenAI client initialized successfully")
        
        # Available models with JSON support
        self.json_models = [
            "gpt-4-turbo-preview",
            "gpt-4-1106-preview", 
            "gpt-4-0125-preview",
            "gpt-3.5-turbo-1106",
            "gpt-3.5-turbo-0125"
        ]
        
        # Preferred model (will fallback if not available)
        self.preferred_model = "gpt-4-turbo-preview"
        
        # Language mapping for better prompts
        self.language_prompts = {
            'en': 'English',
            'ru': 'Russian (Русский)',
            'zh': 'Chinese Simplified (中文)',
        }

    def validate_api_key(self) -> bool:
        """Check if OpenAI API key is configured and client is available"""
        api_key = os.getenv("OPENAI_API_KEY")
        is_valid = bool(api_key and self.client)
        
        if not api_key:
            logger.warning("OPENAI_API_KEY environment variable is not set")
        elif not self.client:
            logger.warning("OpenAI client could not be initialized")
        else:
            logger.info("OpenAI API key validation successful")
            
        return is_valid

    def _get_language_name(self, language_code: str) -> str:
        """Get full language name from code"""
        return self.language_prompts.get(language_code.lower(), language_code.upper())

    def _create_translation_prompt(self, request: TranslationRequest) -> str:
        """Create a detailed prompt for translation optimized for GPT-4"""
        
        kazakh_word = request.kazakh_word
        cyrillic_part = f" (Cyrillic: {request.kazakh_cyrillic})" if request.kazakh_cyrillic else ""
        context_part = f"\nContext: {request.context}" if request.context else ""
        language_full_name = self._get_language_name(request.target_language_code)
        
        prompt = f"""You are an expert Kazakh language translator with deep knowledge of Central Asian languages and cultures. 

TASK: Translate the following Kazakh word into {language_full_name} with high accuracy and cultural sensitivity.

SOURCE WORD: "{kazakh_word}"{cyrillic_part}{context_part}

REQUIREMENTS:
1. Provide the most accurate and commonly used translation as the primary translation
2. Include one alternative translations or synonyms that could be used in different contexts
3. Consider grammatical forms appropriate for {language_full_name}
4. Ensure cultural appropriateness and natural usage
5. For nouns: consider appropriate singular form unless context suggests plural
6. For verbs: provide infinitive form unless context requires specific tense
7. For adjectives: provide base form
8. Rate your confidence from 0.1 (uncertain) to 1.0 (very confident)

RESPONSE FORMAT (JSON only):
{{
    "primary_translation": "main translation here",
    "alternative_translations": ["alternative 1", "alternative 2", "alternative 3"],
    "confidence": 0.95,
    "notes": "optional explanation of translation choices or cultural context"
}}

LANGUAGE CONTEXT:
- Source: Kazakh (Қазақша) - Turkic language family
- Target: {language_full_name}
- Consider etymology, cognates, and borrowed words where applicable
- Maintain semantic accuracy while ensuring natural expression in target language

Respond with valid JSON only. No additional text outside the JSON structure."""

        return prompt

    async def _get_available_model(self) -> str:
        """Get the best available model for translation"""
        # For now, return the preferred model
        # In a production environment, you might want to test model availability
        return self.preferred_model

    def _validate_json_response(self, response_text: str) -> dict:
        """Validate and clean JSON response from GPT-4"""
        try:
            # Clean the response text
            response_text = response_text.strip()
            
            # Remove any markdown code block markers
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.startswith('```'):
                response_text = response_text[3:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            
            # Parse JSON
            data = json.loads(response_text)
            
            # Validate required fields
            required_fields = ['primary_translation', 'alternative_translations', 'confidence']
            for field in required_fields:
                if field not in data:
                    logger.warning(f"Missing required field: {field}")
                    if field == 'primary_translation':
                        data[field] = ""
                    elif field == 'alternative_translations':
                        data[field] = []
                    elif field == 'confidence':
                        data[field] = 0.8
            
            # Validate data types and constraints
            if not isinstance(data['primary_translation'], str):
                data['primary_translation'] = str(data['primary_translation'])
            
            if not isinstance(data['alternative_translations'], list):
                data['alternative_translations'] = []
            
            # Ensure alternatives are strings
            data['alternative_translations'] = [
                str(alt) for alt in data['alternative_translations'] 
                if alt and str(alt).strip()
            ]
            
            # Validate confidence
            try:
                confidence = float(data['confidence'])
                data['confidence'] = min(max(confidence, 0.1), 1.0)
            except (ValueError, TypeError):
                data['confidence'] = 0.8
            
            return data
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            logger.error(f"Response text: {response_text}")
            
            # Fallback: try to extract translation from text
            primary = self._extract_fallback_translation(response_text)
            return {
                "primary_translation": primary,
                "alternative_translations": [],
                "confidence": 0.5,
                "notes": "Fallback parsing used due to JSON error"
            }

    def _extract_fallback_translation(self, text: str) -> str:
        """Extract translation as fallback when JSON parsing fails"""
        # Try various patterns to extract meaningful translation
        patterns = [
            r'"primary_translation":\s*"([^"]+)"',
            r'primary_translation":\s*"([^"]+)"',
            r'"([^"]+)"\s*(?:is the|means|translates to)',
            r'translation:\s*"?([^"\n]+)"?',
            r'means?\s*"?([^"\n]+)"?',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                translation = match.group(1).strip()
                if translation and len(translation) < 200:  # Reasonable length
                    return translation
        
        # Last resort: take first meaningful line
        lines = text.strip().split('\n')
        for line in lines:
            line = line.strip()
            if line and len(line) < 100 and not line.startswith('{'):
                return line
        
        return "Translation unavailable"

    async def translate_word(self, request: TranslationRequest) -> TranslationResult:
        """Translate a Kazakh word to target language using GPT-4"""
        
        if not self.client:
            raise ValueError("Translation service not available: OpenAI API key not configured")
        
        try:
            logger.info(f"Translating '{request.kazakh_word}' to {request.target_language_name}")
            
            # Get the best available model
            model = await self._get_available_model()
            
            # Create the prompt
            prompt = self._create_translation_prompt(request)
            
            # Make API call to OpenAI with GPT-4
            response = await self.client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert multilingual translator specializing in Kazakh language. You have deep knowledge of Turkic languages, Central Asian cultures, and linguistic patterns. Always respond with valid JSON format exactly as requested. Provide accurate, culturally appropriate translations with high confidence ratings for common words and phrases."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.2,  # Lower temperature for more consistent translations
                max_tokens=800,   # Increased for detailed responses
                top_p=0.9,       # Slightly focused sampling
                frequency_penalty=0.0,
                presence_penalty=0.0,
                response_format={"type": "json_object"}  # GPT-4 Turbo supports this
            )
            
            # Get and validate the response
            response_text = response.choices[0].message.content
            logger.debug(f"Raw GPT-4 response: {response_text}")
            
            translation_data = self._validate_json_response(response_text)
            
            # Extract and clean the translation data
            primary_translation = translation_data.get("primary_translation", "").strip()
            alternative_translations = translation_data.get("alternative_translations", [])
            confidence = translation_data.get("confidence", 0.8)
            notes = translation_data.get("notes", "")
            
            # Clean and validate alternative translations
            cleaned_alternatives = []
            for alt in alternative_translations:
                if isinstance(alt, str) and alt.strip():
                    cleaned_alt = alt.strip()
                    # Avoid duplicates and empty strings
                    if cleaned_alt and cleaned_alt != primary_translation and cleaned_alt not in cleaned_alternatives:
                        cleaned_alternatives.append(cleaned_alt)
            
            # Ensure we have a primary translation
            if not primary_translation:
                raise ValueError("No primary translation received from GPT-4")
            
            # Limit alternatives to 4 for UI purposes
            cleaned_alternatives = cleaned_alternatives[:4]
            
            logger.info(f"Translation successful: '{primary_translation}' (confidence: {confidence:.2f}) with {len(cleaned_alternatives)} alternatives")
            if notes:
                logger.debug(f"Translation notes: {notes}")
            
            return TranslationResult(
                primary_translation=primary_translation,
                alternative_translations=cleaned_alternatives,
                confidence=confidence,
                language_code=request.target_language_code,
                language_name=request.target_language_name
            )
            
        except Exception as e:
            logger.error(f"Translation failed for '{request.kazakh_word}' to {request.target_language_name}: {e}")
            
            # Re-raise with more specific error message
            if "response_format" in str(e):
                raise ValueError(f"Model {model} does not support JSON mode. Please use a compatible model.")
            elif "api_key" in str(e).lower():
                raise ValueError("OpenAI API key is invalid or expired")
            elif "quota" in str(e).lower() or "billing" in str(e).lower():
                raise ValueError("OpenAI API quota exceeded or billing issue")
            else:
                raise ValueError(f"Translation failed: {str(e)}")

    async def translate_to_multiple_languages(
        self, 
        kazakh_word: str, 
        kazakh_cyrillic: Optional[str] = None,
        target_languages: List[Tuple[str, str]] = None,  # [(code, name), ...]
        context: Optional[str] = None
    ) -> Dict[str, TranslationResult]:
        """Translate to multiple languages concurrently with rate limiting"""
        
        if not self.client:
            raise ValueError("Translation service not available: OpenAI API key not configured")
        
        if target_languages is None:
            # Default to common languages for Kazakh learners
            target_languages = [
                ('ru', 'Russian'),
                ('en', 'English'),
                ('zh', 'Chinese')
            ]
        
        logger.info(f"Translating '{kazakh_word}' to {len(target_languages)} languages")
        
        # Create translation requests
        requests = [
            TranslationRequest(
                kazakh_word=kazakh_word,
                kazakh_cyrillic=kazakh_cyrillic,
                target_language_code=lang_code,
                target_language_name=lang_name,
                context=context
            )
            for lang_code, lang_name in target_languages
        ]
        
        # Execute translations with controlled concurrency (to respect rate limits)
        max_concurrent = min(3, len(requests))  # Limit concurrent requests
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def translate_with_semaphore(request):
            async with semaphore:
                return await self.translate_word(request)
        
        try:
            # Execute translations with semaphore control
            tasks = [translate_with_semaphore(request) for request in requests]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results
            translations = {}
            successful_count = 0
            
            for i, result in enumerate(results):
                lang_code = target_languages[i][0]
                lang_name = target_languages[i][1]
                
                if isinstance(result, Exception):
                    logger.error(f"Translation failed for {lang_code} ({lang_name}): {result}")
                    # Create a fallback result
                    translations[lang_code] = TranslationResult(
                        primary_translation="",
                        alternative_translations=[],
                        confidence=0.0,
                        language_code=lang_code,
                        language_name=lang_name
                    )
                else:
                    translations[lang_code] = result
                    successful_count += 1
            
            logger.info(f"Batch translation completed: {successful_count}/{len(target_languages)} successful")
            return translations
            
        except Exception as e:
            logger.error(f"Batch translation failed: {e}")
            raise ValueError(f"Batch translation failed: {str(e)}")

    async def test_translation(self) -> bool:
        """Test the translation service with a simple word"""
        try:
            if not self.validate_api_key():
                logger.error("OpenAI API key not configured or invalid")
                return False
            
            # Test with a common Kazakh greeting
            test_request = TranslationRequest(
                kazakh_word="сәлем",
                kazakh_cyrillic="салем",
                target_language_code="en",
                target_language_name="English"
            )
            
            result = await self.translate_word(test_request)
            
            # Validate the result
            if result.primary_translation and result.confidence > 0:
                logger.info(f"Translation test successful: '{result.primary_translation}' (confidence: {result.confidence:.2f})")
                return True
            else:
                logger.error("Translation test failed: empty or low-confidence result")
                return False
            
        except Exception as e:
            logger.error(f"Translation test failed: {e}")
            return False

    async def get_translation_models(self) -> List[str]:
        """Get list of available translation models"""
        return self.json_models.copy()

    async def get_supported_languages(self) -> Dict[str, str]:
        """Get dictionary of supported language codes and names"""
        return self.language_prompts.copy()

# Global instance
translation_service = TranslationService()

# Convenience functions for the API
async def translate_kazakh_word(
    kazakh_word: str,
    target_language_code: str,
    target_language_name: str,
    kazakh_cyrillic: Optional[str] = None,
    context: Optional[str] = None
) -> TranslationResult:
    """Convenience function to translate a single word"""
    
    request = TranslationRequest(
        kazakh_word=kazakh_word,
        kazakh_cyrillic=kazakh_cyrillic,
        target_language_code=target_language_code,
        target_language_name=target_language_name,
        context=context
    )
    
    return await translation_service.translate_word(request)

async def quick_translate_to_common_languages(
    kazakh_word: str,
    kazakh_cyrillic: Optional[str] = None
) -> Dict[str, TranslationResult]:
    """Quick translation to Russian, English, and Chinese"""
    
    common_languages = [
        ('ru', 'Russian'),
        ('en', 'English'),
        ('zh', 'Chinese')
    ]
    
    return await translation_service.translate_to_multiple_languages(
        kazakh_word=kazakh_word,
        kazakh_cyrillic=kazakh_cyrillic,
        target_languages=common_languages
    )

async def translate_to_languages(
    kazakh_word: str,
    target_language_codes: List[str],
    kazakh_cyrillic: Optional[str] = None,
    context: Optional[str] = None
) -> Dict[str, TranslationResult]:
    """Translate to specific list of languages"""
    
    # Get language names from codes
    target_languages = []
    for code in target_language_codes:
        name = translation_service._get_language_name(code)
        target_languages.append((code, name))
    
    return await translation_service.translate_to_multiple_languages(
        kazakh_word=kazakh_word,
        kazakh_cyrillic=kazakh_cyrillic,
        target_languages=target_languages,
        context=context
    )

# Utility functions for debugging and monitoring
async def test_translation_service() -> Dict[str, Union[str, int, bool, List[str]]]:
    """Comprehensive test of translation service"""
    
    test_results: Dict[str, Union[str, int, bool, List[str]]] = {
        "api_key_configured": translation_service.validate_api_key(),
        "service_available": False,
        "test_translation": None,
        "supported_languages_count": len(translation_service.language_prompts),
        "available_models": await translation_service.get_translation_models(),
        "errors": []
    }
    
    try:
        # Test basic translation
        test_successful = await translation_service.test_translation()
        test_results["service_available"] = test_successful
        
        if test_successful:
            # Test with multiple words
            test_words = ["сәлем", "рахмет", "кітап"]
            for word in test_words:
                try:
                    result = await translate_kazakh_word(word, "en", "English")
                    test_results[f"test_{word}"] = {
                        "translation": result.primary_translation,
                        "confidence": result.confidence,
                        "alternatives_count": len(result.alternative_translations)
                    }
                except Exception as e:
                    if isinstance(test_results["errors"], list):
                        test_results["errors"].append(f"Failed to translate {word}: {str(e)}")
        
    except Exception as e:
        if isinstance(test_results["errors"], list):
            test_results["errors"].append(f"Service test failed: {str(e)}")
    
    return test_results