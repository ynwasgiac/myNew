// src/services/exampleSentencesAPI.ts
import api from './api';

export interface ExampleSentence {
  id: number;
  kazakh_sentence: string;
  difficulty_level: number;
  usage_context?: string;
  created_at: string;
  translations: Translation[];
  kazakh_word?: {
    id: number;
    kazakh_word: string;
    kazakh_cyrillic?: string;
  };
}

export interface Translation {
  id: number;
  translated_sentence: string;
  language_code: string;
  created_at: string;
}

export interface Language {
  id: number;
  language_code: string;
  language_name: string;
}

export interface CreateExampleSentenceData {
  kazakh_word_id: number;
  kazakh_sentence: string;
  difficulty_level: number;
  usage_context?: string;
}

export interface CreateTranslationData {
  example_sentence_id: number;
  language_code: string;
  translated_sentence: string;
}

export interface GenerateSentenceRequest {
  kazakh_word: string;
  kazakh_cyrillic?: string;
  difficulty_level: number;
  usage_context?: string;
  sentence_length?: 'short' | 'medium' | 'long';
}

export interface TranslateSentenceRequest {
  kazakh_sentence: string;
  target_language_code: string;
  target_language_name: string;
  context?: string;
}

export interface GeneratedSentenceResponse {
  kazakh_sentence: string;
  difficulty_level: number;
  usage_context: string;
  confidence: number;
  generated_at: string;
}

export interface TranslatedSentenceResponse {
  translated_sentence: string;
  confidence: number;
  language_code: string;
  language_name: string;
  translated_at: string;
}

export interface AIServiceStatus {
  service_available: boolean;
  test_successful: boolean;
  available_models: string[];
  features: {
    sentence_generation: boolean;
    sentence_translation: boolean;
    batch_translation: boolean;
  };
  status: 'operational' | 'limited' | 'unavailable' | 'error';
  error?: string;
  last_checked: string;
}

class ExampleSentencesAPI {
  // ===== EXAMPLE SENTENCES CRUD =====

  async getByWordId(wordId: number): Promise<ExampleSentence[]> {
    const response = await api.get(`/words/${wordId}/example-sentences`);
    return response.data;
  }

  async getById(sentenceId: number): Promise<ExampleSentence> {
    const response = await api.get(`/example-sentences/${sentenceId}`);
    return response.data;
  }

  async create(data: CreateExampleSentenceData): Promise<ExampleSentence> {
    const response = await api.post('/example-sentences/', data);
    return response.data;
  }

  async update(sentenceId: number, data: Partial<CreateExampleSentenceData>): Promise<ExampleSentence> {
    const response = await api.put(`/example-sentences/${sentenceId}`, data);
    return response.data;
  }

  async delete(sentenceId: number): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/example-sentences/${sentenceId}`);
    return response.data;
  }

  // ===== TRANSLATIONS CRUD =====

  async createTranslation(data: CreateTranslationData): Promise<Translation> {
    const response = await api.post('/example-sentence-translations/', data);
    return response.data;
  }

  async updateTranslation(translationId: number, translatedSentence: string): Promise<Translation> {
    const response = await api.put(`/example-sentence-translations/${translationId}`, {
      translated_sentence: translatedSentence
    });
    return response.data;
  }

  async deleteTranslation(translationId: number): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/example-sentence-translations/${translationId}`);
    return response.data;
  }

  async getSentenceTranslations(sentenceId: number): Promise<Translation[]> {
    const response = await api.get(`/example-sentences/${sentenceId}/translations`);
    return response.data;
  }

  // ===== AI GENERATION AND TRANSLATION =====

  async generateSentence(request: GenerateSentenceRequest): Promise<GeneratedSentenceResponse> {
    const response = await api.post('/ai/generate-example-sentence', request);
    return response.data;
  }

  async translateSentence(request: TranslateSentenceRequest): Promise<TranslatedSentenceResponse> {
    const response = await api.post('/ai/translate-sentence', request);
    return response.data;
  }

  async batchTranslateSentence(
    kazakhSentence: string,
    targetLanguages: string[],
    context?: string
  ): Promise<Record<string, TranslatedSentenceResponse>> {
    const response = await api.post('/ai/batch-translate-sentence', {
      kazakh_sentence: kazakhSentence,
      target_languages: targetLanguages,
      context
    });
    return response.data;
  }

  async getAIServiceStatus(): Promise<AIServiceStatus> {
    const response = await api.get('/ai/status');
    return response.data;
  }

  // ===== BULK OPERATIONS =====

  async createBulk(wordId: number, sentences: Array<{
    kazakh_sentence: string;
    difficulty_level: number;
    usage_context?: string;
    translations?: Record<string, string>;
  }>): Promise<ExampleSentence[]> {
    const response = await api.post('/example-sentences/bulk', {
      kazakh_word_id: wordId,
      sentences
    });
    return response.data;
  }

  // ===== SEARCH AND FILTERING =====

  async search(params: {
    query?: string;
    word_id?: number;
    difficulty_level?: number;
    usage_context?: string;
    language_code?: string;
    page?: number;
    page_size?: number;
  }): Promise<{
    sentences: ExampleSentence[];
    total_count: number;
    page: number;
    page_size: number;
    has_more: boolean;
  }> {
    const response = await api.post('/example-sentences/search', params);
    return response.data;
  }

  async getStatistics(): Promise<{
    total_sentences: number;
    sentences_by_difficulty: Record<number, number>;
    sentences_by_word_type: Record<string, number>;
    sentences_with_translations: number;
    average_difficulty: number;
    most_common_contexts: Array<{ context: string; count: number }>;
  }> {
    const response = await api.get('/example-sentences/statistics');
    return response.data;
  }

  async getByDifficulty(
    difficultyLevel: number,
    languageCode?: string,
    skip = 0,
    limit = 20
  ): Promise<ExampleSentence[]> {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
      ...(languageCode && { language_code: languageCode })
    });
    
    const response = await api.get(`/example-sentences/by-difficulty/${difficultyLevel}?${params}`);
    return response.data;
  }

  async getRandom(
    count = 5,
    difficultyLevel?: number,
    languageCode?: string
  ): Promise<ExampleSentence[]> {
    const params = new URLSearchParams({
      count: count.toString(),
      ...(difficultyLevel && { difficulty_level: difficultyLevel.toString() }),
      ...(languageCode && { language_code: languageCode })
    });
    
    const response = await api.get(`/example-sentences/random?${params}`);
    return response.data;
  }

  // ===== UTILITY METHODS =====

  async getLanguages(): Promise<Language[]> {
    const response = await api.get('/languages');
    return response.data;
  }

  /**
   * Check if AI services are available
   */
  async checkAIAvailability(): Promise<boolean> {
    try {
      const status = await this.getAIServiceStatus();
      return status.service_available && status.test_successful;
    } catch (error) {
      console.error('Error checking AI availability:', error);
      return false;
    }
  }

  /**
   * Generate example sentence with automatic fallback
   */
  async generateSentenceWithFallback(
    request: GenerateSentenceRequest
  ): Promise<GeneratedSentenceResponse | null> {
    try {
      return await this.generateSentence(request);
    } catch (error: any) {
      console.error('AI sentence generation failed:', error);
      
      // Return a fallback response
      const fallbackSentences = [
        `${request.kazakh_word} маңызды сөз.`,
        `Мен ${request.kazakh_word} туралы білемін.`,
        `${request.kazakh_word} пайдалы.`
      ];
      
      return {
        kazakh_sentence: fallbackSentences[Math.floor(Math.random() * fallbackSentences.length)],
        difficulty_level: request.difficulty_level,
        usage_context: request.usage_context || 'general',
        confidence: 0.5,
        generated_at: new Date().toISOString()
      };
    }
  }

  /**
   * Translate sentence with automatic fallback
   */
  async translateSentenceWithFallback(
    request: TranslateSentenceRequest
  ): Promise<TranslatedSentenceResponse | null> {
    try {
      return await this.translateSentence(request);
    } catch (error: any) {
      console.error('AI sentence translation failed:', error);
      
      // Return a fallback indicating manual translation needed
      return {
        translated_sentence: '[Manual translation needed]',
        confidence: 0.0,
        language_code: request.target_language_code,
        language_name: request.target_language_name,
        translated_at: new Date().toISOString()
      };
    }
  }
}

// Create and export singleton instance
export const exampleSentencesAPI = new ExampleSentencesAPI();
export default exampleSentencesAPI;