# database/seed_data.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from .models import (
    Language, Category, CategoryTranslation, WordType, WordTypeTranslation,
    DifficultyLevel, DifficultyLevelTranslation, KazakhWord, Translation,
    Pronunciation, WordImage, ExampleSentence, ExampleSentenceTranslation
)
from .auth_models import User, UserRole
from .auth_crud import UserCRUD
from .learning_models import (
    UserWordProgress, LearningStatus, DifficultyRating,
    UserLearningGoal, UserAchievement, UserStreak
)
from .learning_crud import UserWordProgressCRUD, UserLearningGoalCRUD, UserStreakCRUD
from auth.utils import get_password_hash


class DatabaseSeeder:
    """Seed the database with initial data including learning features"""

    @staticmethod
    async def seed_all(db: AsyncSession):
        """Seed all data"""
        print("🌱 Starting database seeding...")

        # Seed languages first (required for translations)
        await DatabaseSeeder.seed_languages(db)

        # Seed categories
        await DatabaseSeeder.seed_categories(db)

        # Seed word types
        await DatabaseSeeder.seed_word_types(db)

        # Seed difficulty levels
        await DatabaseSeeder.seed_difficulty_levels(db)

        # Seed sample words
        await DatabaseSeeder.seed_sample_words(db)

        # Seed users (including admin)
        await DatabaseSeeder.seed_users(db)

        # Seed learning data (sample progress, goals, achievements)
        await DatabaseSeeder.seed_learning_data(db)

        print("✅ Database seeding completed!")

    @staticmethod
    async def seed_languages(db: AsyncSession):
        """Seed languages"""
        print("📝 Seeding languages...")

        languages_data = [
            {"language_code": "en", "language_name": "English"},
            {"language_code": "ru", "language_name": "Русский"},
            {"language_code": "kk", "language_name": "Қазақша"},
            {"language_code": "es", "language_name": "Español"},
            {"language_code": "fr", "language_name": "Français"},
            {"language_code": "de", "language_name": "Deutsch"},
            {"language_code": "zh", "language_name": "中文"},
            {"language_code": "ar", "language_name": "العربية"},
        ]

        for lang_data in languages_data:
            # Check if language already exists
            result = await db.execute(
                select(Language).where(Language.language_code == lang_data["language_code"])
            )
            existing_lang = result.scalar_one_or_none()

            if not existing_lang:
                language = Language(**lang_data)
                db.add(language)
                print(f"  ➕ Added language: {lang_data['language_name']} ({lang_data['language_code']})")
            else:
                print(f"  ✅ Language already exists: {lang_data['language_name']}")

        await db.commit()

    @staticmethod
    async def seed_categories(db: AsyncSession):
        """Seed categories with translations"""
        print("📂 Seeding categories...")

        # Get languages for translations
        result = await db.execute(select(Language))
        languages = {lang.language_code: lang for lang in result.scalars().all()}

        categories_data = [
            {
                "category_name": "animals",
                "description": "Animals and wildlife",
                "translations": {
                    "en": {"name": "Animals", "desc": "Animals and wildlife"},
                    "ru": {"name": "Животные", "desc": "Животные и дикая природа"},
                    "kk": {"name": "Жануарлар", "desc": "Жануарлар мен жабайы табиғат"},
                }
            },
            {
                "category_name": "food",
                "description": "Food and drinks",
                "translations": {
                    "en": {"name": "Food & Drinks", "desc": "Food and beverages"},
                    "ru": {"name": "Еда и напитки", "desc": "Еда и напитки"},
                    "kk": {"name": "Тағам және сусындар", "desc": "Тағам мен сусындар"},
                }
            },
            {
                "category_name": "family",
                "description": "Family members",
                "translations": {
                    "en": {"name": "Family", "desc": "Family members and relationships"},
                    "ru": {"name": "Семья", "desc": "Члены семьи и отношения"},
                    "kk": {"name": "Отбасы", "desc": "Отбасы мүшелері және қарым-қатынас"},
                }
            },
            {
                "category_name": "colors",
                "description": "Colors and shades",
                "translations": {
                    "en": {"name": "Colors", "desc": "Colors and shades"},
                    "ru": {"name": "Цвета", "desc": "Цвета и оттенки"},
                    "kk": {"name": "Түстер", "desc": "Түстер мен реңктер"},
                }
            },
            {
                "category_name": "numbers",
                "description": "Numbers and counting",
                "translations": {
                    "en": {"name": "Numbers", "desc": "Numbers and counting"},
                    "ru": {"name": "Числа", "desc": "Числа и счет"},
                    "kk": {"name": "Сандар", "desc": "Сандар мен санау"},
                }
            },
            {
                "category_name": "body",
                "description": "Body parts",
                "translations": {
                    "en": {"name": "Body Parts", "desc": "Parts of the human body"},
                    "ru": {"name": "Части тела", "desc": "Части человеческого тела"},
                    "kk": {"name": "Дене мүшелері", "desc": "Адам денесінің бөліктері"},
                }
            },
            {
                "category_name": "greetings",
                "description": "Greetings and common phrases",
                "translations": {
                    "en": {"name": "Greetings", "desc": "Greetings and common phrases"},
                    "ru": {"name": "Приветствия", "desc": "Приветствия и общие фразы"},
                    "kk": {"name": "Сәлемдесу", "desc": "Сәлемдесу мен жалпы сөйлемдер"},
                }
            }
        ]

        for cat_data in categories_data:
            # Check if category exists
            result = await db.execute(
                select(Category).where(Category.category_name == cat_data["category_name"])
            )
            existing_cat = result.scalar_one_or_none()

            if not existing_cat:
                # Create category
                category = Category(
                    category_name=cat_data["category_name"],
                    description=cat_data["description"]
                )
                db.add(category)
                await db.flush()  # Get the ID

                # Add translations
                for lang_code, trans_data in cat_data["translations"].items():
                    if lang_code in languages:
                        translation = CategoryTranslation(
                            category_id=category.id,
                            language_id=languages[lang_code].id,
                            translated_name=trans_data["name"],
                            translated_description=trans_data["desc"]
                        )
                        db.add(translation)

                print(f"  ➕ Added category: {cat_data['category_name']}")
            else:
                print(f"  ✅ Category already exists: {cat_data['category_name']}")

        await db.commit()

    @staticmethod
    async def seed_word_types(db: AsyncSession):
        """Seed word types with translations"""
        print("🔤 Seeding word types...")

        # Get languages
        result = await db.execute(select(Language))
        languages = {lang.language_code: lang for lang in result.scalars().all()}

        word_types_data = [
            {
                "type_name": "noun",
                "description": "Noun - person, place, thing",
                "translations": {
                    "en": {"name": "Noun", "desc": "Person, place, thing, or idea"},
                    "ru": {"name": "Существительное", "desc": "Человек, место, вещь или идея"},
                    "kk": {"name": "Зат есім", "desc": "Адам, орын, зат немесе идея"},
                }
            },
            {
                "type_name": "verb",
                "description": "Verb - action word",
                "translations": {
                    "en": {"name": "Verb", "desc": "Action or state of being"},
                    "ru": {"name": "Глагол", "desc": "Действие или состояние"},
                    "kk": {"name": "Етістік", "desc": "Әрекет немесе күй"},
                }
            },
            {
                "type_name": "adjective",
                "description": "Adjective - describing word",
                "translations": {
                    "en": {"name": "Adjective", "desc": "Describes nouns and pronouns"},
                    "ru": {"name": "Прилагательное", "desc": "Описывает существительные"},
                    "kk": {"name": "Сын есім", "desc": "Зат есімдерді сипаттайды"},
                }
            },
            {
                "type_name": "number",
                "description": "Number - counting word",
                "translations": {
                    "en": {"name": "Number", "desc": "Counting and quantity"},
                    "ru": {"name": "Числительное", "desc": "Счет и количество"},
                    "kk": {"name": "Сан есім", "desc": "Санау мен мөлшер"},
                }
            },
            {
                "type_name": "phrase",
                "description": "Phrase - common expression",
                "translations": {
                    "en": {"name": "Phrase", "desc": "Common expressions and phrases"},
                    "ru": {"name": "Фраза", "desc": "Общие выражения и фразы"},
                    "kk": {"name": "Сөйлем", "desc": "Жалпы сөйлемдер мен фразалар"},
                }
            }
        ]

        for wt_data in word_types_data:
            result = await db.execute(
                select(WordType).where(WordType.type_name == wt_data["type_name"])
            )
            existing_wt = result.scalar_one_or_none()

            if not existing_wt:
                word_type = WordType(
                    type_name=wt_data["type_name"],
                    description=wt_data["description"]
                )
                db.add(word_type)
                await db.flush()

                # Add translations
                for lang_code, trans_data in wt_data["translations"].items():
                    if lang_code in languages:
                        translation = WordTypeTranslation(
                            word_type_id=word_type.id,
                            language_id=languages[lang_code].id,
                            translated_name=trans_data["name"],
                            translated_description=trans_data["desc"]
                        )
                        db.add(translation)

                print(f"  ➕ Added word type: {wt_data['type_name']}")
            else:
                print(f"  ✅ Word type already exists: {wt_data['type_name']}")

        await db.commit()

    @staticmethod
    async def seed_difficulty_levels(db: AsyncSession):
        """Seed difficulty levels with translations"""
        print("📊 Seeding difficulty levels...")

        # Get languages
        result = await db.execute(select(Language))
        languages = {lang.language_code: lang for lang in result.scalars().all()}

        difficulty_levels_data = [
            {
                "level_number": 1,
                "level_name": "beginner",
                "description": "Basic words for beginners",
                "translations": {
                    "en": {"name": "Beginner", "desc": "Basic words for beginners"},
                    "ru": {"name": "Начинающий", "desc": "Базовые слова для начинающих"},
                    "kk": {"name": "Бастаушы", "desc": "Бастаушыларға арналған негізгі сөздер"},
                }
            },
            {
                "level_number": 2,
                "level_name": "elementary",
                "description": "Elementary level words",
                "translations": {
                    "en": {"name": "Elementary", "desc": "Elementary level words"},
                    "ru": {"name": "Элементарный", "desc": "Слова элементарного уровня"},
                    "kk": {"name": "Қарапайым", "desc": "Бастапқы деңгейдегі сөздер"},
                }
            },
            {
                "level_number": 3,
                "level_name": "intermediate",
                "description": "Intermediate level words",
                "translations": {
                    "en": {"name": "Intermediate", "desc": "Intermediate level words"},
                    "ru": {"name": "Средний", "desc": "Слова среднего уровня"},
                    "kk": {"name": "Орташа", "desc": "Орташа деңгейдегі сөздер"},
                }
            },
            {
                "level_number": 4,
                "level_name": "advanced",
                "description": "Advanced level words",
                "translations": {
                    "en": {"name": "Advanced", "desc": "Advanced level words"},
                    "ru": {"name": "Продвинутый", "desc": "Слова продвинутого уровня"},
                    "kk": {"name": "Жоғарғы", "desc": "Жоғарғы деңгейдегі сөздер"},
                }
            },
            {
                "level_number": 5,
                "level_name": "expert",
                "description": "Expert level words",
                "translations": {
                    "en": {"name": "Expert", "desc": "Expert level words"},
                    "ru": {"name": "Эксперт", "desc": "Экспертные слова"},
                    "kk": {"name": "Сарапшы", "desc": "Сарапшы деңгейіндегі сөздер"},
                }
            }
        ]

        for dl_data in difficulty_levels_data:
            result = await db.execute(
                select(DifficultyLevel).where(DifficultyLevel.level_number == dl_data["level_number"])
            )
            existing_dl = result.scalar_one_or_none()

            if not existing_dl:
                difficulty_level = DifficultyLevel(
                    level_number=dl_data["level_number"],
                    level_name=dl_data["level_name"],
                    description=dl_data["description"]
                )
                db.add(difficulty_level)
                await db.flush()

                # Add translations
                for lang_code, trans_data in dl_data["translations"].items():
                    if lang_code in languages:
                        translation = DifficultyLevelTranslation(
                            difficulty_level_id=difficulty_level.id,
                            language_id=languages[lang_code].id,
                            translated_name=trans_data["name"],
                            translated_description=trans_data["desc"]
                        )
                        db.add(translation)

                print(f"  ➕ Added difficulty level: {dl_data['level_name']}")
            else:
                print(f"  ✅ Difficulty level already exists: {dl_data['level_name']}")

        await db.commit()

    @staticmethod
    async def seed_sample_words(db: AsyncSession):
        """Seed sample Kazakh words"""
        print("📚 Seeding sample words...")

        # Get required data
        languages_result = await db.execute(select(Language))
        languages = {lang.language_code: lang for lang in languages_result.scalars().all()}

        categories_result = await db.execute(select(Category))
        categories = {cat.category_name: cat for cat in categories_result.scalars().all()}

        word_types_result = await db.execute(select(WordType))
        word_types = {wt.type_name: wt for wt in word_types_result.scalars().all()}

        difficulty_levels_result = await db.execute(select(DifficultyLevel))
        difficulty_levels = {dl.level_number: dl for dl in difficulty_levels_result.scalars().all()}

        # Extended sample words data
        words_data = [
            # Animals
            {
                "kazakh_word": "мысық", "kazakh_cyrillic": "мысық",
                "category": "animals", "word_type": "noun", "difficulty": 1,
                "translations": {
                    "en": "cat", "ru": "кошка", "es": "gato", "fr": "chat"
                },
                "pronunciations": {
                    "en": "muh-SUHK"
                }
            },
            {
                "kazakh_word": "ит", "kazakh_cyrillic": "ит",
                "category": "animals", "word_type": "noun", "difficulty": 1,
                "translations": {
                    "en": "dog", "ru": "собака", "es": "perro", "fr": "chien"
                },
                "pronunciations": {
                    "en": "eet"
                }
            },
            {
                "kazakh_word": "жылқы", "kazakh_cyrillic": "жылқы",
                "category": "animals", "word_type": "noun", "difficulty": 2,
                "translations": {
                    "en": "horse", "ru": "лошадь", "es": "caballo", "fr": "cheval"
                },
                "pronunciations": {
                    "en": "zhuh-LUH-kuh"
                }
            },
            {
                "kazakh_word": "сиыр", "kazakh_cyrillic": "сиыр",
                "category": "animals", "word_type": "noun", "difficulty": 1,
                "translations": {
                    "en": "cow", "ru": "корова", "es": "vaca", "fr": "vache"
                },
                "pronunciations": {
                    "en": "see-UHR"
                }
            },

            # Family
            {
                "kazakh_word": "ана", "kazakh_cyrillic": "ана",
                "category": "family", "word_type": "noun", "difficulty": 1,
                "translations": {
                    "en": "mother", "ru": "мать", "es": "madre", "fr": "mère"
                },
                "pronunciations": {
                    "en": "ah-NAH"
                }
            },
            {
                "kazakh_word": "әке", "kazakh_cyrillic": "әке",
                "category": "family", "word_type": "noun", "difficulty": 1,
                "translations": {
                    "en": "father", "ru": "отец", "es": "padre", "fr": "père"
                },
                "pronunciations": {
                    "en": "ah-KEH"
                }
            },
            {
                "kazakh_word": "бала", "kazakh_cyrillic": "бала",
                "category": "family", "word_type": "noun", "difficulty": 1,
                "translations": {
                    "en": "child", "ru": "ребенок", "es": "niño", "fr": "enfant"
                },
                "pronunciations": {
                    "en": "bah-LAH"
                }
            },

            # Colors
            {
                "kazakh_word": "қызыл", "kazakh_cyrillic": "қызыл",
                "category": "colors", "word_type": "adjective", "difficulty": 1,
                "translations": {
                    "en": "red", "ru": "красный", "es": "rojo", "fr": "rouge"
                },
                "pronunciations": {
                    "en": "kuh-ZUHL"
                }
            },
            {
                "kazakh_word": "көк", "kazakh_cyrillic": "көк",
                "category": "colors", "word_type": "adjective", "difficulty": 1,
                "translations": {
                    "en": "blue", "ru": "синий", "es": "azul", "fr": "bleu"
                },
                "pronunciations": {
                    "en": "kuhk"
                }
            },
            {
                "kazakh_word": "жасыл", "kazakh_cyrillic": "жасыл",
                "category": "colors", "word_type": "adjective", "difficulty": 1,
                "translations": {
                    "en": "green", "ru": "зеленый", "es": "verde", "fr": "vert"
                },
                "pronunciations": {
                    "en": "zhah-SUHL"
                }
            },
            {
                "kazakh_word": "ақ", "kazakh_cyrillic": "ақ",
                "category": "colors", "word_type": "adjective", "difficulty": 1,
                "translations": {
                    "en": "white", "ru": "белый", "es": "blanco", "fr": "blanc"
                },
                "pronunciations": {
                    "en": "ahk"
                }
            },

            # Numbers
            {
                "kazakh_word": "бір", "kazakh_cyrillic": "бір",
                "category": "numbers", "word_type": "number", "difficulty": 1,
                "translations": {
                    "en": "one", "ru": "один", "es": "uno", "fr": "un"
                },
                "pronunciations": {
                    "en": "beer"
                }
            },
            {
                "kazakh_word": "екі", "kazakh_cyrillic": "екі",
                "category": "numbers", "word_type": "number", "difficulty": 1,
                "translations": {
                    "en": "two", "ru": "два", "es": "dos", "fr": "deux"
                },
                "pronunciations": {
                    "en": "eh-KEE"
                }
            },
            {
                "kazakh_word": "үш", "kazakh_cyrillic": "үш",
                "category": "numbers", "word_type": "number", "difficulty": 1,
                "translations": {
                    "en": "three", "ru": "три", "es": "tres", "fr": "trois"
                },
                "pronunciations": {
                    "en": "oosh"
                }
            },

            # Food
            {
                "kazakh_word": "нан", "kazakh_cyrillic": "нан",
                "category": "food", "word_type": "noun", "difficulty": 1,
                "translations": {
                    "en": "bread", "ru": "хлеб", "es": "pan", "fr": "pain"
                },
                "pronunciations": {
                    "en": "nahn"
                }
            },
            {
                "kazakh_word": "ет", "kazakh_cyrillic": "ет",
                "category": "food", "word_type": "noun", "difficulty": 1,
                "translations": {
                    "en": "meat", "ru": "мясо", "es": "carne", "fr": "viande"
                },
                "pronunciations": {
                    "en": "eht"
                }
            },
            {
                "kazakh_word": "су", "kazakh_cyrillic": "су",
                "category": "food", "word_type": "noun", "difficulty": 1,
                "translations": {
                    "en": "water", "ru": "вода", "es": "agua", "fr": "eau"
                },
                "pronunciations": {
                    "en": "soo"
                }
            },

            # Body parts
            {
                "kazakh_word": "бас", "kazakh_cyrillic": "бас",
                "category": "body", "word_type": "noun", "difficulty": 1,
                "translations": {
                    "en": "head", "ru": "голова", "es": "cabeza", "fr": "tête"
                },
                "pronunciations": {
                    "en": "bahs"
                }
            },
            {
                "kazakh_word": "көз", "kazakh_cyrillic": "көз",
                "category": "body", "word_type": "noun", "difficulty": 1,
                "translations": {
                    "en": "eye", "ru": "глаз", "es": "ojo", "fr": "œil"
                },
                "pronunciations": {
                    "en": "kuhz"
                }
            },

            # Greetings
            {
                "kazakh_word": "сәлем", "kazakh_cyrillic": "сәлем",
                "category": "greetings", "word_type": "phrase", "difficulty": 1,
                "translations": {
                    "en": "hello", "ru": "привет", "es": "hola", "fr": "salut"
                },
                "pronunciations": {
                    "en": "sah-LEM"
                }
            },
            {
                "kazakh_word": "рахмет", "kazakh_cyrillic": "рахмет",
                "category": "greetings", "word_type": "phrase", "difficulty": 1,
                "translations": {
                    "en": "thank you", "ru": "спасибо", "es": "gracias", "fr": "merci"
                },
                "pronunciations": {
                    "en": "rah-MEHT"
                }
            }
        ]

        for word_data in words_data:
            # Check if word exists
            result = await db.execute(
                select(KazakhWord).where(KazakhWord.kazakh_word == word_data["kazakh_word"])
            )
            existing_word = result.scalar_one_or_none()

            if not existing_word:
                # Create word
                kazakh_word = KazakhWord(
                    kazakh_word=word_data["kazakh_word"],
                    kazakh_cyrillic=word_data["kazakh_cyrillic"],
                    word_type_id=word_types[word_data["word_type"]].id,
                    category_id=categories[word_data["category"]].id,
                    difficulty_level_id=difficulty_levels[word_data["difficulty"]].id
                )
                db.add(kazakh_word)
                await db.flush()

                # Add translations
                for lang_code, translation_text in word_data["translations"].items():
                    if lang_code in languages:
                        translation = Translation(
                            kazakh_word_id=kazakh_word.id,
                            language_id=languages[lang_code].id,
                            translation=translation_text
                        )
                        db.add(translation)

                # Add pronunciations
                for lang_code, pronunciation_text in word_data.get("pronunciations", {}).items():
                    if lang_code in languages:
                        pronunciation = Pronunciation(
                            kazakh_word_id=kazakh_word.id,
                            language_id=languages[lang_code].id,
                            pronunciation=pronunciation_text,
                            pronunciation_system="IPA-simplified"
                        )
                        db.add(pronunciation)

                print(f"  ➕ Added word: {word_data['kazakh_word']} ({word_data['translations']['en']})")
            else:
                print(f"  ✅ Word already exists: {word_data['kazakh_word']}")

        await db.commit()

    @staticmethod
    async def seed_users(db: AsyncSession):
        """Create sample users including admin with language preferences"""
        print("👤 Creating sample users...")

        users_data = [
            {
                "username": "admin",
                "email": "admin@kazakhlearn.com",
                "password": "admin123!",
                "full_name": "System Administrator",
                "role": UserRole.ADMIN,
                "main_language_code": "en"
            },
            {
                "username": "teacher",
                "email": "teacher@kazakhlearn.com",
                "password": "teacher123!",
                "full_name": "Sample Teacher",
                "role": UserRole.WRITER,
                "main_language_code": "en"
            },
            {
                "username": "student1",
                "email": "student1@kazakhlearn.com",
                "password": "student123!",
                "full_name": "Alice Johnson",
                "role": UserRole.STUDENT,
                "main_language_code": "en"
            },
            {
                "username": "student2",
                "email": "student2@kazakhlearn.com",
                "password": "student123!",
                "full_name": "Bob Smith",
                "role": UserRole.STUDENT,
                "main_language_code": "ru"
            },
            {
                "username": "demo",
                "email": "demo@kazakhlearn.com",
                "password": "demo123!",
                "full_name": "Demo User",
                "role": UserRole.STUDENT,
                "main_language_code": "kk"
            },
            {
                "username": "international",
                "email": "international@kazakhlearn.com",
                "password": "international123!",
                "full_name": "International Student",
                "role": UserRole.STUDENT,
                "main_language_code": "es"
            }
        ]

        for user_data in users_data:
            # Check if user exists
            existing_user = await UserCRUD.get_user_by_username(db, user_data["username"])

            if not existing_user:
                # Create user with main language preference
                hashed_password = get_password_hash(user_data["password"])

                user = await UserCRUD.create_user(
                    db=db,
                    username=user_data["username"],
                    email=user_data["email"],
                    hashed_password=hashed_password,
                    full_name=user_data["full_name"],
                    role=user_data["role"],
                    main_language_code=user_data["main_language_code"]
                )

                print(f"  ➕ Created user: {user_data['username']} ({user_data['role'].value})")
                print(f"     Email: {user_data['email']}")
                print(f"     Password: {user_data['password']}")
                print(f"     Main Language: {user_data['main_language_code']}")
            else:
                print(f"  ✅ User already exists: {user_data['username']}")

        await db.commit()
    @staticmethod
    async def seed_learning_data(db: AsyncSession):
        """Seed sample learning progress data"""
        print("📊 Seeding learning progress data...")

        # Get sample users and words
        users_result = await db.execute(
            select(User).where(User.role == UserRole.STUDENT)
        )
        students = users_result.scalars().all()

        if not students:
            print("  ⚠️  No student users found, skipping learning data seeding")
            return

        words_result = await db.execute(select(KazakhWord).limit(10))
        words = words_result.scalars().all()

        if not words:
            print("  ⚠️  No words found, skipping learning data seeding")
            return

        categories_result = await db.execute(select(Category))
        categories = categories_result.scalars().all()

        # Sample learning progress for first student
        student = students[0]
        print(f"  📚 Adding learning progress for: {student.username}")

        # Add some words to student's learning list with different statuses
        learning_words_data = [
            {"word_idx": 0, "status": LearningStatus.LEARNED, "times_seen": 5, "times_correct": 4,
             "difficulty": DifficultyRating.EASY},
            {"word_idx": 1, "status": LearningStatus.LEARNING, "times_seen": 3, "times_correct": 2,
             "difficulty": DifficultyRating.MEDIUM},
            {"word_idx": 2, "status": LearningStatus.WANT_TO_LEARN, "times_seen": 0, "times_correct": 0,
             "difficulty": None},
            {"word_idx": 3, "status": LearningStatus.MASTERED, "times_seen": 8, "times_correct": 7,
             "difficulty": DifficultyRating.VERY_EASY},
            {"word_idx": 4, "status": LearningStatus.REVIEW, "times_seen": 6, "times_correct": 3,
             "difficulty": DifficultyRating.HARD},
        ]

        for word_data in learning_words_data:
            if word_data["word_idx"] < len(words):
                word = words[word_data["word_idx"]]

                # Check if progress already exists
                existing_progress = await UserWordProgressCRUD.get_user_word_progress(
                    db, student.id, word.id
                )

                if not existing_progress:
                    # Calculate next review date based on status
                    next_review = None
                    if word_data["status"] in [LearningStatus.LEARNED, LearningStatus.REVIEW]:
                        next_review = datetime.utcnow() + timedelta(days=2)
                    elif word_data["status"] == LearningStatus.LEARNING:
                        next_review = datetime.utcnow() + timedelta(days=1)

                    progress = UserWordProgress(
                        user_id=student.id,
                        kazakh_word_id=word.id,
                        status=word_data["status"],
                        times_seen=word_data["times_seen"],
                        times_correct=word_data["times_correct"],
                        times_incorrect=word_data["times_seen"] - word_data["times_correct"],
                        difficulty_rating=word_data["difficulty"],
                        added_at=datetime.utcnow() - timedelta(days=7),
                        last_practiced_at=datetime.utcnow() - timedelta(days=1) if word_data[
                                                                                       "times_seen"] > 0 else None,
                        next_review_at=next_review,
                        first_learned_at=datetime.utcnow() - timedelta(days=3) if word_data["status"] in [
                            LearningStatus.LEARNED, LearningStatus.MASTERED] else None,
                        user_notes=f"Practice note for {word.kazakh_word}" if word_data["word_idx"] == 1 else None
                    )
                    db.add(progress)
                    print(f"    ➕ Added progress: {word.kazakh_word} ({word_data['status'].value})")

        # Create learning goals
        learning_goals_data = [
            {
                "goal_type": "daily_words",
                "target_value": 5,
                "current_value": 3,
                "category_id": categories[0].id if categories else None
            },
            {
                "goal_type": "weekly_practice",
                "target_value": 7,
                "current_value": 4,
                "category_id": None
            },
            {
                "goal_type": "category_mastery",
                "target_value": 10,
                "current_value": 2,
                "category_id": categories[1].id if len(categories) > 1 else None
            }
        ]

        for goal_data in learning_goals_data:
            goal = UserLearningGoal(
                user_id=student.id,
                goal_type=goal_data["goal_type"],
                target_value=goal_data["target_value"],
                current_value=goal_data["current_value"],
                category_id=goal_data["category_id"],
                start_date=datetime.utcnow() - timedelta(days=5),
                target_date=datetime.utcnow() + timedelta(days=25) if goal_data[
                                                                          "goal_type"] != "daily_words" else datetime.utcnow() + timedelta(
                    days=1)
            )
            db.add(goal)
            print(f"    🎯 Added goal: {goal_data['goal_type']}")

        # Create user streak
        streak = UserStreak(
            user_id=student.id,
            streak_type="daily",
            current_streak=5,
            longest_streak=12,
            last_activity_date=datetime.utcnow() - timedelta(hours=2),
            streak_start_date=datetime.utcnow() - timedelta(days=5)
        )
        db.add(streak)
        print(f"    🔥 Added streak: 5 days current, 12 days longest")

        # Create sample achievements
        achievements_data = [
            {
                "achievement_type": "first_word",
                "achievement_name": "First Word Learned",
                "description": "Learned your first Kazakh word!",
                "earned_at": datetime.utcnow() - timedelta(days=6)
            },
            {
                "achievement_type": "streak_5",
                "achievement_name": "5-Day Streak",
                "description": "Practiced for 5 consecutive days",
                "value": 5,
                "earned_at": datetime.utcnow() - timedelta(hours=2)
            },
            {
                "achievement_type": "category_progress",
                "achievement_name": "Animal Lover",
                "description": "Started learning animal words",
                "category_id": categories[0].id if categories else None,
                "earned_at": datetime.utcnow() - timedelta(days=4)
            }
        ]

        for achievement_data in achievements_data:
            achievement = UserAchievement(
                user_id=student.id,
                achievement_type=achievement_data["achievement_type"],
                achievement_name=achievement_data["achievement_name"],
                description=achievement_data["description"],
                category_id=achievement_data.get("category_id"),
                value=achievement_data.get("value"),
                earned_at=achievement_data["earned_at"]
            )
            db.add(achievement)
            print(f"    🏆 Added achievement: {achievement_data['achievement_name']}")

        # Add some progress for other students (less detailed)
        for student in students[1:3]:  # Add for 2 more students
            # Add a few words to their learning lists
            for i in range(3):
                if i < len(words):
                    word = words[i]
                    existing_progress = await UserWordProgressCRUD.get_user_word_progress(
                        db, student.id, word.id
                    )

                    if not existing_progress:
                        progress = UserWordProgress(
                            user_id=student.id,
                            kazakh_word_id=word.id,
                            status=LearningStatus.WANT_TO_LEARN,
                            added_at=datetime.utcnow() - timedelta(days=2)
                        )
                        db.add(progress)

            # Add a basic streak
            streak = UserStreak(
                user_id=student.id,
                streak_type="daily",
                current_streak=1,
                longest_streak=3,
                last_activity_date=datetime.utcnow() - timedelta(hours=8),
                streak_start_date=datetime.utcnow()
            )
            db.add(streak)

            print(f"  📚 Added basic learning data for: {student.username}")

        await db.commit()
        print("  ✅ Learning progress data seeded successfully!")


# Standalone script to run seeding
async def main():
    """Run database seeding"""
    from database import get_db, init_database

    # Initialize database
    await init_database()

    # Get database session
    from database.connection import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        await DatabaseSeeder.seed_all(db)


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())