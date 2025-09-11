#!/usr/bin/env python3
"""
Script to generate images for Kazakh words using OpenAI's DALL-E 3
"""
import argparse
import asyncio
import logging
import os
import sys
import json
import base64
from datetime import datetime
from typing import Optional, Dict, Any, List
from pathlib import Path

# Try to import required packages
try:
    import aiohttp
except ImportError:
    print("Installing aiohttp...")
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "aiohttp"])
    import aiohttp

try:
    from openai import AsyncOpenAI
except ImportError:
    print("Installing openai...")
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "openai"])
    from openai import AsyncOpenAI

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    print("dotenv not installed, continuing without it")

# Setup logging with UTF-8 encoding for file
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('image_generation.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)


class ImageGenerationService:
    """Service to generate images for Kazakh words using DALL-E"""

    def __init__(self, api_url: str, token: str):
        self.api_url = api_url.rstrip('/')
        self.token = token
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        self.session: Optional[aiohttp.ClientSession] = None
        self.openai_client: Optional[AsyncOpenAI] = None
        self.stats = {
            'total': 0,
            'processed': 0,
            'successful': 0,
            'failed': 0,
            'skipped': 0
        }

    async def __aenter__(self):
        """Initialize services on context entry"""
        self.session = aiohttp.ClientSession()

        # Initialize OpenAI client
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")

        self.openai_client = AsyncOpenAI(api_key=api_key)
        logger.info("[OK] OpenAI client initialized")

        return self

    async def __aexit__(self, exc_type, exc, tb):
        """Cleanup on context exit"""
        if self.session:
            await self.session.close()

    async def test_connection(self) -> bool:
        """Test API connection"""
        try:
            logger.info(f"Testing connection to {self.api_url}")
            async with self.session.get(
                    f"{self.api_url}/",
                    headers={'Authorization': f'Bearer {self.token}'}
            ) as response:
                if response.status == 200:
                    logger.info("[OK] API connection successful")
                    return True
                else:
                    logger.error(f"[ERROR] API returned status: {response.status}")
                    return False
        except Exception as e:
            logger.error(f"[ERROR] Connection failed: {e}")
            return False

    async def test_openai_connection(self) -> bool:
        """Test OpenAI API connection"""
        try:
            logger.info("Testing OpenAI connection...")
            response = await self.openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": "Say 'OK'"}],
                max_tokens=5
            )
            if response.choices[0].message.content:
                logger.info("[OK] OpenAI connection successful")
                return True
            return False
        except Exception as e:
            logger.error(f"[ERROR] OpenAI connection failed: {e}")
            return False

    async def get_words_without_images(self, limit: int = 100) -> List[Dict]:
        """Get Kazakh words that don't have images"""
        try:
            logger.info(f"Fetching words without images (limit: {limit})")

            url = f"{self.api_url}/admin/words-without-images"
            params = {'limit': limit}

            async with self.session.get(url, headers=self.headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    words = data.get('words', [])
                    logger.info(f"[OK] Found {len(words)} words without images")
                    return words
                else:
                    text = await response.text()
                    logger.error(f"[ERROR] Failed to fetch words: {response.status}")
                    logger.error(f"Response: {text[:500]}")
                    return []
        except Exception as e:
            logger.error(f"[ERROR] Error fetching words: {e}")
            return []

    async def generate_image_prompt(self, word: str, word_cyrillic: Optional[str] = None) -> Optional[str]:
        """Generate an optimized DALL-E prompt for the word"""
        try:
            # Prepare the word information
            word_info = f'"{word}"'
            # if word_cyrillic and word_cyrillic != word:
            #     word_info = f'"{word}" (Cyrillic: "{word_cyrillic}")'

            # Generate prompt using GPT-4
            response = await self.openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": """You are an expert at creating DALL-E 3 prompts for educational language learning materials.
                        Your prompts should create clear, culturally appropriate, and educational images."""
                    },
                    {
                        "role": "user",
                        "content": f"""Create a DALL-E 3 prompt for the Kazakh word {word_info}.

Requirements for the image:
- Clear, simple, and educational
- Photorealistic or high-quality illustration style
- Culturally appropriate for Kazakhstan
- No text in the image
- White or neutral background
- Single clear subject when possible
- Suitable for language learners of all ages

Return only the prompt text, maximum 200 characters."""
                    }
                ],
                max_tokens=100,
                temperature=0.7
            )

            prompt = response.choices[0].message.content.strip()

            # Add quality modifiers if not present
            if "high quality" not in prompt.lower():
                prompt = f"High quality {prompt}"

            logger.info(f"Generated prompt for '{word}': {prompt[:100]}...")
            return prompt

        except Exception as e:
            logger.error(f"Error generating prompt for '{word}': {e}")
            # Fallback prompt
            return f"High quality educational illustration of {word}, clear simple style, white background"

    async def generate_image(self, word_data: Dict) -> Optional[Dict[str, Any]]:
        """Generate an image using DALL-E 3"""
        word = word_data.get('russian_translation', 'unknown')
        word_cyrillic = word_data.get('kazakh_cyrillic')

        try:
            logger.info(f"Generating image for: {word}")

            # Generate optimized prompt
            prompt = await self.generate_image_prompt(word, word_cyrillic)
            if not prompt:
                logger.error(f"Failed to generate prompt for {word}")
                return None

            # Generate image with DALL-E 3
            logger.info(f"Calling DALL-E 3 with prompt: {prompt[:100]}...")

            response = await self.openai_client.images.generate(
                model="dall-e-3",
                prompt=prompt,
                size="1024x1024",
                quality="standard",  # or "hd" for higher quality
                style="vivid",  # or "natural" for more realistic
                n=1
            )

            if not response.data or not response.data[0].url:
                logger.error(f"No image URL in response for {word}")
                return None

            image_url = response.data[0].url
            revised_prompt = response.data[0].revised_prompt if hasattr(response.data[0], 'revised_prompt') else prompt

            logger.info(f"[OK] Generated image URL for '{word}'")
            logger.debug(f"Revised prompt: {revised_prompt[:200]}...")

            # Download the image
            async with self.session.get(image_url) as img_response:
                if img_response.status == 200:
                    image_data = await img_response.read()

                    # Validate image size
                    image_size = len(image_data)
                    if image_size < 1000:  # Less than 1KB is suspicious
                        logger.error(f"Image too small for {word}: {image_size} bytes")
                        return None

                    logger.info(f"Downloaded image for '{word}': {image_size / 1024:.1f} KB")

                    return {
                        'url': image_url,
                        'data': base64.b64encode(image_data).decode('utf-8'),
                        'prompt': prompt,
                        'revised_prompt': revised_prompt,
                        'size': image_size
                    }
                else:
                    logger.error(f"Failed to download image for {word}: HTTP {img_response.status}")
                    return None

        except Exception as e:
            logger.error(f"[ERROR] Error generating image for '{word}': {e}")
            if "content_policy_violation" in str(e):
                logger.warning(f"Content policy violation for word '{word}', skipping...")
                self.stats['skipped'] += 1
            return None

    async def save_image(self, word_id: int, word_name: str, category_id: Optional[int], image_data: Dict) -> bool:
        """Save the generated image via API"""
        try:
            # Decode base64 image
            image_bytes = base64.b64decode(image_data['data'])

            # Prepare form data
            form_data = aiohttp.FormData()
            form_data.add_field('alt_text', f"Image for {word_name}"[:200])  # Limit to 200 chars
            form_data.add_field('is_primary', 'true')

            # Add source with truncation to fit database limit
            if image_data.get('prompt'):
                source_text = f"DALL-E 3: {image_data['prompt'][:50]}..."  # Limit to ~60 chars total
                form_data.add_field('source', source_text[:100])  # Ensure max 100 chars
            else:
                form_data.add_field('source', 'DALL-E 3')

            form_data.add_field('license', 'AI Generated')

            # Add image file
            form_data.add_field(
                'file',
                image_bytes,
                filename=f'word_{word_id}.png',  # Simplified filename
                content_type='image/png'
            )

            # Use the correct endpoint
            url = f"{self.api_url}/admin/words/{word_id}/images/upload"

            headers = {'Authorization': f'Bearer {self.token}'}

            async with self.session.post(url, data=form_data, headers=headers) as response:
                if response.status in [200, 201]:
                    result = await response.json()
                    logger.info(f"[OK] Saved image for '{word_name}' (ID: {word_id})")
                    return True
                elif response.status == 500:
                    text = await response.text()
                    if "value too long" in text:
                        logger.error(f"[ERROR] Database field too long for '{word_name}', retrying with shorter values")
                        # Retry with even shorter values
                        form_data = aiohttp.FormData()
                        form_data.add_field('alt_text', f"Image for word {word_id}"[:100])
                        form_data.add_field('is_primary', 'true')
                        form_data.add_field('source', 'DALL-E 3'[:50])
                        form_data.add_field('license', 'AI'[:50])
                        form_data.add_field(
                            'file',
                            image_bytes,
                            filename=f'{word_id}.png',
                            content_type='image/png'
                        )

                        async with self.session.post(url, data=form_data, headers=headers) as retry_response:
                            if retry_response.status in [200, 201]:
                                logger.info(f"[OK] Saved image for '{word_name}' on retry")
                                return True
                            else:
                                logger.error(f"[ERROR] Failed on retry for '{word_name}': {retry_response.status}")
                                return False
                    else:
                        logger.error(f"[ERROR] Server error for '{word_name}': {text[:200]}")
                        return False
                else:
                    text = await response.text()
                    logger.error(f"[ERROR] Failed to save image for '{word_name}': HTTP {response.status}")
                    logger.error(f"Response: {text[:500]}")
                    return False

        except Exception as e:
            logger.error(f"[ERROR] Error saving image for '{word_name}': {e}")
            return False

    async def process_all_words(self, max_words: Optional[int] = None, delay: float = 3.0) -> Dict:
        """Process all words without images"""

        # Test connections
        if not await self.test_connection():
            logger.error("[ERROR] Cannot connect to API, exiting")
            return self.stats

        if not await self.test_openai_connection():
            logger.error("[ERROR] Cannot connect to OpenAI API, exiting")
            return self.stats

        # Get words
        words = await self.get_words_without_images(limit=max_words or 1000)

        if not words:
            logger.info("No words found without images")
            return self.stats

        # Limit to max_words if specified
        if max_words and len(words) > max_words:
            words = words[:max_words]

        logger.info(f"Processing {len(words)} words with {delay}s delay between requests")
        logger.info("=" * 60)

        self.stats['total'] = len(words)

        for idx, word in enumerate(words, 1):
            word_text = word.get('kazakh_word', 'unknown')
            word_id = word.get('id')
            category_id = word.get('category_id')

            try:
                logger.info(f"\n[{idx}/{len(words)}] Processing: {word_text} (ID: {word_id})")

                # Generate image
                image_data = await self.generate_image(word)

                if image_data:
                    # Save to database
                    if await self.save_image(word_id, word_text, category_id, image_data):
                        self.stats['successful'] += 1
                        logger.info(f"[SUCCESS] Successfully processed '{word_text}'")
                    else:
                        self.stats['failed'] += 1
                        logger.warning(f"[WARNING] Generated but failed to save image for '{word_text}'")
                else:
                    if word_text not in ["skipped"]:  # Don't count skipped as failed
                        self.stats['failed'] += 1
                        logger.warning(f"[WARNING] Failed to generate image for '{word_text}'")

                self.stats['processed'] += 1

                # Progress report every 5 words
                if self.stats['processed'] % 5 == 0:
                    self._print_progress()

                # Delay between requests (except after last word)
                if idx < len(words):
                    logger.info(f"Waiting {delay}s before next request...")
                    await asyncio.sleep(delay)

            except KeyboardInterrupt:
                logger.info("\n[WARNING] Process interrupted by user")
                break
            except Exception as e:
                logger.error(f"[ERROR] Unexpected error processing '{word_text}': {e}")
                self.stats['failed'] += 1
                self.stats['processed'] += 1

        return self.stats

    def _print_progress(self):
        """Print progress statistics"""
        if self.stats['processed'] > 0:
            success_rate = (self.stats['successful'] / self.stats['processed']) * 100
            logger.info(f"[PROGRESS] {self.stats['processed']}/{self.stats['total']} | "
                        f"Success: {self.stats['successful']} ({success_rate:.1f}%) | "
                        f"Failed: {self.stats['failed']} | "
                        f"Skipped: {self.stats['skipped']}")

    def print_summary(self):
        """Print final summary"""
        logger.info("\n" + "=" * 60)
        logger.info("[COMPLETE] IMAGE GENERATION FINISHED!")
        logger.info("=" * 60)
        logger.info(f"[STATS] Total words: {self.stats['total']}")
        logger.info(f"[STATS] Successful: {self.stats['successful']}")
        logger.info(f"[STATS] Failed: {self.stats['failed']}")
        logger.info(f"[STATS] Skipped: {self.stats['skipped']}")

        if self.stats['processed'] > 0:
            success_rate = (self.stats['successful'] / self.stats['processed']) * 100
            logger.info(f"[STATS] Success rate: {success_rate:.1f}%")

        logger.info("=" * 60)


async def main():
    """Main function"""
    parser = argparse.ArgumentParser(
        description='Generate images for Kazakh words using DALL-E 3',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --token YOUR_TOKEN --max-words 10
  %(prog)s --token YOUR_TOKEN --max-words 50 --delay 5
  %(prog)s --api-url http://api.example.com --token YOUR_TOKEN
        """
    )

    parser.add_argument(
        '--api-url',
        default='http://localhost:8000',
        help='API base URL (default: http://localhost:8000)'
    )
    parser.add_argument(
        '--token',
        required=True,
        help='API authentication token'
    )
    parser.add_argument(
        '--max-words',
        type=int,
        default=2,
        help='Maximum number of words to process (default: 20)'
    )
    parser.add_argument(
        '--delay',
        type=float,
        default=3.0,
        help='Delay between requests in seconds (default: 3.0)'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )

    args = parser.parse_args()

    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Header
    logger.info("=" * 60)
    logger.info("[START] DALL-E 3 Image Generation for Kazakh Words")
    logger.info("=" * 60)
    logger.info(f"[CONFIG] API URL: {args.api_url}")
    logger.info(f"[CONFIG] Max words: {args.max_words}")
    logger.info(f"[CONFIG] Delay: {args.delay}s")
    logger.info("=" * 60)

    # Check for OpenAI key
    if not os.getenv('OPENAI_API_KEY'):
        logger.error("[ERROR] OPENAI_API_KEY environment variable is required")
        logger.error("Please set your OpenAI API key:")
        logger.error("  export OPENAI_API_KEY='your-api-key-here'")
        sys.exit(1)

    try:
        # Run the service
        async with ImageGenerationService(args.api_url, args.token) as service:
            stats = await service.process_all_words(
                max_words=args.max_words,
                delay=args.delay
            )
            service.print_summary()

            # Exit with appropriate code
            if stats['total'] == 0:
                sys.exit(0)  # No words to process
            elif stats['failed'] == 0 and stats['successful'] > 0:
                sys.exit(0)  # Complete success
            elif stats['successful'] == 0:
                sys.exit(1)  # Complete failure
            else:
                sys.exit(2)  # Partial success

    except KeyboardInterrupt:
        logger.info("\n[WARNING] Script interrupted by user")
        sys.exit(130)
    except ValueError as e:
        logger.error(f"[ERROR] Configuration error: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"[ERROR] Fatal error: {e}")
        import traceback
        logger.debug(traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    # For Windows event loop compatibility
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    asyncio.run(main())