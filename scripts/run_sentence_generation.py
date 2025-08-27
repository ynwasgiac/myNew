#!/usr/bin/env python3
"""
Kazakh Sentence Generation Script

This script automatically generates example sentences for Kazakh words that don't have sentences yet,
and translates them into Russian, English, and Simplified Chinese.

Just run: python run_sentence_generation.py
"""

import asyncio
import aiohttp
import json
import logging
import sys
import time
import os
from datetime import datetime
from typing import List, Dict, Optional

# ===== CONFIGURATION =====
# Edit these values for your setup:

API_URL = "http://127.0.0.1:8000"
API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInVzZXJfaWQiOjEsInJvbGUiOiJhZG1pbiIsImp0aSI6ImUxMDMxNjY0LWU5YmEtNDk2Ni1hZmQ4LWU3MWU3MWZjNjJiYSIsImV4cCI6MTc1NjIwNjExMX0.6RiecbDzw85i8NGWxqq4ZfK471mYDMHKlWkxl4q6oxg"
MAX_WORDS = None  # None = all words, or set a number like 10
DELAY_BETWEEN_WORDS = 2.0  # seconds
DELAY_BETWEEN_TRANSLATIONS = 3.0  # seconds between translations
VERBOSE = False

# ===== END CONFIGURATION =====

# Fix Unicode issues on Windows
if sys.platform == "win32":
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Set up logging
log_level = logging.DEBUG if VERBOSE else logging.INFO
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


class SentenceGenerator:
    """Sentence generator for Kazakh words"""

    def __init__(self):
        self.session = None
        self.stats = {
            'processed': 0,
            'successful': 0,
            'failed': 0,
            'start_time': datetime.now()
        }

        # Target languages for translation
        self.target_languages = [
            {'code': 'ru', 'name': 'Russian'},
            {'code': 'en', 'name': 'English'},
            {'code': 'zh', 'name': 'Chinese Simplified'}
        ]

    async def start(self):
        """Start the sentence generation process"""

        # Validate configuration
        if API_TOKEN == "your-admin-token-here":
            logger.error("ERROR: Please set your API_TOKEN in the configuration section")
            return False

        # Setup session
        headers = {
            'Authorization': f'Bearer {API_TOKEN}',
            'Content-Type': 'application/json'
        }

        timeout = aiohttp.ClientTimeout(total=60)

        try:
            async with aiohttp.ClientSession(
                    base_url=API_URL,
                    headers=headers,
                    timeout=timeout
            ) as session:

                self.session = session
                logger.info("Starting sentence generation...")
                logger.info(f"API: {API_URL}")
                logger.info(f"Max words: {MAX_WORDS or 'All'}")
                logger.info(f"Delay: {DELAY_BETWEEN_WORDS}s")

                await self.process_words()

        except Exception as e:
            logger.error(f"Fatal error: {e}")
            return False

        return True

    async def get_words_without_sentences(self):
        """Get words that need sentences"""
        try:
            params = {'page': 1, 'page_size': 50}
            async with self.session.get('/words/without-examples', params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    words = []
                    if isinstance(data, dict) and 'words' in data:
                        words = data['words']
                    elif isinstance(data, list):
                        words = data

                    logger.info(f"Found {len(words)} words")
                    return words
                else:
                    error_text = await response.text()
                    logger.error(f"Failed to get words: {response.status} - {error_text}")
                    return []
        except Exception as e:
            logger.error(f"Error getting words: {e}")
            return []

    async def generate_sentence(self, word):
        """Generate sentence for a word"""
        try:
            kazakh_word = word.get('kazakh_word', '')

            request_data = {
                "kazakh_word": kazakh_word,
                "difficulty_level": word.get('difficulty_level', 2),
                "usage_context": "daily conversation",
                "sentence_length": "medium"
            }

            async with self.session.post('/ai/generate-example-sentence', json=request_data) as response:
                if response.status == 200:
                    sentence_data = await response.json()
                    generated_sentence = sentence_data.get('kazakh_sentence', '')
                    logger.info(f"Generated: {generated_sentence}")
                    return sentence_data
                else:
                    error_text = await response.text()
                    logger.error(f"Failed to generate sentence: {response.status} - {error_text}")
                    return None
        except Exception as e:
            logger.error(f"Error generating sentence: {e}")
            return None

    async def create_sentence_in_db(self, word_id, sentence_data):
        """Create sentence in database"""
        try:
            if word_id is None:
                logger.warning("Cannot create sentence: word_id is None")
                return None

            request_data = {
                "kazakh_word_id": word_id,
                "kazakh_sentence": sentence_data.get('kazakh_sentence', ''),
                "difficulty_level": sentence_data.get('difficulty_level', 2),
                "usage_context": sentence_data.get('usage_context', 'daily conversation'),
                "translations": {}
            }

            async with self.session.post('/example-sentences/', json=request_data) as response:
                if response.status in [200, 201]:
                    result = await response.json()
                    sentence_id = result.get('id')
                    logger.info(f"Created sentence ID: {sentence_id}")
                    return result
                else:
                    error_text = await response.text()
                    logger.error(f"Failed to create sentence: {response.status} - {error_text}")
                    return None
        except Exception as e:
            logger.error(f"Error creating sentence: {e}")
            return None

    async def translate_sentence(self, sentence, lang_code, lang_name):
        """Translate a sentence"""
        try:
            request_data = {
                "kazakh_sentence": sentence,
                "target_language_code": lang_code,
                "target_language_name": lang_name,
                "context": "daily conversation"
            }

            async with self.session.post('/ai/translate-sentence', json=request_data) as response:
                if response.status == 200:
                    translation_data = await response.json()
                    translated_text = translation_data.get('translated_sentence', '')
                    logger.info(f"{lang_name}: {translated_text}")
                    return translation_data
                else:
                    error_text = await response.text()
                    logger.error(f"Failed to translate to {lang_name}: {response.status} - {error_text}")
                    return None
        except Exception as e:
            logger.error(f"Error translating to {lang_name}: {e}")
            return None

    async def add_translation(self, sentence_id, lang_code, translation):
        """Add translation to database"""
        try:
            if sentence_id is None:
                logger.warning(f"Cannot add {lang_code} translation: sentence_id is None")
                return False

            request_data = {
                "example_sentence_id": sentence_id,
                "language_code": lang_code,
                "translated_sentence": translation
            }

            async with self.session.post('/example-sentence-translations/', json=request_data) as response:
                if response.status in [200, 201]:
                    logger.info(f"✅ Added {lang_code} translation")
                    return True
                elif response.status == 400:
                    response_text = await response.text()
                    if "already exists" in response_text.lower():
                        logger.info(f"⚠️ {lang_code} translation already exists")
                        return True
                    else:
                        logger.error(f"❌ {lang_code} failed: {response_text}")
                        return False
                else:
                    response_text = await response.text()
                    logger.error(f"❌ {lang_code} failed: {response.status} - {response_text}")
                    return False

        except Exception as e:
            logger.error(f"Error adding {lang_code} translation: {e}")
            return False

    async def process_word(self, word):
        """Process a single word"""
        try:
            word_name = word.get('kazakh_word', 'Unknown')
            word_id = word.get('id')

            logger.info(f"\n{'=' * 50}")
            logger.info(f"Processing word: {word_name} (ID: {word_id})")
            logger.info(f"{'=' * 50}")

            # Generate sentence
            sentence_data = await self.generate_sentence(word)
            if not sentence_data:
                logger.error(f"Failed to generate sentence for {word_name}")
                return False

            kazakh_sentence = sentence_data.get('kazakh_sentence', '')

            # Create in database
            created_sentence = await self.create_sentence_in_db(word_id, sentence_data)
            if not created_sentence:
                logger.error(f"Failed to create sentence in database for {word_name}")
                return False

            sentence_id = created_sentence.get('id')

            # Wait before starting translations
            await asyncio.sleep(1.0)

            # Process each translation
            translations_added = 0

            for i, lang in enumerate(self.target_languages):
                logger.info(f"\nTranslation {i + 1}/{len(self.target_languages)}: {lang['name']}")

                # Get translation
                translation_data = await self.translate_sentence(
                    kazakh_sentence, lang['code'], lang['name']
                )

                if translation_data:
                    translated_text = translation_data.get('translated_sentence', '')

                    # Wait before adding
                    if i > 0:
                        await asyncio.sleep(DELAY_BETWEEN_TRANSLATIONS)

                    # Add translation
                    if await self.add_translation(sentence_id, lang['code'], translated_text):
                        translations_added += 1
                    else:
                        logger.error(f"Failed to add {lang['name']} translation")
                else:
                    logger.error(f"Failed to get {lang['name']} translation")

            logger.info(
                f"SUCCESS: {word_name} completed! ({translations_added}/{len(self.target_languages)} translations)")
            return True

        except Exception as e:
            logger.error(f"Error processing {word.get('kazakh_word', 'Unknown')}: {e}")
            return False

    async def process_words(self):
        """Process all words"""
        try:
            words = await self.get_words_without_sentences()

            if not words:
                logger.info("No words found that need sentences")
                return

            total_words = min(len(words), MAX_WORDS) if MAX_WORDS else len(words)
            logger.info(f"Processing {total_words} words")

            for i, word in enumerate(words):
                if MAX_WORDS and i >= MAX_WORDS:
                    break

                self.stats['processed'] += 1

                if await self.process_word(word):
                    self.stats['successful'] += 1
                else:
                    self.stats['failed'] += 1

                # Progress update every 5 words
                if (i + 1) % 5 == 0:
                    success_rate = (self.stats['successful'] / max(self.stats['processed'], 1)) * 100
                    logger.info(f"Progress: {i + 1}/{total_words} ({success_rate:.1f}% success)")

                # Delay between words
                if DELAY_BETWEEN_WORDS > 0 and i < total_words - 1:
                    logger.info(f"Waiting {DELAY_BETWEEN_WORDS} seconds...")
                    await asyncio.sleep(DELAY_BETWEEN_WORDS)

            # Final stats
            duration = datetime.now() - self.stats['start_time']
            success_rate = (self.stats['successful'] / max(self.stats['processed'], 1)) * 100

            logger.info(f"\n{'=' * 60}")
            logger.info("COMPLETED!")
            logger.info(f"{'=' * 60}")
            logger.info(f"Duration: {duration}")
            logger.info(f"Processed: {self.stats['processed']}")
            logger.info(f"Successful: {self.stats['successful']}")
            logger.info(f"Failed: {self.stats['failed']}")
            logger.info(f"Success rate: {success_rate:.1f}%")

        except Exception as e:
            logger.error(f"Error in process_words: {e}")


async def main():
    """Main function"""

    print("Kazakh Sentence Generation")
    print("==========================")

    if API_TOKEN == "your-admin-token-here":
        print("ERROR: Please edit this script and set your API_TOKEN")
        print("Look for the CONFIGURATION section at the top")
        return

    generator = SentenceGenerator()
    await generator.start()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nInterrupted by user")
    except Exception as e:
        print(f"\nError: {e}")
        import traceback

        traceback.print_exc()