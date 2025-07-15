# seed_multilingual_guides.py - Create guides with translations
import asyncio
import sys
import os

# Add the project root to Python path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

from database import AsyncSessionLocal, init_database
from database.guide_crud import LearningGuideCRUD, GuideTranslationCRUD
from database.learning_models import LearningGuide
from sqlalchemy import select


async def create_multilingual_guides():
    """Create guides with multilingual support"""
    
    # Guide data with translations
    guides_data = [
        {
            'guide_key': 'greetings',
            'title': 'Greeting and Introduction',  # Default English
            'description': 'Basic phrases for meeting and greeting people',
            'icon_name': 'Users',
            'color': 'blue',
            'difficulty_level': 'beginner',
            'estimated_minutes': 20,
            'target_word_count': 15,
            'topics': ['Greeting', 'Introduction', 'Politeness'],
            'keywords': ['сәлем', 'кешіріңіз', 'рахмет', 'қоштасу', 'таныстыру'],
            'sort_order': 1,
            'translations': {
                'ru': {
                    'title': 'Приветствие и знакомство',
                    'description': 'Основные фразы для знакомства и приветствия',
                    'topics': ['Приветствие', 'Знакомство', 'Вежливость']
                },
                'kk': {
                    'title': 'Сәлемдесу және танысу',
                    'description': 'Танысу және сәлемдесу үшін негізгі сөйлемдер',
                    'topics': ['Сәлемдесу', 'Танысу', 'Сыпайылық']
                }
            }
        },
        {
            'guide_key': 'family',
            'title': 'Family and Relatives',
            'description': 'Words to describe family relationships',
            'icon_name': 'Heart',
            'color': 'red',
            'difficulty_level': 'beginner',
            'estimated_minutes': 25,
            'target_word_count': 20,
            'topics': ['Family', 'Relatives', 'Relationships'],
            'keywords': ['отбасы', 'ата', 'ана', 'бала', 'туыс', 'жұбайлас'],
            'sort_order': 2,
            'translations': {
                'ru': {
                    'title': 'Семья и родственники',
                    'description': 'Слова для описания семейных отношений',
                    'topics': ['Семья', 'Родственники', 'Отношения']
                },
                'kk': {
                    'title': 'Отбасы және туыстар',
                    'description': 'Отбасылық қатынастарды сипаттау үшін сөздер',
                    'topics': ['Отбасы', 'Туыстар', 'Қатынастар']
                }
            }
        },
        {
            'guide_key': 'home',
            'title': 'Home and Household',
            'description': 'Household items and rooms',
            'icon_name': 'Home',
            'color': 'green',
            'difficulty_level': 'beginner',
            'estimated_minutes': 30,
            'target_word_count': 25,
            'topics': ['Home', 'Furniture', 'Rooms', 'Household'],
            'keywords': ['үй', 'бөлме', 'жиһаз', 'ас үй', 'жатын бөлме'],
            'sort_order': 3,
            'translations': {
                'ru': {
                    'title': 'Дом и быт',
                    'description': 'Предметы домашнего обихода и комнаты',
                    'topics': ['Дом', 'Мебель', 'Комнаты', 'Быт']
                },
                'kk': {
                    'title': 'Үй және тұрмыс',
                    'description': 'Үй заттары және бөлмелер',
                    'topics': ['Үй', 'Жиһаз', 'Бөлмелер', 'Тұрмыс']
                }
            }
        },
        {
            'guide_key': 'food',
            'title': 'Food and Drinks',
            'description': 'Names of dishes, products and beverages',
            'icon_name': 'Utensils',
            'color': 'orange',
            'difficulty_level': 'intermediate',
            'estimated_minutes': 35,
            'target_word_count': 30,
            'topics': ['Food', 'Drinks', 'Kitchen', 'Restaurants'],
            'keywords': ['тамақ', 'ас', 'сусын', 'нан', 'ет', 'көкөніс'],
            'sort_order': 4,
            'translations': {
                'ru': {
                    'title': 'Еда и напитки',
                    'description': 'Названия блюд, продуктов и напитков',
                    'topics': ['Еда', 'Напитки', 'Кухня', 'Рестораны']
                },
                'kk': {
                    'title': 'Тамақ және сусындар',
                    'description': 'Тағамдар, өнімдер және сусындардың атаулары',
                    'topics': ['Тамақ', 'Сусындар', 'Ас үй', 'Мейрамханалар']
                }
            }
        },
        {
            'guide_key': 'transport',
            'title': 'Transport and Travel',
            'description': 'Types of transport and travel words',
            'icon_name': 'Car',
            'color': 'purple',
            'difficulty_level': 'intermediate',
            'estimated_minutes': 30,
            'target_word_count': 22,
            'topics': ['Transport', 'Travel', 'Road'],
            'keywords': ['көлік', 'жол', 'саяхат', 'аэропорт', 'автобус'],
            'sort_order': 5,
            'translations': {
                'ru': {
                    'title': 'Транспорт и путешествия',
                    'description': 'Виды транспорта и слова для поездок',
                    'topics': ['Транспорт', 'Путешествия', 'Дорога']
                },
                'kk': {
                    'title': 'Көлік және саяхат',
                    'description': 'Көлік түрлері және саяхат сөздері',
                    'topics': ['Көлік', 'Саяхат', 'Жол']
                }
            }
        },
        {
            'guide_key': 'work',
            'title': 'Work and Professions',
            'description': 'Job titles and work vocabulary',
            'icon_name': 'Briefcase',
            'color': 'indigo',
            'difficulty_level': 'intermediate',
            'estimated_minutes': 40,
            'target_word_count': 28,
            'topics': ['Professions', 'Work', 'Office', 'Career'],
            'keywords': ['жұмыс', 'маман', 'кеңсе', 'мансап', 'қызмет'],
            'sort_order': 6,
            'translations': {
                'ru': {
                    'title': 'Работа и профессии',
                    'description': 'Названия профессий и рабочая лексика',
                    'topics': ['Профессии', 'Работа', 'Офис', 'Карьера']
                },
                'kk': {
                    'title': 'Жұмыс және мамандықтар',
                    'description': 'Мамандық атаулары және жұмыс сөздері',
                    'topics': ['Мамандықтар', 'Жұмыс', 'Кеңсе', 'Мансап']
                }
            }
        },
        {
            'guide_key': 'education',
            'title': 'Education and Learning',
            'description': 'School and university vocabulary',
            'icon_name': 'GraduationCap',
            'color': 'blue',
            'difficulty_level': 'advanced',
            'estimated_minutes': 45,
            'target_word_count': 35,
            'topics': ['School', 'University', 'Science', 'Learning'],
            'keywords': ['білім', 'мектеп', 'университет', 'сабақ', 'ғылым'],
            'sort_order': 7,
            'translations': {
                'ru': {
                    'title': 'Образование и учеба',
                    'description': 'Школьная и университетская лексика',
                    'topics': ['Школа', 'Университет', 'Наука', 'Учеба']
                },
                'kk': {
                    'title': 'Білім және оқу',
                    'description': 'Мектеп және университет сөздері',
                    'topics': ['Мектеп', 'Университет', 'Ғылым', 'Оқу']
                }
            }
        },
        {
            'guide_key': 'time',
            'title': 'Time and Calendar',
            'description': 'Days of the week, months, time of day',
            'icon_name': 'Clock',
            'color': 'teal',
            'difficulty_level': 'beginner',
            'estimated_minutes': 25,
            'target_word_count': 18,
            'topics': ['Time', 'Calendar', 'Days', 'Months'],
            'keywords': ['уақыт', 'күн', 'ай', 'жыл', 'сағат', 'апта'],
            'sort_order': 8,
            'translations': {
                'ru': {
                    'title': 'Время и календарь',
                    'description': 'Дни недели, месяцы, время суток',
                    'topics': ['Время', 'Календарь', 'Дни недели', 'Месяцы']
                },
                'kk': {
                    'title': 'Уақыт және күнтізбе',
                    'description': 'Апта күндері, айлар, тәулік уақыты',
                    'topics': ['Уақыт', 'Күнтізбе', 'Апта күндері', 'Айлар']
                }
            }
        }
    ]

    async with AsyncSessionLocal() as db:
        print("🌱 Creating multilingual learning guides...")
        
        created_count = 0
        translation_count = 0
        
        for guide_data in guides_data:
            try:
                # Check if guide already exists
                query = select(LearningGuide).where(LearningGuide.guide_key == guide_data['guide_key'])
                result = await db.execute(query)
                existing_guide = result.scalar_one_or_none()
                
                if existing_guide:
                    print(f"📚 Guide '{guide_data['title']}' already exists, updating translations...")
                    guide = existing_guide
                else:
                    # Extract translations before creating guide
                    translations = guide_data.pop('translations', {})
                    
                    # Create new guide
                    guide = await LearningGuideCRUD.create_guide_with_translations(
                        db, guide_data, translations
                    )
                    print(f"✅ Created guide: {guide.title}")
                    created_count += 1
                    translation_count += len(translations)
                    continue
                
                # Update translations for existing guide
                translations = guide_data.get('translations', {})
                for lang_code, translation_data in translations.items():
                    try:
                        await GuideTranslationCRUD.create_translation(
                            db,
                            guide_id=guide.id,
                            language_code=lang_code,
                            title=translation_data['title'],
                            description=translation_data.get('description'),
                            topics=translation_data.get('topics')
                        )
                        translation_count += 1
                        print(f"  ✅ Added {lang_code} translation")
                    except Exception as e:
                        print(f"  ⚠️ Failed to add {lang_code} translation: {e}")
                
            except Exception as e:
                print(f"❌ Error processing guide '{guide_data['title']}': {e}")
                continue
        
        print(f"\n✅ Processing complete!")
        print(f"📚 Created {created_count} new guides")
        print(f"🌍 Added {translation_count} translations")
        print(f"🔧 Supported languages: English (en), Russian (ru), Kazakh (kk)")
        print("\n🚀 Next steps:")
        print("1. Start your FastAPI server")
        print("2. Set your language preference via /auth/set-main-language")
        print("3. Go to /app/guides - guides will appear in your language!")


async def main():
    """Main function"""
    try:
        print("🚀 Setting up multilingual learning guides...")
        
        # Ensure database exists
        await init_database()
        print("✅ Database tables ready")
        
        # Create guides with translations
        await create_multilingual_guides()
        
        print("\n🎉 Multilingual setup complete!")
        print("📋 Summary:")
        print("  - Guides are stored with default English content")
        print("  - Russian and Kazakh translations are available")
        print("  - API automatically serves content in user's preferred language")
        print("  - Keywords remain in Kazakh for search functionality")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())