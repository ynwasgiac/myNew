import json
import logging
from typing import List
from services.translation_service import translation_service

logger = logging.getLogger(__name__)

class AITranslationExtension:
    """Extension class that adds missing methods to translation service"""
    
    def __init__(self, base_service):
        self.base_service = base_service
    
    async def _get_available_model(self) -> str:
        """Get the best available model for translation"""
        if not self.base_service.client:
            raise ValueError("OpenAI client not initialized")
        
        # Return preferred model
        return self.base_service.preferred_model
    
    async def get_translation_models(self) -> List[str]:
        """Get list of available translation models"""
        return self.base_service.json_models.copy()
    
    async def get_supported_languages(self) -> List[str]:
        """Get list of supported language codes"""
        return list(self.base_service.language_prompts.keys())
    
    async def test_translation(self) -> bool:
        """Test basic translation functionality"""
        if not self.base_service.client:
            logger.error("Cannot test translation: OpenAI client not initialized")
            return False
        
        try:
            logger.info("Testing translation service...")
            
            # Get available model
            model = self.base_service.preferred_model
            
            # Simple test translation
            response = await self.base_service.client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system", 
                        "content": "You are a translator. Respond with valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": 'Translate "test" to English. Format: {"translation": "test", "confidence": 0.95}'
                    }
                ],
                max_tokens=50,
                temperature=0.3
            )
            
            response_text = response.choices[0].message.content
            # Try to parse JSON to verify service is working
            json.loads(response_text)
            
            logger.info("Translation test successful")
            return True
            
        except Exception as e:
            logger.error(f"Translation test failed: {e}")
            return False
    
    def __getattr__(self, name):
        """Delegate all other attributes to base service"""
        return getattr(self.base_service, name)

# Create extended translation service
extended_translation_service = AITranslationExtension(translation_service)