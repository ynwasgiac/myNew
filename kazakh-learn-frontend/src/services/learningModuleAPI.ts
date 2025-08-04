import api from './api';
import { LearningStatus } from '../types/learning';

export interface LearningWord {
  id: number;
  kazakh_word: string;
  kazakh_cyrillic?: string;
  translation: string;
  pronunciation?: string;
  // ✅ ИСПРАВЛЕНО: Добавлены все поля для изображений
  image_url?: string;        // Основное поле от API
  primary_image?: string;    // Дополнительное поле для совместимости
  status: LearningStatus;
  times_seen: number;
  times_correct: number;
  times_incorrect?: number;
  difficulty_level: number;
  category_name: string;
  word_type_name?: string;
  user_notes?: string;
  added_at?: string;
  last_practiced_at?: string;
  next_review_at?: string;
}

export interface WordBatch {
  batch_number: number;
  words: LearningWord[];
}

export interface BatchSession {
  session_id: number;
  session_type: string;
  words?: LearningWord[];
  questions?: QuizQuestion[];
  total_words?: number;
  total_questions?: number;
}

export interface QuizQuestion {
  id: number;
  question: string;
  kazakh_word: string;
  kazakh_cyrillic?: string;
  options: string[];
  correct_answer_index: number;
  correct_answer: string;
}

export interface BatchCompletion {
  success: boolean;
  batch_completed: boolean;
  summary: {
    total_words: number;
    practice_correct: number;
    quiz_correct: number;
    words_learned: Array<{
      word_id: number;
      kazakh_word: string;
      new_status: string;
    }>;
    words_to_review: Array<{
      word_id: number;
      kazakh_word: string;
      practice_correct: boolean;
      quiz_correct: boolean;
    }>;
  };
  message: string;
}

export interface DailyProgress {
  daily_goal: number;
  words_learned_today: number;
  sessions_completed_today: number;
  progress_percentage: number;
  goal_reached: boolean;
  words_remaining: number;
}

export interface LearningRecommendations {
  overall_accuracy: number;
  average_session_time: number;
  recommendations: Array<{
    type: string;
    message: string;
    action: string;
  }>;
}

export const learningModuleAPI = {
  // Get words that need to be learned (not learned status)
  async getWordsNotLearned(
    dailyGoal: number,
    categoryId?: number,
    difficultyLevelId?: number
  ): Promise<{
    total_words: number;
    total_batches: number;
    words_per_batch: number;
    batches: WordBatch[];
    daily_goal: number;
  }> {
    const params = new URLSearchParams({
      daily_goal: dailyGoal.toString(),
    });
    
    if (categoryId) params.append('category_id', categoryId.toString());
    if (difficultyLevelId) params.append('difficulty_level_id', difficultyLevelId.toString());
    
    const response = await api.get(`/learning-module/words/not-learned?${params}`);
    return response.data;
  },
  
  async setWordsToLearningStatus(
    wordIds: number[],
    batchNumber: number = 1
  ): Promise<{
    success: boolean;
    batch_number: number;
    words_updated: Array<{
      word_id: number;
      kazakh_word: string;
      previous_status: string;
      new_status: string;
    }>;
    message: string;
  }> {
    const response = await api.post('/learning-module/batch/words/set-learning-status', {
      word_ids: wordIds,
      batch_number: batchNumber
    });
    return response.data;
  },
  
  // Add random words to learning list
  async addRandomWords(
    count?: number,
    categoryId?: number,
    difficultyLevelId?: number
  ): Promise<{
    success: boolean;
    words_added: number;
    words: Array<{
      id: number;
      kazakh_word: string;
      kazakh_cyrillic?: string;
      translation: string;
      category_name: string;
      difficulty_level: number;
      status: string;
    }>;
    message: string;
  }> {
    const params = new URLSearchParams();
    if (count) params.append('count', count.toString());
    if (categoryId) params.append('category_id', categoryId.toString());
    if (difficultyLevelId) params.append('difficulty_level_id', difficultyLevelId.toString());

    const response = await api.post(`/learning-module/words/add-random?${params}`);
    return response.data;
  },

  // Start practice session for a batch of 3 words
  async startBatchPractice(wordIds: number[]): Promise<BatchSession> {
    if (wordIds.length !== 3) {
      throw new Error('Batch must contain exactly 3 words');
    }
    
    const response = await api.post('/learning-module/batch/practice/start', {
      word_ids: wordIds
    });
    return response.data;
  },

  // Start quiz session for a batch of 3 words
  async startBatchQuiz(wordIds: number[]): Promise<BatchSession> {
    if (wordIds.length !== 3) {
      throw new Error('Batch must contain exactly 3 words');
    }
    
    const response = await api.post('/learning-module/batch/quiz/start', {
      word_ids: wordIds
    });
    return response.data;
  },

  // Submit practice answer for a word
  async submitPracticeAnswer(
    sessionId: number,
    wordId: number,
    wasCorrect: boolean,
    userAnswer?: string,
    correctAnswer?: string,
    responseTimeMs?: number
  ): Promise<{ message: string; was_correct: boolean }> {
    const response = await api.post(`/learning/practice/${sessionId}/answer`, {
      word_id: wordId,
      was_correct: wasCorrect,
      user_answer: userAnswer,
      correct_answer: correctAnswer,
      response_time_ms: responseTimeMs
    });
    return response.data;
  },

  // Submit quiz answer
  async submitQuizAnswer(
    sessionId: number,
    questionId: number,
    selectedAnswer: string,
    isCorrect: boolean,
    responseTimeMs?: number
  ): Promise<any> {
    // For the learning module, we'll handle quiz answers locally
    // and submit them in batch at the end
    return {
      question_id: questionId,
      selected_answer: selectedAnswer,
      is_correct: isCorrect,
      response_time_ms: responseTimeMs
    };
  },

  // Complete a learning batch (practice + quiz results)
  async completeLearningBatch(
    wordIds: number[],
    practiceResults: Array<{ word_id: number; was_correct: boolean }>,
    quizResults: Array<{ word_id: number; was_correct: boolean }>
  ): Promise<BatchCompletion> {
    const response = await api.post('/learning-module/batch/complete', {
      word_ids: wordIds,
      practice_results: practiceResults,
      quiz_results: quizResults
    });
    return response.data;
  },

  // Get user's daily progress
  async getDailyProgress(): Promise<DailyProgress> {
    const response = await api.get('/learning-module/user/daily-progress');
    return response.data;
  },

  // Get learning recommendations
  async getLearningRecommendations(): Promise<LearningRecommendations> {
    const response = await api.get('/learning-module/user/recommendations');
    return response.data;
  },

  // Finish practice session
  async finishPracticeSession(
    sessionId: number,
    durationSeconds?: number
  ): Promise<any> {
    const response = await api.post(`/learning/practice/${sessionId}/finish`, {
      duration_seconds: durationSeconds
    });
    return response.data;
  },

  // Update word progress (mark as learned, etc.)
  async updateWordProgress(
    wordId: number,
    updates: {
      status?: LearningStatus;
      was_correct?: boolean;
      difficulty_rating?: string;
      user_notes?: string;
    }
  ): Promise<any> {
    const response = await api.put(`/learning/words/${wordId}/progress`, updates);
    return response.data;
  },

  // Get batch analytics
  async getBatchAnalytics(days: number = 7): Promise<any> {
    const response = await api.get(`/learning-module/analytics/batches?days=${days}`);
    return response.data;
  },

  // Get word learning efficiency stats
  async getWordLearningEfficiency(wordIds?: number[]): Promise<any> {
    const params = wordIds ? `?word_ids=${wordIds.join(',')}` : '';
    const response = await api.get(`/learning-module/analytics/efficiency${params}`);
    return response.data;
  }
};

// Helper functions for the learning module
export const learningModuleHelpers = {
  // Calculate batch progress percentage
  calculateBatchProgress(currentBatch: number, totalBatches: number): number {
    return Math.round((currentBatch / totalBatches) * 100);
  },

  // Calculate overall session accuracy
  calculateSessionAccuracy(
    practiceResults: Record<number, boolean>,
    quizResults: Record<string, boolean>,
    wordIds: number[]
  ): { practice: number; quiz: number; overall: number } {
    const practiceCorrect = wordIds.filter(id => practiceResults[id]).length;
    const quizCorrect = wordIds.filter(id => quizResults[`quiz_${id}`]).length;
    const practiceAccuracy = (practiceCorrect / wordIds.length) * 100;
    const quizAccuracy = (quizCorrect / wordIds.length) * 100;
    const overallAccuracy = ((practiceCorrect + quizCorrect) / (wordIds.length * 2)) * 100;

    return {
      practice: Math.round(practiceAccuracy),
      quiz: Math.round(quizAccuracy),
      overall: Math.round(overallAccuracy)
    };
  },

  // Determine if words should be marked as learned
  getWordsToMarkAsLearned(
    wordIds: number[],
    practiceResults: Record<number, boolean>,
    quizResults: Record<string, boolean>
  ): number[] {
    return wordIds.filter(id => 
      practiceResults[id] === true && quizResults[`quiz_${id}`] === true
    );
  },

  // Generate practice/quiz results for API submission
  generateResultsForSubmission(
    wordIds: number[],
    practiceResults: Record<number, boolean>,
    quizResults: Record<string, boolean>
  ): {
    practiceResults: Array<{ word_id: number; was_correct: boolean }>;
    quizResults: Array<{ word_id: number; was_correct: boolean }>;
  } {
    const practiceSubmission = wordIds.map(id => ({
      word_id: id,
      was_correct: practiceResults[id] || false
    }));

    const quizSubmission = wordIds.map(id => ({
      word_id: id,
      was_correct: quizResults[`quiz_${id}`] || false
    }));

    return {
      practiceResults: practiceSubmission,
      quizResults: quizSubmission
    };
  },

  // Format learning session duration
  formatSessionDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  },

  // Get motivational message based on performance
  getMotivationalMessage(accuracy: number, wordsLearned: number): string {
    if (wordsLearned === 3 && accuracy >= 90) {
      return "Perfect! You're a natural learner! 🌟";
    } else if (wordsLearned >= 2 && accuracy >= 80) {
      return "Excellent work! Keep up the great progress! 🎉";
    } else if (wordsLearned >= 1 && accuracy >= 60) {
      return "Good job! You're making solid progress! 👍";
    } else if (accuracy >= 40) {
      return "Nice effort! Practice makes perfect! 💪";
    } else {
      return "Keep trying! Every mistake is a learning opportunity! 🚀";
    }
  },

  // Estimate time to complete remaining batches
  estimateTimeToComplete(
    remainingBatches: number,
    averageTimePerBatch: number = 300 // 5 minutes default
  ): string {
    const totalSeconds = remainingBatches * averageTimePerBatch;
    return this.formatSessionDuration(totalSeconds);
  },

  // Check if user has reached daily goal
  checkDailyGoalProgress(
    wordsLearnedToday: number,
    dailyGoal: number
  ): {
    isComplete: boolean;
    percentage: number;
    remaining: number;
    message: string;
  } {
    const percentage = Math.min((wordsLearnedToday / dailyGoal) * 100, 100);
    const remaining = Math.max(0, dailyGoal - wordsLearnedToday);
    const isComplete = wordsLearnedToday >= dailyGoal;

    let message = '';
    if (isComplete) {
      message = "🎉 Daily goal completed! Fantastic work!";
    } else if (percentage >= 75) {
      message = `Almost there! Just ${remaining} more words to go!`;
    } else if (percentage >= 50) {
      message = `Great progress! ${remaining} words remaining.`;
    } else if (percentage >= 25) {
      message = `Good start! ${remaining} words left to reach your goal.`;
    } else {
      message = `Ready to learn? ${remaining} words to reach your daily goal!`;
    }

    return {
      isComplete,
      percentage: Math.round(percentage),
      remaining,
      message
    };
  }
};

export default learningModuleAPI;