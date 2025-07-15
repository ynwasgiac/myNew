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

export const learningAPI = {
  // Получить прогресс изучения слов с фильтрами
  async getProgress(filters: LearningAPIFilters = {}): Promise<UserWordProgressWithWord[]> {
    const params = new URLSearchParams();
    
    if (filters.status) params.append('status', filters.status);
    if (filters.category_id !== undefined) params.append('category_id', filters.category_id.toString());
    if (filters.difficulty_level_id !== undefined) params.append('difficulty_level_id', filters.difficulty_level_id.toString());
    if (filters.limit !== undefined) params.append('limit', filters.limit.toString());
    if (filters.offset !== undefined) params.append('offset', filters.offset.toString());

    const response = await api.get(`/learning/words?${params.toString()}`);
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
    const response = await api.post(`/learning/practice/${sessionId}/answer`, {
      word_id: data.word_id,
      was_correct: data.was_correct,
      user_answer: data.user_answer,
      correct_answer: data.correct_answer,
      response_time_ms: data.response_time_ms
    });
    return response.data;
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
  }
};

export default learningAPI;