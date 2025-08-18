// src/services/learningAPI.ts - Расширенный API для изучения
import api from './api';
import type { 
  UserWordProgressWithWord, 
  UserWordProgress,
  LearningStats,
  PracticeSession,
  LearningFilters 
} from '../types/api';
import { LEARNING_STATUSES, type LearningStatus, type DifficultyRating } from '../types/learning';

export interface LearningAPIFilters {
  status?: LearningStatus;
  category_id?: number;
  difficulty_level_id?: number;
  limit?: number;
  offset?: number;
}

export interface UpdateWordProgressData {
  status?: LearningStatus;
  difficulty_rating?: DifficultyRating;
  user_notes?: string;
  was_correct?: boolean;
}

export interface AddMultipleWordsRequest {
  word_ids: number[];
  status: LearningStatus;
}

export interface ReviewStats {
  due_now: number;
  due_today: number;
  overdue: number;
}

export interface ReviewTriggerRequest {
  review_type: 'immediate' | 'scheduled';
  days_from_now?: number;
}

export interface BatchReviewRequest {
  word_ids: number[];
  review_type: 'immediate' | 'scheduled';
  days_from_now?: number;
}

export const learningAPI = {
  // Получить прогресс изучения слов с фильтрами
  async getProgress(filters: LearningAPIFilters = {}): Promise<UserWordProgressWithWord[]> {
    const params = new URLSearchParams();
    
    if (filters.status) params.append('status', filters.status);
    if (filters.category_id !== undefined) params.append('category_id', filters.category_id.toString());
    if (filters.difficulty_level_id !== undefined) params.append('difficulty_level_id', filters.difficulty_level_id.toString());
    if (filters.limit !== undefined) params.append('limit', filters.limit.toString());
    if (filters.offset !== undefined) params.append('offset', filters.offset.toString());
  
    // Use the existing endpoint that works
    const response = await api.get(`/learning/words/my-list?${params.toString()}`);
    return response.data;
  },

  // Обновить прогресс изучения слова
  async updateWordProgress(wordId: number, data: UpdateWordProgressData): Promise<UserWordProgress> {
    const response = await api.put(`/learning/words/${wordId}/progress`, data);
    return response.data;
  },

  // Добавить слово в список изучения
  async addWordToLearning(wordId: number, status: LearningStatus = 'want_to_learn'): Promise<UserWordProgress> {
    const response = await api.post(`/learning/words/${wordId}/add?status=${status}`);
    return response.data;
  },

  // Добавить несколько слов в список изучения
  async addMultipleWords(data: AddMultipleWordsRequest): Promise<UserWordProgress[]> {
    const response = await api.post('/learning/words/add-multiple', data);
    return response.data;
  },

  // Удалить слово из списка изучения
  async removeWordFromLearning(wordId: number): Promise<void> {
    await api.delete(`/learning/words/${wordId}`);
  },

  // Получить статистику изучения
  async getStats(): Promise<LearningStats> {
    const response = await api.get('/learning/stats');
    return response.data;
  },

  // Получить слова для повторения
  async getWordsForReview(limit: number = 20): Promise<UserWordProgressWithWord[]> {
    const response = await api.get(`/learning/words/review?limit=${limit}`);
    return response.data;
  },

  // Начать сессию практики
  async startPracticeSession(data: {
    session_type: string;
    word_count: number;
    category_id?: number;
    difficulty_level_id?: number;
    language_code?: string;
  }): Promise<PracticeSession> {
    const response = await api.post('/learning/practice/start-session', data);
    return response.data;
  },

  // Отправить ответ в практике
  async submitPracticeAnswer(sessionId: number, data: {
    word_id: number;
    was_correct: boolean;
    user_answer?: string;
    correct_answer?: string;
    response_time_ms?: number;
  }): Promise<{ message: string; was_correct: boolean }> {
    // Build query parameters exactly as backend expects
    const params = new URLSearchParams();
    params.append('word_id', data.word_id.toString());
    params.append('was_correct', data.was_correct.toString());
    
    if (data.user_answer) {
      params.append('user_answer', data.user_answer);
    }
    
    if (data.correct_answer) {
      params.append('correct_answer', data.correct_answer);
    }
    
    if (data.response_time_ms !== undefined) {
      params.append('response_time_ms', data.response_time_ms.toString());
    }
  
    const url = `/learning/practice/${sessionId}/answer?${params}`;
    
    console.log('🚀 Submitting to URL:', url);
    
    // POST request with empty body since all data is in query parameters
    const response = await api.post(url);
    return response.data;
  },
  async submitPracticeAnswer2(
    sessionId: number,
    wordId: number,
    wasCorrect: boolean,
    userAnswer?: string,
    correctAnswer?: string,
    responseTimeMs?: number
  ): Promise<void> {
    // Build query parameters exactly as your backend expects
    const params = new URLSearchParams();
    params.append('word_id', wordId.toString());
    params.append('was_correct', wasCorrect.toString());
    
    if (userAnswer) {
      params.append('user_answer', userAnswer);
    }
    
    if (correctAnswer) {
      params.append('correct_answer', correctAnswer);
    }
    
    if (responseTimeMs !== undefined) {
      params.append('response_time_ms', responseTimeMs.toString());
    }

    const url = `/learning/practice/${sessionId}/answer?${params}`;
    
    console.log('🚀 Submitting to URL:', url);
    
    // POST request with empty body since all data is in query parameters
    await api.post(url);
  },

  // Завершить сессию практики
  async finishPracticeSession(sessionId: number, durationSeconds?: number): Promise<any> {
    const response = await api.post(`/learning/practice/${sessionId}/finish`, {
      duration_seconds: durationSeconds
    });
    return response.data;
  },

  // Получить dashboard данные
  async getDashboard(): Promise<any> {
    const response = await api.get('/learning/dashboard');
    return response.data;
  },
  
  async getLearnedWords(filters: LearningAPIFilters & { 
    include_mastered?: boolean; 
    language_code?: string; 
  } = {}): Promise<UserWordProgressWithWord[]> {
    const params = new URLSearchParams();
    
    // Required/recommended parameters based on working curl
    if (filters.limit !== undefined) params.append('limit', filters.limit.toString());
    if (filters.include_mastered !== undefined) params.append('include_mastered', filters.include_mastered.toString());
    if (filters.language_code) params.append('language_code', filters.language_code);
    
    // Optional filters
    if (filters.category_id !== undefined) params.append('category_id', filters.category_id.toString());
    if (filters.difficulty_level_id !== undefined) params.append('difficulty_level_id', filters.difficulty_level_id.toString());
    if (filters.offset !== undefined) params.append('offset', filters.offset.toString());
  
    const response = await api.get(`/learning-module/words/learned?${params.toString()}`);
    
    // 🔍 DEBUG: Log the raw response to see the actual structure
    console.log('🔍 Raw backend response:', JSON.stringify(response.data, null, 2));
    
    // The backend returns an object with { words: [], total_words: number, ... }
    // We need to extract the words array
    return response.data.words || [];
  },
  
  async triggerWordReview(
    wordId: number, 
    request: ReviewTriggerRequest
  ): Promise<{ message: string; word_id: number; review_type: string }> {
    const params = new URLSearchParams({
      review_type: request.review_type,
      ...(request.days_from_now && { days_from_now: request.days_from_now.toString() })
    });
    
    const response = await api.post(`/learning/words/${wordId}/review?${params}`);
    return response.data;
  },

  async getReviewStats(): Promise<ReviewStats> {
    const response = await api.get('/learning/review/statistics');
    return response.data;
  },

  async batchTriggerReviews(request: BatchReviewRequest) {
    const response = await api.post('/learning/review/batch-trigger', request);
    return response.data;
  },
  
};

export default learningAPI;