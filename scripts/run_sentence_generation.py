import asyncio
import aiohttp
import json
import logging
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional

# Настройка UTF-8 кодировки для Windows
if sys.platform.startswith('win'):
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# Настройка логирования с UTF-8
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('sentence_generation.log', encoding='utf-8')
    ]
)

logger = logging.getLogger(__name__)

class SentenceGenerationService:
    def __init__(self, api_base_url: str, auth_token: str):
        self.api_base_url = api_base_url.rstrip('/')
        self.auth_token = auth_token
        self.headers = {
            'Authorization': f'Bearer {auth_token}',
            'Content-Type': 'application/json'
        }
        # Языки для автоматического перевода
        self.target_languages = [
            {'code': 'en', 'name': 'English'},
            {'code': 'ru', 'name': 'Russian'},
            {'code': 'zh', 'name': 'Chinese'}
        ]

    async def get_words_without_sentences(self, max_words: int = 50) -> List[Dict]:
        """Получить слова без предложений"""
        url = f"{self.api_base_url}/admin/words-without-sentences?limit={max_words}"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=self.headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('words', [])
                else:
                    logger.error(f"Failed to get words: {response.status}")
                    return []

    async def generate_sentence(self, word_data: Dict) -> Optional[Dict]:
        """Генерировать предложение для слова"""
        url = f"{self.api_base_url}/ai/generate-example-sentence"
        
        payload = {
            "kazakh_word": word_data['kazakh_word'],
            "kazakh_cyrillic": word_data.get('kazakh_cyrillic'),
            "difficulty_level": word_data.get('difficulty_level', 2),
            "usage_context": "daily conversation",
            "sentence_length": "medium"
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=self.headers, json=payload) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    logger.error(f"Failed to generate sentence for {word_data['kazakh_word']}: {response.status}")
                    return None

    async def create_example_sentence(self, word_id: int, sentence_data: Dict) -> Optional[int]:
        """Создать пример предложения в базе данных"""
        url = f"{self.api_base_url}/example-sentences/"
        
        payload = {
            "kazakh_word_id": word_id,
            "kazakh_sentence": sentence_data['kazakh_sentence'],
            "difficulty_level": sentence_data['difficulty_level'],
            "usage_context": sentence_data['usage_context']
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=self.headers, json=payload) as response:
                if response.status == 201:
                    result = await response.json()
                    return result['id']
                else:
                    logger.error(f"Failed to create sentence: {response.status}")
                    return None

    async def translate_sentence(self, kazakh_sentence: str, target_language: Dict) -> Optional[str]:
        """Перевести предложение на целевой язык"""
        url = f"{self.api_base_url}/ai/translate-sentence"
        
        payload = {
            "kazakh_sentence": kazakh_sentence,
            "target_language_code": target_language['code'],
            "target_language_name": target_language['name'],
            "context": "daily conversation"
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=self.headers, json=payload) as response:
                if response.status == 200:
                    result = await response.json()
                    return result['translated_sentence']
                else:
                    logger.error(f"Failed to translate to {target_language['name']}: {response.status}")
                    return None

    async def create_translation(self, sentence_id: int, language_code: str, translated_sentence: str) -> bool:
        """Создать перевод предложения"""
        url = f"{self.api_base_url}/example-sentence-translations/"
        
        payload = {
            "example_sentence_id": sentence_id,
            "language_code": language_code,
            "translated_sentence": translated_sentence
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=self.headers, json=payload) as response:
                if response.status == 201:
                    return True
                else:
                    logger.error(f"Failed to create translation: {response.status}")
                    return False

    async def process_word_with_translations(self, word: Dict) -> Dict:
        """Обработать слово: генерировать предложение и переводы"""
        result = {
            'word_id': word['id'],
            'word': word['kazakh_word'],
            'sentence_created': False,
            'translations_created': 0,
            'total_translations': len(self.target_languages),
            'errors': []
        }

        try:
            # 1. Генерируем предложение
            logger.info(f"Processing word: {word['kazakh_word']} (ID: {word['id']})")
            
            sentence_data = await self.generate_sentence(word)
            if not sentence_data:
                result['errors'].append('Failed to generate sentence')
                return result

            # 2. Создаем предложение в базе данных
            sentence_id = await self.create_example_sentence(word['id'], sentence_data)
            if not sentence_id:
                result['errors'].append('Failed to create sentence in database')
                return result
            
            result['sentence_created'] = True
            logger.info(f"Created sentence for {word['kazakh_word']}: {sentence_data['kazakh_sentence']}")

            # 3. Создаем переводы для всех языков
            for target_language in self.target_languages:
                try:
                    # Переводим предложение
                    translated_sentence = await self.translate_sentence(
                        sentence_data['kazakh_sentence'], 
                        target_language
                    )
                    
                    if translated_sentence:
                        # Создаем запись перевода
                        translation_created = await self.create_translation(
                            sentence_id, 
                            target_language['code'], 
                            translated_sentence
                        )
                        
                        if translation_created:
                            result['translations_created'] += 1
                            logger.info(f"Created {target_language['name']} translation: {translated_sentence}")
                        else:
                            result['errors'].append(f'Failed to save {target_language["name"]} translation')
                    else:
                        result['errors'].append(f'Failed to translate to {target_language["name"]}')
                        
                except Exception as e:
                    error_msg = f'Error translating to {target_language["name"]}: {str(e)}'
                    result['errors'].append(error_msg)
                    logger.error(error_msg)

        except Exception as e:
            error_msg = f'Error processing word {word["kazakh_word"]}: {str(e)}'
            result['errors'].append(error_msg)
            logger.error(error_msg)

        return result

    async def process_all_words(self, max_words: int = 50, delay_between_words: float = 3.0):
        """Обработать все слова без предложений"""
        
        # Получаем слова без предложений
        words = await self.get_words_without_sentences(max_words)
        
        if not words:
            logger.info("No words found without sentences")
            return {
                'total_words': 0,
                'processed': 0,
                'sentences_created': 0,
                'translations_created': 0,
                'failed': 0
            }

        logger.info(f"Found {len(words)} words without sentences. Starting processing...")

        stats = {
            'total_words': len(words),
            'processed': 0,
            'sentences_created': 0,
            'translations_created': 0,
            'failed': 0,
            'words_details': []
        }

        for i, word in enumerate(words, 1):
            try:
                result = await self.process_word_with_translations(word)
                stats['processed'] += 1
                
                if result['sentence_created']:
                    stats['sentences_created'] += 1
                else:
                    stats['failed'] += 1
                
                stats['translations_created'] += result['translations_created']
                stats['words_details'].append(result)
                
                # Логируем прогресс
                logger.info(f"Progress: {i}/{len(words)} processed")
                
                if result['errors']:
                    logger.warning(f"Errors for {word['kazakh_word']}: {', '.join(result['errors'])}")

                # Задержка между словами
                if i < len(words):
                    await asyncio.sleep(delay_between_words)
                    
            except Exception as e:
                stats['failed'] += 1
                logger.error(f"Unexpected error processing {word['kazakh_word']}: {e}")

        # Финальный отчет
        logger.info("=" * 50)
        logger.info("SENTENCE GENERATION WITH TRANSLATIONS COMPLETE!")
        logger.info(f"Total words: {stats['total_words']}")
        logger.info(f"Processed: {stats['processed']}")
        logger.info(f"Sentences created: {stats['sentences_created']}")
        logger.info(f"Translations created: {stats['translations_created']}")
        logger.info(f"Failed: {stats['failed']}")
        
        if stats['processed'] > 0:
            success_rate = (stats['sentences_created'] / stats['processed']) * 100
            translation_rate = (stats['translations_created'] / (stats['sentences_created'] * len(self.target_languages))) * 100 if stats['sentences_created'] > 0 else 0
            logger.info(f"Success rate: {success_rate:.1f}%")
            logger.info(f"Translation rate: {translation_rate:.1f}%")

        return stats


async def main():
    """Главная функция"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate sentences with translations for Kazakh words')
    parser.add_argument('--api-url', required=True, help='Base URL of your API (e.g., http://localhost:8000)')
    parser.add_argument('--token', help='API authentication token (will prompt if not provided)')
    parser.add_argument('--max-words', type=int, default=50, help='Maximum number of words to process')
    parser.add_argument('--delay', type=float, default=3.0, help='Delay between words in seconds (default: 3.0)')
    
    args = parser.parse_args()
    
    # Получаем токен
    api_token = args.token
    if not api_token:
        api_token = input("Enter your API authentication token: ").strip()
    
    if not api_token:
        logger.error("API token is required")
        return
    
    # Проверяем переменные окружения
    if not os.getenv('OPENAI_API_KEY'):
        logger.error("OPENAI_API_KEY environment variable not found")
        return
    
    # Запускаем сервис
    try:
        service = SentenceGenerationService(args.api_url, api_token)
        await service.process_all_words(
            max_words=args.max_words,
            delay_between_words=args.delay
        )
    except Exception as e:
        logger.error(f"Service failed: {e}")


if __name__ == "__main__":
    asyncio.run(main())