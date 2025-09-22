// src/services/api.ts
import axios, { AxiosResponse, AxiosError } from 'axios';
import { toast } from 'sonner';
import type {
  User,
  WordSound,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  KazakhWord,
  KazakhWordSummary,
  Category,
  WordType,
  DifficultyLevel,
  Language,
  UserWordProgress,
  LearningSession,
  LearningStats,
  PracticeSession,
  QuizQuestion,
  WordFilters,
  LearningFilters,
  PaginatedWordsResponse,
} from '../types/api';

// Base configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
const TOKEN_KEY = 'kazakh_learn_token';

export const tokenService = {
  getToken: (): string | null => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string): void => localStorage.setItem(TOKEN_KEY, token),
  removeToken: (): void => localStorage.removeItem(TOKEN_KEY),
};

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = tokenService.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Check for token refresh header
    const newToken = response.headers['x-new-token'];
    if (newToken) {
      console.log('Token refreshed:', newToken.substring(0, 20) + '...');
      tokenService.setToken(newToken);
      toast.success('Session refreshed automatically');
    }
    return response;
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      tokenService.removeToken();
      window.location.href = '/login';
      toast.error('Session expired. Please log in again.');
    }
    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  },

  async register(userData: RegisterRequest): Promise<User> {
    const response = await api.post<User>('/auth/register', userData);
    return response.data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
    tokenService.removeToken();
  },

  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },

  async setMainLanguage(languageCode: string): Promise<void> {
    await api.post('/user/language', { language_code: languageCode });
  },

  async clearMainLanguage(): Promise<void> {
    await api.delete('/user/language');
  },
};

// Words API
// Words API - Add this new function to your existing wordsAPI object
export const wordsAPI = {

  // New paginated endpoint
  async getWordsPaginated(filters: WordFilters = {}): Promise<PaginatedWordsResponse> {
    const params = new URLSearchParams();
    
    // Set defaults
    const page = filters.page || 1;
    const pageSize = filters.page_size || 20;
    
    params.append('page', page.toString());
    params.append('page_size', pageSize.toString());
    
    // Add other filters
    if (filters.search) params.append('search', filters.search);
    if (filters.category_id) params.append('category_id', filters.category_id.toString());
    if (filters.word_type_id) params.append('word_type_id', filters.word_type_id.toString());
    if (filters.difficulty_level_id) params.append('difficulty_level_id', filters.difficulty_level_id.toString());
    if (filters.language_code) params.append('language_code', filters.language_code);
    
    const response = await api.get<PaginatedWordsResponse>(`/words/?${params}`);
    return response.data;
  },
  // ... keep all your existing functions ...

  // Новый метод для получения слов без example sentences (лучшая производительность)
  async getWordsWithoutExamples(filters: WordFilters = {}): Promise<PaginatedWordsResponse> {
    const params = new URLSearchParams();
    
    // Set defaults
    const page = filters.page || 1;
    const pageSize = filters.page_size || 20;
    
    params.append('page', page.toString());
    params.append('page_size', pageSize.toString());
    
    // Add other filters
    if (filters.search) params.append('search', filters.search);
    if (filters.category_id) params.append('category_id', filters.category_id.toString());
    if (filters.word_type_id) params.append('word_type_id', filters.word_type_id.toString());
    if (filters.difficulty_level_id) params.append('difficulty_level_id', filters.difficulty_level_id.toString());
    if (filters.language_code) params.append('language_code', filters.language_code);
    
    console.log('📡 Fetching words that are missing example sentences:', params.toString());
    
    const response = await api.get<PaginatedWordsResponse>(`/words/without-examples?${params}`);
    return response.data;
  },

  async getWords(filters: Omit<WordFilters, 'page' | 'page_size'> & { skip?: number; limit?: number } = {}): Promise<KazakhWordSummary[]> {
    console.warn('wordsAPI.getWords is deprecated. Use getWordsPaginated instead.');
    
    // Convert old skip/limit to page/page_size
    const limit = filters.limit || 20;
    const skip = filters.skip || 0;
    const page = Math.floor(skip / limit) + 1;
    
    const newFilters: WordFilters = {
      page,
      page_size: limit,
      search: filters.search,
      category_id: filters.category_id,
      word_type_id: filters.word_type_id,
      difficulty_level_id: filters.difficulty_level_id,
      language_code: filters.language_code,
    };
    
    const result = await this.getWordsPaginated(newFilters);
    return result.words;
  },


  async getWord(id: number, languageCode?: string): Promise<KazakhWord> {
    const params = languageCode ? `?language_code=${languageCode}` : '';
    const response = await api.get<KazakhWord>(`/words/${id}${params}`);
    return response.data;
  },

  // NEW: Add this function to fetch word sounds
  async getWordSounds(wordId: number): Promise<WordSound[]> {
    const response = await api.get<WordSound[]>(`/word-sounds/${wordId}`);
    return response.data;
  },

  async searchWords(query: string, languageCode?: string, limit?: number): Promise<KazakhWordSummary[]> {
    // Use the paginated endpoint for search as well
    const filters: WordFilters = {
      search: query,
      language_code: languageCode,
      page_size: limit || 50,
      page: 1
    };
    
    const result = await this.getWordsPaginated(filters);
    return result.words;
  },

  async getRandomWords(
    count: number = 10,
    difficultyLevelId?: number,
    categoryId?: number,
    languageCode?: string
  ): Promise<any[]> {
    const params = new URLSearchParams({ count: count.toString() });
    if (difficultyLevelId) params.append('difficulty_level_id', difficultyLevelId.toString());
    if (categoryId) params.append('category_id', categoryId.toString());
    if (languageCode) params.append('language_code', languageCode);
    
    const response = await api.get<any[]>(`/words/random/?${params}`);
    return response.data;
  },

  async getWordsByCategory(
    categoryId: number,
    languageCode?: string,
    skip?: number,
    limit?: number
  ): Promise<KazakhWordSummary[]> {
    const params = new URLSearchParams();
    if (languageCode) params.append('language_code', languageCode);
    if (skip) params.append('skip', skip.toString());
    if (limit) params.append('limit', limit.toString());
    
    const response = await api.get<KazakhWordSummary[]>(`/categories/${categoryId}/words?${params}`);
    return response.data;
  },
};


// Categories API
export const categoriesAPI = {
  async getCategories(languageCode?: string, activeOnly: boolean = true): Promise<Category[]> {
    const params = new URLSearchParams();
    if (languageCode) params.append('language_code', languageCode);
    if (activeOnly) params.append('active_only', 'true');
    
    const response = await api.get<Category[]>(`/categories/?${params}`);
    return response.data;
  },

  async getCategory(id: number, languageCode?: string): Promise<Category> {
    const params = languageCode ? `?language_code=${languageCode}` : '';
    const response = await api.get<Category>(`/categories/${id}${params}`);
    return response.data;
  },
};

// Word Types API
export const wordTypesAPI = {
  async getWordTypes(languageCode?: string, activeOnly: boolean = true): Promise<WordType[]> {
    const params = new URLSearchParams();
    if (languageCode) params.append('language_code', languageCode);
    if (activeOnly) params.append('active_only', 'true');
    
    const response = await api.get<WordType[]>(`/word-types/?${params}`);
    return response.data;
  },
};

// Difficulty Levels API
export const difficultyAPI = {
  async getDifficultyLevels(languageCode?: string, activeOnly: boolean = true): Promise<DifficultyLevel[]> {
    const params = new URLSearchParams();
    if (languageCode) params.append('language_code', languageCode);
    if (activeOnly) params.append('active_only', 'true');
    
    const response = await api.get<DifficultyLevel[]>(`/difficulty-levels/?${params}`);
    return response.data;
  },
};

// Languages API
export const languagesAPI = {
  async getLanguages(activeOnly: boolean = true): Promise<Language[]> {
    const params = activeOnly ? '?active_only=true' : '';
    const response = await api.get<Language[]>(`/languages/${params}`);
    return response.data;
  },

  async getLanguage(code: string): Promise<Language> {
    const response = await api.get<Language>(`/languages/${code}`);
    return response.data;
  },
};

// Learning Progress API
export const learningAPI = {
  
  // Single word - uses the endpoint with word_id in URL
  async addSingleWordToLearning(wordId: number, status?: string): Promise<void> {
    const params = new URLSearchParams();
    if (status) {
      params.append('status', status);
    }
    await api.post(`/learning/words/${wordId}/add?${params}`);
  },

  // Multiple words - uses the bulk endpoint
  async addMultipleWordsToLearning(wordIds: number[], status?: string): Promise<void> {
    await api.post('/learning/words/add-multiple', {
      word_ids: wordIds,
      status: status || 'want_to_learn',
    });
  },

  // Single word removal - uses DELETE with word_id in URL
  async removeSingleWordFromLearning(wordId: number): Promise<void> {
    await api.delete(`/learning/words/${wordId}`);
  },

  // Multiple words removal - uses DELETE with bulk endpoint
  async removeMultipleWordsFromLearning(wordIds: number[]): Promise<void> {
    await api.delete('/learning/words/remove-multiple', {
      data: {
        word_ids: wordIds,
      }
    });
  },

  async getWordsForReview(limit: number = 20): Promise<UserWordProgress[]> {
    // FIXED: Use the correct endpoint that matches your backend
    const response = await api.get<UserWordProgress[]>(`/learning/words/due-for-review?limit=${limit}`);
    return response.data;
  },

  async getSessions(limit: number = 50, offset: number = 0): Promise<LearningSession[]> {
    const response = await api.get<LearningSession[]>(`/learning/sessions?limit=${limit}&offset=${offset}`);
    return response.data;
  },
};

// Practice API
// FIXED Practice API section for src/services/api.ts
// Replace your existing practiceAPI section with this:

// CORRECTED Practice API section for src/services/api.ts

// Quiz API
// Replace your existing quizAPI in api.ts with this enhanced version:

// Updated quizAPI with correct types - replace in your api.ts

// Define the local quiz question interface that matches what we generate
interface LocalQuizQuestion {
  id: number;
  word: string;
  translation: string;
  options: string[];
  correctAnswer: number;
  type: 'multiple_choice' | 'translation';
}

export const quizAPI = {
  // Generate quiz questions from random words
  async generateQuizQuestions(
    count: number = 5,
    categoryId?: number,
    difficultyLevelId?: number,
    languageCode: string = 'en'
  ): Promise<LocalQuizQuestion[]> {
    // Get random words for quiz - fetch more to have options for wrong answers
    const params = new URLSearchParams({ 
      count: Math.max(count * 3, 15).toString(), // Get 3x words to create good distractors
      language_code: languageCode 
    });
    
    if (categoryId) params.append('category_id', categoryId.toString());
    if (difficultyLevelId) params.append('difficulty_level_id', difficultyLevelId.toString());
    
    const response = await api.get<any[]>(`/words/random/?${params}`);
    const words = response.data;
    
    if (words.length < count) {
      throw new Error(`Not enough words available. Found ${words.length}, need ${count}`);
    }

    // Generate quiz questions
    const questions: LocalQuizQuestion[] = [];
    const usedWords = new Set<number>();
    
    for (let i = 0; i < count && questions.length < count; i++) {
      const availableWords = words.filter(w => !usedWords.has(w.id));
      if (availableWords.length === 0) break;
      
      const correctWord = availableWords[Math.floor(Math.random() * availableWords.length)];
      usedWords.add(correctWord.id);
      
      // Create wrong answer options from other unused words
      const wrongAnswers = words
        .filter(w => 
          !usedWords.has(w.id) && 
          w.translation !== correctWord.translation &&
          w.translation.toLowerCase() !== correctWord.translation.toLowerCase()
        )
        .slice(0, 3)
        .map(w => w.translation);
      
      // Add some generic wrong answers if needed
      const genericAnswers = [
        'hello', 'water', 'book', 'house', 'tree', 'car', 'food', 'person',
        'time', 'day', 'night', 'good', 'bad', 'big', 'small', 'new', 'old'
      ];
      
      while (wrongAnswers.length < 3) {
        const randomAnswer = genericAnswers[Math.floor(Math.random() * genericAnswers.length)];
        if (!wrongAnswers.includes(randomAnswer) && 
            randomAnswer !== correctWord.translation.toLowerCase()) {
          wrongAnswers.push(randomAnswer);
        }
      }
      
      // Shuffle options and find correct answer index
      const allOptions = [correctWord.translation, ...wrongAnswers.slice(0, 3)];
      const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);
      const correctAnswerIndex = shuffledOptions.indexOf(correctWord.translation);
      
      questions.push({
        id: correctWord.id,
        word: correctWord.kazakh_word,
        translation: correctWord.translation,
        options: shuffledOptions,
        correctAnswer: correctAnswerIndex,
        type: 'multiple_choice'
      });
    }
    
    return questions;
  },

  // Get detailed word information for quiz
  async getWordForQuiz(wordId: number, languageCode: string = 'en'): Promise<any> {
    const params = languageCode ? `?language_code=${languageCode}` : '';
    const response = await api.get(`/words/${wordId}${params}`);
    return response.data;
  },

  // Start a new quiz session
  async startQuizSession(
    categoryId?: number,
    difficultyLevelId?: number,
    questionCount: number = 5,
    languageCode: string = 'en'
  ): Promise<{ session_id?: number; questions: LocalQuizQuestion[] }> {
    try {
      // Try to use backend quiz session if available
      const response = await api.post('/learning/quiz/start', {
        category_id: categoryId,
        difficulty_level_id: difficultyLevelId,
        question_count: questionCount,
        language_code: languageCode,
      });
      
      // Convert backend response to our local format
      const backendQuestions = response.data.questions || [];
      const convertedQuestions: LocalQuizQuestion[] = backendQuestions.map((q: any) => ({
        id: q.id,
        word: q.word || q.kazakh_word,
        translation: q.translation || q.correct_answer,
        options: q.options || [],
        correctAnswer: q.correctAnswer || q.correct_answer_index || 0,
        type: 'multiple_choice'
      }));
      
      return {
        session_id: response.data.session_id,
        questions: convertedQuestions
      };
    } catch (error) {
      // Fallback to generating questions from random words
      console.log('Backend quiz endpoint not available, generating from random words');
      const questions = await this.generateQuizQuestions(
        questionCount, 
        categoryId, 
        difficultyLevelId, 
        languageCode
      );
      return { questions };
    }
  },

  // Submit quiz results
  async submitQuizResults(
    sessionId: number | undefined,
    results: any[],
    languageCode: string = 'en'
  ): Promise<any> {
    if (!sessionId) {
      // No backend session, just return local results
      return {
        success: true,
        score: Math.round((results.filter(r => r.isCorrect).length / results.length) * 100),
        total_questions: results.length,
        correct_answers: results.filter(r => r.isCorrect).length,
        results: results
      };
    }

    try {
      const response = await api.post(`/learning/quiz/${sessionId}/submit`, {
        session_id: sessionId,
        answers: results.map(r => ({
          question_id: r.questionId,
          selected_answer: r.selectedAnswer,
          is_correct: r.isCorrect,
          time_spent: r.timeSpent
        })),
        language_code: languageCode
      });
      return response.data;
    } catch (error) {
      console.error('Failed to submit quiz results to backend:', error);
      // Return local results as fallback
      return {
        success: false,
        score: Math.round((results.filter(r => r.isCorrect).length / results.length) * 100),
        total_questions: results.length,
        correct_answers: results.filter(r => r.isCorrect).length,
        results: results,
        error: 'Failed to save to backend'
      };
    }
  },

  // Legacy function for backward compatibility with existing QuizQuestion type
  async startQuiz(
    categoryId?: number,
    difficultyLevelId?: number,
    questionCount: number = 10,
    languageCode: string = 'en'
  ): Promise<{ session_id: number; questions: any[] }> {
    const result = await this.startQuizSession(categoryId, difficultyLevelId, questionCount, languageCode);
    return {
      session_id: result.session_id || 0,
      questions: result.questions
    };
  },

  // Submit quiz (legacy compatibility)
  async submitQuiz(sessionId: number, answers: any[]): Promise<any> {
    const response = await api.post(`/learning/quiz/${sessionId}/submit`, {
      session_id: sessionId,
      answers,
    });
    return response.data;
  }
};

// Error handling helper
export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    if (error.response?.data?.detail) {
      return error.response.data.detail;
    }
    if (error.response?.status === 422 && error.response?.data?.detail) {
      // Handle validation errors
      if (Array.isArray(error.response.data.detail)) {
        return error.response.data.detail.map((err: any) => err.msg).join(', ');
      }
    }
    return error.message || 'Network error occurred';
  }
  return 'An unexpected error occurred';
};

export default api;