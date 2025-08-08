# services/word_image_service.py
import os
import asyncio
import logging
import requests
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from PIL import Image, ImageDraw, ImageFont
import httpx
from openai import AsyncOpenAI
import aiofiles
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up logging
logger = logging.getLogger(__name__)

class WordImageService:
    def __init__(self, api_base_url: str, api_token: str = None):
        """
        Initialize the Word Image Service
        
        Args:
            api_base_url: Base URL of your API (e.g., 'http://localhost:8000')
            api_token: API authentication token
        """
        # API Configuration
        self.api_base_url = api_base_url.rstrip('/')
        self.api_token = api_token
        
        # OpenAI Configuration
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not found")
        
        self.openai_client = AsyncOpenAI(api_key=api_key)
        
        # Image Configuration
        self.image_size = (600, 600)
        self.image_format = 'PNG'
        
        # Directory paths
        self.base_image_dir = Path('../kazakh-learn-frontend/public/images/words/categories')
        self.base_image_dir.mkdir(parents=True, exist_ok=True)
        
        # HTTP client for API calls
        self.http_client = None
        
        logger.info("Word Image Service initialized")

    async def __aenter__(self):
        """Async context manager entry"""
        headers = {}
        if self.api_token:
            headers['Authorization'] = f'Bearer {self.api_token}'
        
        self.http_client = httpx.AsyncClient(
            base_url=self.api_base_url,
            headers=headers,
            timeout=30.0
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.http_client:
            await self.http_client.aclose()

    async def get_words_without_images(self) -> List[Dict]:
        """
        Get words that don't have images from the API
        
        Returns:
            List of word dictionaries without images
        """
        try:
            response = await self.http_client.get('/words/without-images')
            response.raise_for_status()
            
            words = response.json()
            logger.info(f"Found {len(words)} words without images")
            return words
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error getting words without images: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Error getting words without images: {e}")
            raise

    async def generate_image_prompt(self, word_data: Dict) -> str:
        """
        Generate an image description prompt using GPT-4
        
        Args:
            word_data: Dictionary containing word information
            
        Returns:
            Generated image prompt for DALL-E
        """
        kazakh_word = word_data.get('kazakh_word', '')
        english_translation = word_data.get('english_translation', '') or word_data.get('translation', '')
        category = word_data.get('category', '') or word_data.get('category_name', '')
        
        # If we don't have translation or category, try to get more context
        if not english_translation and not category:
            logger.warning(f"Missing translation and category for word '{kazakh_word}'. Using generic prompt.")
        
        system_prompt = """You are an expert at creating visual image prompts for educational Kazakh language learning materials. 
Create a detailed, culturally appropriate image description that will help learners associate the Kazakh word with its meaning.

REQUIREMENTS:
1. NO TEXT or letters should appear in the image
2. Focus on visual representation only
3. Use traditional Kazakh/Central Asian cultural elements when appropriate
4. Style should be clean, educational, and suitable for language learning
5. 300x300px square format
6. Bright, clear, and easily recognizable imagery
7. Incorporate Kazakh cultural aesthetics (traditional patterns, colors, landscapes) when relevant

Return only a concise image description prompt, no explanations."""

        # Build context string
        context_parts = []
        if english_translation:
            context_parts.append(f'English meaning: "{english_translation}"')
        if category:
            context_parts.append(f'Category: "{category}"')
        
        context_info = '\n'.join(context_parts) if context_parts else 'No additional context available'

        user_prompt = f"""Kazakh word: "{kazakh_word}"
{context_info}

Create a visual image prompt for this Kazakh word that shows its meaning without any text. Include Kazakh cultural elements where appropriate. If the meaning is unclear, create a generic educational illustration that could represent a Kazakh language concept."""

        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=200
            )
            
            prompt = response.choices[0].message.content.strip()
            logger.debug(f"Generated image prompt for '{kazakh_word}': {prompt}")
            return prompt
            
        except Exception as e:
            logger.error(f"Error generating image prompt for '{kazakh_word}': {e}")
            # Fallback prompt
            fallback_context = english_translation or "a Kazakh concept"
            return f"A clear, simple illustration of {fallback_context}, in traditional Kazakh style with cultural patterns, no text, 300x300px"

    async def generate_word_image(self, word_data: Dict, image_prompt: str) -> str:
        """
        Generate an image using DALL-E 3
        
        Args:
            word_data: Word information dictionary
            image_prompt: Generated prompt for image creation
            
        Returns:
            URL of the generated image
        """
        kazakh_word = word_data.get('kazakh_word', 'unknown')
        
        # Enhance prompt for DALL-E 3
        enhanced_prompt = f"{image_prompt}, digital art, clean educational illustration, square format, no text or words visible, bright and clear for language learning"
        
        try:
            response = await self.openai_client.images.generate(
                model="dall-e-3",
                prompt=enhanced_prompt,
                size="1024x1024",  # DALL-E 3 default, we'll resize later
                quality="standard",
                n=1
            )
            
            image_url = response.data[0].url
            logger.info(f"Generated image for '{kazakh_word}': {image_url}")
            return image_url
            
        except Exception as e:
            logger.error(f"Error generating image for '{kazakh_word}': {e}")
            raise

    async def download_and_process_image(self, image_url: str, word_data: Dict) -> Path:
        """
        Download image and process it to required specifications
        
        Args:
            image_url: URL of the generated image
            word_data: Word information dictionary
            
        Returns:
            Path to the saved processed image
        """
        word_id = word_data.get('id')
        category_id = word_data.get('category_id')
        kazakh_word = word_data.get('kazakh_word', 'unknown')
        
        # Handle missing category_id - use a default or fetch from API
        if category_id is None:
            logger.warning(f"Category ID is None for word {word_id} ('{kazakh_word}'). Using default category 'uncategorized'.")
            category_id = 'uncategorized'
        
        # Create directory structure
        category_dir = self.base_image_dir / str(category_id)
        category_dir.mkdir(parents=True, exist_ok=True)
        
        # Define file path
        image_path = category_dir / f"{word_id}.png"
        
        try:
            # Download original image
            async with httpx.AsyncClient() as client:
                response = await client.get(image_url)
                response.raise_for_status()
                
                # Load image with PIL
                image = Image.open(io.BytesIO(response.content))
                
                # Resize to 300x300
                image = image.resize(self.image_size, Image.Resampling.LANCZOS)
                
                # Convert to RGB if necessary
                if image.mode in ('RGBA', 'LA', 'P'):
                    background = Image.new('RGB', image.size, (255, 255, 255))
                    if image.mode == 'P':
                        image = image.convert('RGBA')
                    background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                    image = background
                
                # Save processed image
                image.save(image_path, self.image_format, quality=95)
                
                logger.info(f"Saved processed image for word {word_data.get('id')} to {image_path}")
                return image_path
                
        except Exception as e:
            logger.error(f"Error downloading/processing image for word {word_data.get('id')}: {e}")
            raise

    async def update_word_image_url(self, word_id: int, image_path: Path) -> bool:
        """
        Create a new word image record in the database via API
        
        Args:
            word_id: ID of the word to update
            image_path: Path to the saved image
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Convert file path to URL path
            # Handle both absolute and relative paths
            if image_path.is_absolute():
                # Try to find 'public' in the path
                path_parts = image_path.parts
                public_index = -1
                for i, part in enumerate(path_parts):
                    if part == 'public':
                        public_index = i
                        break
                
                if public_index >= 0:
                    # Get path relative to public directory
                    relative_parts = path_parts[public_index + 1:]
                    image_url = '/' + '/'.join(relative_parts)
                else:
                    # Fallback: use last 4 parts (categories/category_id/word_id.png)
                    relative_parts = path_parts[-4:]
                    image_url = '/' + '/'.join(relative_parts)
            else:
                # For relative paths, try to resolve relative to 'public'
                try:
                    relative_path = image_path.relative_to(Path('public'))
                    image_url = f"/{relative_path.as_posix()}"
                except ValueError:
                    # If that fails, construct from filename
                    # Extract category and word info from path
                    path_str = str(image_path)
                    if 'categories' in path_str:
                        # Find the part after 'categories'
                        parts = path_str.split('categories')[-1].strip('/\\').split('\\')
                        if len(parts) >= 2:
                            category_id, filename = parts[-2], parts[-1]
                            image_url = f"/images/words/categories/{category_id}/{filename}"
                        else:
                            # Last resort
                            image_url = f"/images/words/categories/unknown/{image_path.name}"
                    else:
                        image_url = f"/images/words/categories/unknown/{image_path.name}"
            
            logger.info(f"Converted path {image_path} to URL: {image_url}")
            
            # Create word image via API using POST endpoint
            image_data = {
                "kazakh_word_id": word_id,
                "image_url": image_url,
                "image_type": "ai_generated",
                "alt_text": f"AI generated image for word ID {word_id}",
                "is_primary": True,  # Set as primary since it's likely the first/only image
                "source": "DALL-E 3",
                "license": "AI Generated"
            }
            
            response = await self.http_client.post(
                '/word-images/',
                json=image_data
            )
            response.raise_for_status()
            
            logger.info(f"Created image record for word {word_id}: {image_url}")
            return True
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error creating word image: {e.response.status_code} - {e.response.text}")
            return False
        except Exception as e:
            logger.error(f"Error creating word image for word {word_id}: {e}")
            return False

    async def get_word_details(self, word_id: int) -> Optional[Dict]:
        """
        Get full word details including category_id
        
        Args:
            word_id: ID of the word
            
        Returns:
            Dictionary with full word details or None if not found
        """
        try:
            response = await self.http_client.get(f'/words/{word_id}')
            response.raise_for_status()
            
            word_data = response.json()
            logger.debug(f"Retrieved word details for ID {word_id}: {word_data}")
            return word_data
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.warning(f"Word {word_id} not found")
                return None
            logger.error(f"HTTP error getting word details: {e.response.status_code} - {e.response.text}")
            return None
        except Exception as e:
            logger.error(f"Error getting word details for {word_id}: {e}")
            return None

    def _safe_log_kazakh_word(self, kazakh_word: str) -> str:
        """
        Create a safe version of Kazakh word for logging to avoid Unicode errors
        """
        try:
            # Try to encode to ASCII, replace problematic characters
            return kazakh_word.encode('ascii', 'replace').decode('ascii')
        except:
            # Fallback: replace with word ID reference
            return '[KAZAKH_WORD]'

    async def process_single_word(self, word_data: Dict) -> bool:
        """
        Process a single word: generate image, save it, and update database
        
        Args:
            word_data: Dictionary containing word information
            
        Returns:
            True if successful, False otherwise
        """
        word_id = word_data.get('id')
        kazakh_word = word_data.get('kazakh_word', 'unknown')
        safe_word = self._safe_log_kazakh_word(kazakh_word)
        
        try:
            logger.info(f"Processing word {word_id}: '{safe_word}'")
            
            # If category_id is missing, try to get full word details
            if word_data.get('category_id') is None:
                logger.info(f"Category ID missing for word {word_id}, fetching full details...")
                full_word_data = await self.get_word_details(word_id)
                if full_word_data:
                    try:
                        # Parse the actual API response structure
                        category_info = full_word_data.get('category', {})
                        translations = full_word_data.get('translations', [])
                        
                        # Extract category_id from category object
                        category_id = category_info.get('id') if isinstance(category_info, dict) else None
                        category_name = category_info.get('category_name') if isinstance(category_info, dict) else None
                        
                        # Extract English translation from translations array
                        english_translation = None
                        if isinstance(translations, list) and translations:
                            # Find English translation
                            for trans in translations:
                                if isinstance(trans, dict) and trans.get('language_code') == 'en':
                                    english_translation = trans.get('translation')
                                    break
                            # If no English, use first available translation
                            if not english_translation and translations:
                                english_translation = translations[0].get('translation')
                        
                        # Update word_data with extracted information
                        word_data.update({
                            'category_id': category_id,
                            'english_translation': english_translation,
                            'category': category_name
                        })
                        
                        logger.info(f"Updated word data - category_id: {category_id}, category: {category_name}, translation: {english_translation}")
                        
                    except Exception as parse_error:
                        logger.error(f"Error parsing word details: {parse_error}")
                        logger.debug(f"Full word data structure available but failed to parse")
                        # Continue with fallback values
                        word_data['category_id'] = 'uncategorized'
                else:
                    logger.warning(f"Could not fetch full details for word {word_id}")
                    word_data['category_id'] = 'uncategorized'
            
            # Step 1: Generate image prompt
            image_prompt = await self.generate_image_prompt(word_data)
            
            # Step 2: Generate image with DALL-E 3
            image_url = await self.generate_word_image(word_data, image_prompt)
            
            # Step 3: Download and process image
            image_path = await self.download_and_process_image(image_url, word_data)
            
            # Step 4: Update word in database
            success = await self.update_word_image_url(word_id, image_path)
            
            if success:
                logger.info(f"SUCCESS: Successfully processed word {word_id}: '{safe_word}'")
                return True
            else:
                logger.error(f"FAILED: Failed to update database for word {word_id}: '{safe_word}'")
                return False
                
        except Exception as e:
            logger.error(f"ERROR: Error processing word {word_id} ('{safe_word}'): {e}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            return False

    async def process_all_words_without_images(self, max_words: Optional[int] = None, 
                                             delay_between_words: float = 1.0) -> Dict:
        """
        Process all words that don't have images
        
        Args:
            max_words: Maximum number of words to process (None for all)
            delay_between_words: Delay in seconds between processing words
            
        Returns:
            Dictionary with processing statistics
        """
        try:
            # Get words without images
            words = await self.get_words_without_images()
            
            if not words:
                logger.info("No words found without images")
                return {
                    'total_words': 0,
                    'processed': 0,
                    'successful': 0,
                    'failed': 0,
                    'errors': []
                }
            
            # Limit words if specified
            if max_words and max_words > 0:
                words = words[:max_words]
            
            logger.info(f"Processing {len(words)} words without images")
            
            # Process statistics
            stats = {
                'total_words': len(words),
                'processed': 0,
                'successful': 0,
                'failed': 0,
                'errors': []
            }
            
            # Process each word
            for i, word_data in enumerate(words, 1):
                word_id = word_data.get('id')
                kazakh_word = word_data.get('kazakh_word', 'unknown')
                
                logger.info(f"[{i}/{len(words)}] Processing: {kazakh_word} (ID: {word_id})")
                
                try:
                    success = await self.process_single_word(word_data)
                    stats['processed'] += 1
                    
                    if success:
                        stats['successful'] += 1
                        logger.info(f"SUCCESS [{i}/{len(words)}]: {kazakh_word}")
                    else:
                        stats['failed'] += 1
                        error_msg = f"Failed to process word {word_id}: {kazakh_word}"
                        stats['errors'].append(error_msg)
                        logger.error(f"FAILED [{i}/{len(words)}]: {error_msg}")
                    
                    # Delay between words to avoid rate limits
                    if delay_between_words > 0 and i < len(words):
                        await asyncio.sleep(delay_between_words)
                        
                except Exception as e:
                    stats['processed'] += 1
                    stats['failed'] += 1
                    error_msg = f"Exception processing word {word_id} ({kazakh_word}): {e}"
                    stats['errors'].append(error_msg)
                    logger.error(f"ERROR [{i}/{len(words)}]: {error_msg}")
            
            # Final summary
            logger.info(f"""
Image Generation Complete!
Statistics:
   - Total words: {stats['total_words']}
   - Processed: {stats['processed']}
   - Successful: {stats['successful']}
   - Failed: {stats['failed']}
   - Success rate: {(stats['successful']/stats['processed']*100):.1f}%
            """)
            
            return stats
            
        except Exception as e:
            logger.error(f"Error in batch processing: {e}")
            raise


# Import required modules at the top
import io


async def main():
    """Main function to run the image generation service"""
    import argparse
    
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Generate images for Kazakh words using GPT-4 and DALL-E 3')
    parser.add_argument('--api-url', required=True, help='Base URL of your API (e.g., http://localhost:8000)')
    parser.add_argument('--token', help='API authentication token (will prompt if not provided)')
    parser.add_argument('--max-words', type=int, help='Maximum number of words to process')
    parser.add_argument('--delay', type=float, default=2.0, help='Delay between words in seconds (default: 2.0)')
    parser.add_argument('--verbose', action='store_true', help='Enable verbose logging')
    
    args = parser.parse_args()
    
    # Set up logging
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler('word_image_generation.log')
        ]
    )
    
    # Get API token
    api_token = args.token
    if not api_token:
        api_token = input("Enter your API authentication token: ").strip()
    
    if not api_token:
        logger.error("API token is required")
        return
    
    # Check environment variables
    if not os.getenv('OPENAI_API_KEY'):
        logger.error("OPENAI_API_KEY environment variable not found")
        return
    
    # Run the service
    try:
        async with WordImageService(args.api_url, api_token) as service:
            stats = await service.process_all_words_without_images(
                max_words=args.max_words,
                delay_between_words=args.delay
            )
            
            print("\n" + "="*50)
            print("🎉 WORD IMAGE GENERATION COMPLETE!")
            print("="*50)
            print(f"📊 Final Statistics:")
            print(f"   • Total words found: {stats['total_words']}")
            print(f"   • Words processed: {stats['processed']}")
            print(f"   • Successful: {stats['successful']}")
            print(f"   • Failed: {stats['failed']}")
            
            if stats['processed'] > 0:
                success_rate = (stats['successful'] / stats['processed']) * 100
                print(f"   • Success rate: {success_rate:.1f}%")
            
            if stats['errors']:
                print(f"\n❌ Errors encountered ({len(stats['errors'])}):")
                for error in stats['errors'][:5]:  # Show first 5 errors
                    print(f"   • {error}")
                if len(stats['errors']) > 5:
                    print(f"   • ... and {len(stats['errors']) - 5} more errors")
    
    except KeyboardInterrupt:
        logger.info("Process interrupted by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())