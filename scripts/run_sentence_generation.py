#!/usr/bin/env python3
"""
Script to generate example sentences for Kazakh words using AI
"""
import argparse
import asyncio
import logging
import os
import sys
from datetime import datetime
from typing import Optional

import aiohttp
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('sentence_generation.log')
    ]
)
logger = logging.getLogger(__name__)


class SentenceGenerationService:
    """Service to generate example sentences for Kazakh words"""
    
    def __init__(self, api_url: str, token: str):
        self.api_url = api_url.rstrip('/')
        self.token = token
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc, tb):
        if self.session:
            await self.session.close()
    
    async def get_words_without_sentences(self, limit: int = 100) -> list:
        """Get Kazakh words that don't have example sentences"""
        try:
            # Get words without example sentences
            async with self.session.get(
                f"{self.api_url}/admin/words-without-sentences",
                headers=self.headers,
                params={'limit': limit}
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('words', [])
                else:
                    logger.error(f"Failed to fetch words: {response.status}")
                    return []
        except Exception as e:
            logger.error(f"Error fetching words: {e}")
            return []
    
    async def generate_sentence(self, word_data: dict) -> Optional[dict]:
        """Generate an example sentence for a word"""
        try:
            payload = {
                'kazakh_word': word_data['kazakh_word'],
                'kazakh_cyrillic': word_data.get('kazakh_cyrillic'),
                'difficulty_level': word_data.get('difficulty_level', 2),
                'usage_context': 'daily conversation',
                'sentence_length': 'medium'
            }
            
            async with self.session.post(
                f"{self.api_url}/ai/generate-example-sentence",
                headers=self.headers,
                json=payload
            ) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    logger.error(f"Failed to generate sentence for {word_data['kazakh_word']}: {response.status}")
                    return None
        except Exception as e:
            logger.error(f"Error generating sentence for {word_data['kazakh_word']}: {e}")
            return None
    
    async def save_sentence(self, word_id: int, sentence_data: dict) -> bool:
        """Save the generated sentence to the database"""
        try:
            payload = {
                'kazakh_word_id': word_id,
                'kazakh_sentence': sentence_data['kazakh_sentence'],
                'difficulty_level': sentence_data['difficulty_level'],
                'usage_context': sentence_data.get('usage_context', 'daily conversation')
            }
            
            async with self.session.post(
                f"{self.api_url}/example-sentences",
                headers=self.headers,
                json=payload
            ) as response:
                if response.status in [200, 201]:
                    logger.info(f"✅ Saved sentence for word ID {word_id}")
                    return True
                else:
                    logger.error(f"Failed to save sentence: {response.status}")
                    return False
        except Exception as e:
            logger.error(f"Error saving sentence: {e}")
            return False
    
    async def process_all_words(self, max_words: Optional[int] = None, delay: float = 2.0):
        """Process all words without example sentences"""
        words = await self.get_words_without_sentences(limit=max_words or 1000)
        
        if not words:
            logger.info("No words found without example sentences")
            return
        
        logger.info(f"Found {len(words)} words to process")
        
        stats = {
            'total': len(words),
            'processed': 0,
            'successful': 0,
            'failed': 0
        }
        
        for word in words:
            try:
                logger.info(f"Processing word: {word['kazakh_word']} (ID: {word['id']})")
                
                # Generate sentence
                sentence_data = await self.generate_sentence(word)
                
                if sentence_data:
                    # Save to database
                    if await self.save_sentence(word['id'], sentence_data):
                        stats['successful'] += 1
                    else:
                        stats['failed'] += 1
                else:
                    stats['failed'] += 1
                
                stats['processed'] += 1
                
                # Progress update
                if stats['processed'] % 10 == 0:
                    logger.info(f"Progress: {stats['processed']}/{stats['total']} processed")
                
                # Delay between requests
                await asyncio.sleep(delay)
                
            except Exception as e:
                logger.error(f"Error processing word {word['kazakh_word']}: {e}")
                stats['failed'] += 1
        
        # Final statistics
        logger.info("="*50)
        logger.info("SENTENCE GENERATION COMPLETE!")
        logger.info(f"Total words: {stats['total']}")
        logger.info(f"Processed: {stats['processed']}")
        logger.info(f"Successful: {stats['successful']}")
        logger.info(f"Failed: {stats['failed']}")
        if stats['processed'] > 0:
            success_rate = (stats['successful'] / stats['processed']) * 100
            logger.info(f"Success rate: {success_rate:.1f}%")
        
        return stats


async def main():
    """Main function"""
    parser = argparse.ArgumentParser(description='Generate example sentences for Kazakh words')
    parser.add_argument('--api-url', default='http://localhost:8000', help='API base URL')
    parser.add_argument('--token', required=True, help='API authentication token')
    parser.add_argument('--max-words', type=int, help='Maximum number of words to process')
    parser.add_argument('--delay', type=float, default=2.0, help='Delay between requests in seconds')
    
    args = parser.parse_args()
    
    # Check for OpenAI key
    if not os.getenv('OPENAI_API_KEY'):
        logger.error("OPENAI_API_KEY environment variable not found")
        sys.exit(1)
    
    try:
        async with SentenceGenerationService(args.api_url, args.token) as service:
            await service.process_all_words(
                max_words=args.max_words,
                delay=args.delay
            )
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())