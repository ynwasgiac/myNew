// src/types/api.ts

// Add this new interface for word sounds
export interface WordSound {
  id: number;
  kazakh_word_id: number;
  sound_path: string;
  sound_url: string;
  sound_type: string;
  alt_text?: string;
  created_at: string;
}

// Keep all your existing interfaces as they are...
export interface User {
    id: number;
    username: string;
    email: string;
    full_name?: string;
    role: 'student' | 'writer' | 'admin';
    is_active: boolean;
    created_at: string;
    main_language?: UserMainLanguage;
}

export interface UserMainLanguage {
    language_code: string;
    language_name: string;
}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface RegisterRequest {
    username: string;
    email: string;
    password: string;
    full_name?: string;
    role?: 'student' | 'writer' | 'admin';
    main_language_code?: string;
}

export interface AuthResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    user_role: 'student' | 'writer' | 'admin';
    user_language?: string;
}

export interface KazakhWord {
    id: number;
    kazakh_word: string;
    kazakh_cyrillic?: string;
    created_at: string;
    word_type: WordType;
    category: Category;
    difficulty_level: DifficultyLevel;
    translations: Translation[];
    pronunciations: Pronunciation[];
    images: WordImage[];
    example_sentences: ExampleSentence[];
}

export interface KazakhWordSummary {
    id: number;
    kazakh_word: string;
    kazakh_cyrillic?: string;
    word_type_name: string;
    category_name: string;
    difficulty_level: number;
    primary_translation?: string;
    primary_image?: string;
}

export interface Translation {
    id: number;
    translation: string;
    alternative_translations?: string[];
    language_code: string;
    created_at: string;
}

export interface Pronunciation {
    id: number;
    pronunciation: string;
    pronunciation_system?: string;
    audio_file_path?: string;
    language_code: string;
    created_at: string;
}

export interface WordImage {
    id: number;
    image_url?: string;
    image_type: string;
    alt_text?: string;
    is_primary: boolean;
    source?: string;
    license?: string;
    created_at: string;
}

export interface ExampleSentence {
    id: number;
    kazakh_sentence: string;
    difficulty_level: number;
    usage_context?: string;
    created_at: string;
    translations: ExampleSentenceTranslation[];
}

export interface ExampleSentenceTranslation {
    id: number;
    translated_sentence: string;
    language_code: string;
    created_at: string;
}

export interface Category {
    id: number;
    category_name: string;
    description?: string;
    is_active: boolean;
    created_at: string;
    translations: CategoryTranslation[];
}

export interface CategoryTranslation {
    id: number;
    translated_name: string;
    translated_description?: string;
    language_code: string;
}

export interface WordType {
    id: number;
    type_name: string;
    description?: string;
    is_active: boolean;
    created_at: string;
    translations: WordTypeTranslation[];
}

export interface WordTypeTranslation {
    id: number;
    translated_name: string;
    translated_description?: string;
    language_code: string;
}

export interface DifficultyLevel {
    id: number;
    level_number: number;
    level_name: string;
    description?: string;
    is_active: boolean;
    created_at: string;
    translations: DifficultyLevelTranslation[];
}

export interface DifficultyLevelTranslation {
    id: number;
    translated_name: string;
    translated_description?: string;
    language_code: string;
}

export interface Language {
    id: number;
    language_code: string;
    language_name: string;
    is_active: boolean;
    created_at: string;
}

// Learning Progress Types
export interface UserWordProgress {
    id: number;
    user_id: number;
    kazakh_word_id: number;
    status: 'want_to_learn' | 'learning' | 'learned' | 'mastered' | 'review';
    times_seen: number;
    times_correct: number;
    times_incorrect: number;
    difficulty_rating?: 'very_easy' | 'easy' | 'medium' | 'hard' | 'very_hard';
    added_at: string;
    first_learned_at?: string;
    last_practiced_at?: string;
    next_review_at?: string;
    repetition_interval: number;
    ease_factor: number;
    user_notes?: string;
    created_at: string;
    updated_at: string;
}

export interface LearningSession {
    id: number;
    user_id: number;
    session_type: string;
    words_studied: number;
    correct_answers: number;
    incorrect_answers: number;
    duration_seconds?: number;
    category_id?: number;
    difficulty_level_id?: number;
    started_at: string;
    finished_at?: string;
    created_at: string;
    accuracy_rate?: number;
}

export interface LearningStats {
    total_words: number;
    words_by_status: Record<string, number>;
    sessions_this_week: number;
    accuracy_rate: number;
    current_streak: number;
    words_due_review: number;
    total_correct: number;
    total_seen: number;
}

export interface PracticeWord {
  id: number;
  kazakh_word: string;
  kazakh_cyrillic?: string;
  translation: string;
  pronunciation?: string;
  image_url?: string;
  difficulty_level: number;
  times_seen: number;
  last_practiced?: string | null;
  is_review: boolean;
}

export interface PracticeSession {
  session_id: number;
  words: PracticeWord[];
  session_type: string;
  total_words: number;
}

export interface QuizQuestion {
    word_id: number;
    question_type: 'translation' | 'pronunciation' | 'multiple_choice' | 'listening' | 'spelling';
    question_text: string;
    question_language: string;
    answer_language: string;
    options?: string[];
    correct_answer: string;
}

export interface QuizAnswer {
    word_id: number;
    user_answer: string;
    response_time_ms?: number;
}

// API Response Types
export interface ApiResponse<T> {
    data: T;
    message?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    total_count: number;
    page: number;
    page_size: number;
    has_more: boolean;
}

// Filter and Search Types
export interface PaginationInfo {
    current_page: number;
    page_size: number;
    total_pages: number;
    start_index: number;
    end_index: number;
  }
  
  export interface PaginatedWordsResponse {
    words: KazakhWordSummary[];
    pagination: PaginationInfo;
    total_count: number;
    has_next: boolean;
    has_previous: boolean;
  }
  
  export interface WordFilters {
    page?: number;
    page_size?: number;
    search?: string;
    category_id?: number;
    word_type_id?: number;
    difficulty_level_id?: number;
    language_code?: string;
  }

export interface LearningFilters {
    status?: string;
    category_id?: number;
    difficulty_level_id?: number;
    due_for_review?: boolean;
    limit?: number;
    offset?: number;
}

export interface UserWordProgressWithWord extends UserWordProgress {
    kazakh_word: {
      id: number;
      kazakh_word: string;
      kazakh_cyrillic?: string;
      category_name?: string;
      difficulty_level?: number;
      translations: Array<{
        translation: string;
        language_code: string;
      }>;
      primary_image: string | undefined;
    };
}

export interface LearningWord {
  id: number;
  kazakh_word: string;
  kazakh_cyrillic?: string;
  translation: string;
  pronunciation?: string;
  image_url?: string;
  difficulty_level: number;
}