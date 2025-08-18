// src/types/learning.ts - Дополнительные типы для системы изучения

// Основные типы статусов как строковые литералы
export type LearningStatus = 'want_to_learn' | 'learning' | 'learned' | 'mastered' | 'review';
export type DifficultyRating = 'very_easy' | 'easy' | 'medium' | 'hard' | 'very_hard';

// Интерфейсы для новых функций
export interface LearnedWordFilter {
  status?: LearningStatus;
  category_id?: number;
  search?: string;
  favorites_only?: boolean;
  limit?: number;
  offset?: number;
}

export interface LearningGuide {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  wordCount: number;
  topics: string[];
  keywords: string[];
}

export interface GuideProgress {
  guideId: string;
  completedWords: number;
  totalWords: number;
  isStarted: boolean;
  isCompleted: boolean;
}

export interface PracticeSessionConfig {
  session_type: string;
  word_count: number;
  category_id?: number;
  difficulty_level_id?: number;
  language_code?: string;
}

export interface PracticeAnswer {
  word_id: number;
  was_correct: boolean;
  user_answer?: string;
  correct_answer?: string;
  response_time_ms?: number;
}

// Расширенные ответы API
export interface EnhancedPracticeSession {
  session_id: number;
  words: any[];
  session_type: string;
  total_words: number;
  learning_words_count?: number;
  random_words_count?: number;
}

export interface WordProgressUpdate {
  status?: LearningStatus;
  difficulty_rating?: DifficultyRating;
  user_notes?: string;
  was_correct?: boolean;
  is_favorite?: boolean;
}

export interface FavoriteToggle {
  wordId: number;
  isFavorite: boolean;
}

// Константы для статусов
export const LEARNING_STATUSES = {
  WANT_TO_LEARN: 'want_to_learn' as const,
  LEARNING: 'learning' as const,
  LEARNED: 'learned' as const,
  MASTERED: 'mastered' as const,
  REVIEW: 'review' as const,
} as const;

export const DIFFICULTY_RATINGS = {
  VERY_EASY: 'very_easy' as const,
  EASY: 'easy' as const,
  MEDIUM: 'medium' as const,
  HARD: 'hard' as const,
  VERY_HARD: 'very_hard' as const,
} as const;

// Константы для различных групп статусов
export const LEARNED_STATUSES: LearningStatus[] = [
  LEARNING_STATUSES.LEARNED,
  LEARNING_STATUSES.MASTERED,
];

export const IN_PROGRESS_STATUSES: LearningStatus[] = [
  LEARNING_STATUSES.WANT_TO_LEARN,
  LEARNING_STATUSES.LEARNING,
  LEARNING_STATUSES.REVIEW,
];

// Утилитарные функции для работы со статусами
export const isLearnedStatus = (status: LearningStatus): boolean => {
  return LEARNED_STATUSES.includes(status);
};

