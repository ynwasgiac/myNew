// src/services/learningGuidesAPI.ts - ИСПРАВЛЕНО для работы с численными ID
import api from './api';

export interface LearningGuideAPI {
  id: number;  // ✅ ИСПРАВЛЕНО: изменено с string на number
  title: string;
  description: string;
  icon: string;
  color: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimated_time: string;
  word_count: number;
  topics: string[];
  keywords: string[];
  status: 'not_started' | 'in_progress' | 'completed';
  progress: {
    words_completed: number;
    total_words_added: number;
    completion_percentage: number;
  };
  last_accessed?: string;
}

export interface GuideStartResponse {
  message: string;
  guide_id: number;  // ✅ ИСПРАВЛЕНО: изменено с string на number
  guide_title: string;
  words_found: number;
  words_added: number;
  words_already_in_list: number;
  progress: {
    status: string;
    words_completed: number;
    total_words_added: number;
    completion_percentage: number;
  };
}

export interface GuideProgressResponse {
  guide_id: string;  // Остается string, так как возвращается как строка
  status: string;
  words_completed: number;
  total_words_added: number;
  completion_percentage: number;
  started_at?: string;
  completed_at?: string;
  last_accessed_at?: string;
}

export interface GuideWord {
  word: {
    id: number;
    kazakh_word: string;
    kazakh_cyrillic: string;
    category?: string;
    difficulty?: string;
    translations: Array<{
      language: string;
      translation: string;
    }>;
  };
  guide_info: {
    importance_score: number;
    order_in_guide: number;
  };
  user_progress: {
    status?: string;
    is_in_learning_list: boolean;
    correct_count: number;
    total_attempts: number;
  };
}

export interface GuideWordsResponse {
  guide_id: string;
  guide_title: string;
  words: GuideWord[];
  total_words: number;
}

class LearningGuidesAPI {
  async getGuides(difficulty?: string): Promise<LearningGuideAPI[]> {
    const params = new URLSearchParams();
    if (difficulty && difficulty !== 'all') {
      params.append('difficulty', difficulty);
    }

    const response = await api.get(`/learning/guides?${params}`);
    return response.data;
  }

  async startGuide(guideId: number): Promise<GuideStartResponse> {  // ✅ ИСПРАВЛЕНО
    const response = await api.post(`/learning/guides/${guideId}/start`);
    return response.data;
  }

  async getGuideProgress(guideId: number): Promise<GuideProgressResponse> {  // ✅ ИСПРАВЛЕНО
    const response = await api.get(`/learning/guides/${guideId}/progress`);
    return response.data;
  }

  async getGuideWords(guideId: number, limit: number = 50): Promise<GuideWordsResponse> {  // ✅ ИСПРАВЛЕНО
    const params = new URLSearchParams({ limit: limit.toString() });
    const response = await api.get(`/learning/guides/${guideId}/words?${params}`);
    return response.data;
  }

  async completeGuide(guideId: number): Promise<GuideProgressResponse> {  // ✅ ИСПРАВЛЕНО
    const response = await api.post(`/learning/guides/${guideId}/complete`);
    return response.data;
  }
}

export const learningGuidesAPI = new LearningGuidesAPI();