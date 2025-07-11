// src/services/adminWordsAPI.ts
import api from './api';

// Add new interfaces for filter options
export interface FilterOption {
  id: number;
  name: string;
}

export interface DifficultyFilterOption {
  id: number;
  level_number: number;
  name: string;
}

export interface WordFilterOptions {
  categories: FilterOption[];
  word_types: FilterOption[];
  difficulty_levels: DifficultyFilterOption[];
}

export interface WordsCountResponse {
  total_count: number;
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

export interface AdminWordCreateData {
  kazakh_word: string;
  kazakh_cyrillic?: string;
  word_type_id: number;
  category_id: number;
  difficulty_level_id: number;
}

export interface AdminWordCreateResponse {
  id: number;
  kazakh_word: string;
  kazakh_cyrillic?: string;
  word_type: {
    id: number;
    type_name: string;
  };
  category: {
    id: number;
    category_name: string;
  };
  difficulty_level: {
    id: number;
    level_number: number;
    level_name: string;
  };
  created_at: string;
}

export interface AdminWordCreateData {
  kazakh_word: string;
  kazakh_cyrillic?: string;
  word_type_id: number;
  category_id: number;
  difficulty_level_id: number;
}

export interface AdminWordUpdateData {
  kazakh_word?: string;
  kazakh_cyrillic?: string;
  word_type_id?: number;
  category_id?: number;
  difficulty_level_id?: number;
}

export interface AdminWordDetailResponse {
  id: number;
  kazakh_word: string;
  kazakh_cyrillic?: string;
  word_type: {
    id: number;
    type_name: string;
  };
  category: {
    id: number;
    category_name: string;
  };
  difficulty_level: {
    id: number;
    level_number: number;
    level_name: string;
  };
  primary_translation?: string;
  translation_count: number;
  created_at: string;
}

export interface WordStatistics {
  total_words: number;
  words_by_category: Array<{
    category_id: number;
    category_name: string;
    word_count: number;
  }>;
  words_by_difficulty: Array<{
    difficulty_level: number;
    level_name: string;
    word_count: number;
  }>;
  words_by_type: Array<{
    word_type: string;
    word_count: number;
  }>;
  words_without_translations: number;
  words_without_images: number;
  recent_words: Array<{
    id: number;
    kazakh_word: string;
    category_name: string;
    created_at: string;
    translation_count: number;
  }>;
}

export interface WordsNeedingAttention {
  missing_translations: Array<{
    id: number;
    kazakh_word: string;
    category_name: string;
    created_at: string;
  }>;
  missing_images: Array<{
    id: number;
    kazakh_word: string;
    category_name: string;
    created_at: string;
  }>;
  missing_pronunciations: Array<{
    id: number;
    kazakh_word: string;
    category_name: string;
    created_at: string;
  }>;
}

// Translation interfaces
export interface TranslationCreateData {
  kazakh_word_id: number;
  language_id: number;
  translation: string;
  alternative_translations?: string[];
}

export interface TranslationUpdateData {
  translation: string;
  alternative_translations?: string[];
}

export interface TranslationResponse {
  id: number;
  kazakh_word_id: number;
  language_id: number;
  language_code: string;
  language_name: string;
  translation: string;
  alternative_translations: string[];
  created_at: string;
}

export interface BulkTranslationCreateData {
  kazakh_word_id: number;
  translations: Array<{
    language_id: number;
    translation: string;
    alternative_translations?: string[];
  }>;
}

export interface BulkTranslationResponse {
  success: boolean;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  translations: TranslationResponse[];
  errors: Array<{
    index: number;
    error: string;
  }>;
}

export interface TranslationStatistics {
  total_translations: number;
  total_words: number;
  words_without_translations: number;
  words_with_multiple_translations: number;
  translations_by_language: Array<{
    language_code: string;
    language_name: string;
    translation_count: number;
  }>;
  coverage_by_language: Array<{
    language_code: string;
    language_name: string;
    translation_count: number;
    coverage_percentage: number;
  }>;
  average_translations_per_word: number;
}

// Media management interfaces
export interface WordImageUploadResponse {
  success: boolean;
  message: string;
  image: {
    id: number;
    image_url: string;
    is_primary: boolean;
    alt_text?: string;
  };
}

export interface WordSoundUploadResponse {
  success: boolean;
  message: string;
  sound: {
    id: number;
    sound_url: string;
    sound_type?: string;
    alt_text?: string;
  };
}

export interface MediaUploadOptions {
  alt_text?: string;
  is_primary?: boolean;
  source?: string;
  license?: string;
}

export interface AudioUploadOptions {
  sound_type?: string;
  alt_text?: string;
}

export const adminWordsAPI = {
  // ===== TRANSLATION MANAGEMENT =====
  
  async createTranslation(translationData: TranslationCreateData): Promise<TranslationResponse> {
    try {
      const response = await api.post('/admin/translations/', translationData);
      return response.data;
    } catch (error: any) {
      console.error('Failed to create translation:', error);
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error('Failed to create translation');
    }
  },

  async updateTranslation(translationId: number, updateData: TranslationUpdateData): Promise<TranslationResponse> {
    try {
      const response = await api.put(`/admin/translations/${translationId}`, updateData);
      return response.data;
    } catch (error: any) {
      console.error('Failed to update translation:', error);
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error('Failed to update translation');
    }
  },

  async deleteTranslation(translationId: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/admin/translations/${translationId}`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to delete translation:', error);
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error('Failed to delete translation');
    }
  },

  async getWordTranslations(wordId: number): Promise<TranslationResponse[]> {
    try {
      const response = await api.get(`/admin/translations/word/${wordId}`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to get word translations:', error);
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error('Failed to load word translations');
    }
  },

  async getTranslation(translationId: number): Promise<TranslationResponse> {
    try {
      const response = await api.get(`/admin/translations/${translationId}`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to get translation:', error);
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error('Failed to load translation');
    }
  },

  async bulkCreateTranslations(bulkData: BulkTranslationCreateData): Promise<BulkTranslationResponse> {
    try {
      const response = await api.post('/admin/translations/bulk', bulkData);
      return response.data;
    } catch (error: any) {
      console.error('Failed to bulk create translations:', error);
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error('Failed to create translations');
    }
  },

  async getTranslationStatistics(): Promise<TranslationStatistics> {
    try {
      const response = await api.get('/admin/translations/statistics');
      return response.data;
    } catch (error: any) {
      console.error('Failed to get translation statistics:', error);
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error('Failed to load translation statistics');
    }
  },

  // ===== ENHANCED WORD OPERATIONS WITH TRANSLATIONS =====

  async getAdminWordDetailWithTranslations(
    wordId: number, 
    languageCode: string = 'en'
  ): Promise<AdminWordDetailResponse & { all_translations: TranslationResponse[] }> {
    try {
      const [wordDetail, translations] = await Promise.all([
        this.getAdminWordDetail(wordId, languageCode),
        this.getWordTranslations(wordId)
      ]);

      return {
        ...wordDetail,
        all_translations: translations
      };
    } catch (error: any) {
      console.error('Failed to get word detail with translations:', error);
      throw error;
    }
  },

  async createWord(wordData: AdminWordCreateData): Promise<AdminWordCreateResponse> {
    try {
      console.log('Creating word with data:', wordData);
      const response = await api.post('/admin/words', wordData);
      console.log('Word creation response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to create word:', error);
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error('Failed to create word');
    }
  },

  async updateWordWithTranslations(
    wordId: number,
    wordData: AdminWordUpdateData,
    translations: Array<{
      id?: number;
      language_id: number;
      translation: string;
      alternative_translations?: string[];
      isNew?: boolean;
      isModified?: boolean;
    }>
  ): Promise<{
    word: AdminWordDetailResponse;
    translations: TranslationResponse[];
    errors: string[];
  }> {
    try {
      const errors: string[] = [];
      let updatedTranslations: TranslationResponse[] = [];

      // Update word basic data
      const updatedWord = await this.updateWord(wordId, wordData);

      // Process translations
      for (const translation of translations) {
        try {
          if (translation.isNew) {
            // Create new translation
            const newTranslation = await this.createTranslation({
              kazakh_word_id: wordId,
              language_id: translation.language_id,
              translation: translation.translation,
              alternative_translations: translation.alternative_translations || []
            });
            updatedTranslations.push(newTranslation);
          } else if (translation.isModified && translation.id) {
            // Update existing translation
            const updatedTranslation = await this.updateTranslation(translation.id, {
              translation: translation.translation,
              alternative_translations: translation.alternative_translations || []
            });
            updatedTranslations.push(updatedTranslation);
          }
        } catch (translationError) {
          errors.push(`Translation error: ${translationError instanceof Error ? translationError.message : 'Unknown error'}`);
        }
      }

      // Get all current translations for the word
      const allTranslations = await this.getWordTranslations(wordId);

      return {
        word: updatedWord,
        translations: allTranslations,
        errors
      };
    } catch (error: any) {
      console.error('Failed to update word with translations:', error);
      throw error;
    }
  },  

  // ===== HELPER METHODS =====

  async validateTranslationUniqueness(
    wordId: number,
    languageId: number,
    excludeTranslationId?: number
  ): Promise<{
    is_unique: boolean;
    existing_translation?: TranslationResponse;
  }> {
    try {
      const translations = await this.getWordTranslations(wordId);
      const existing = translations.find(t => 
        t.language_id === languageId && 
        (!excludeTranslationId || t.id !== excludeTranslationId)
      );

      return {
        is_unique: !existing,
        existing_translation: existing
      };
    } catch (error) {
      console.error('Failed to validate translation uniqueness:', error);
      return { is_unique: true }; // Assume unique if validation fails
    }
  },

  async getTranslationCompleteness(wordId: number): Promise<{
    total_languages: number;
    translated_languages: number;
    completion_percentage: number;
    missing_languages: Array<{
      language_code: string;
      language_name: string;
    }>;
  }> {
    try {
      const [allLanguages, wordTranslations] = await Promise.all([
        api.get('/languages/?active_only=true'),
        this.getWordTranslations(wordId)
      ]);

      const languages = allLanguages.data || [];
      const translatedLanguageIds = new Set(wordTranslations.map(t => t.language_id));
      
      const missingLanguages = languages
        .filter((lang: any) => !translatedLanguageIds.has(lang.id))
        .map((lang: any) => ({
          language_code: lang.language_code,
          language_name: lang.language_name
        }));

      const completionPercentage = languages.length > 0 
        ? Math.round((wordTranslations.length / languages.length) * 100)
        : 0;

      return {
        total_languages: languages.length,
        translated_languages: wordTranslations.length,
        completion_percentage: completionPercentage,
        missing_languages: missingLanguages
      };
    } catch (error) {
      console.error('Failed to get translation completeness:', error);
      return {
        total_languages: 0,
        translated_languages: 0,
        completion_percentage: 0,
        missing_languages: []
      };
    }
  },

  // Add debug method
  async debugWordInfo(wordId: number): Promise<any> {
    try {
      const response = await api.get(`/admin/words/${wordId}/debug`);
      return response.data;
    } catch (error) {
      console.error('Debug request failed:', error);
      throw error;
    }
  },

  // Add setup directories method
  async setupDirectories(): Promise<any> {
    try {
      const response = await api.post('/admin/setup-directories');
      return response.data;
    } catch (error) {
      console.error('Setup directories failed:', error);
      throw error;
    }
  },
  // Word CRUD operations
  async getAdminWords(
    skip: number = 0,
    limit: number = 100,
    categoryId?: number,
    wordTypeId?: number,
    difficultyLevelId?: number,
    search?: string,
    languageCode: string = 'en',
    sortBy: string = 'kazakh_word',
    sortDirection: 'asc' | 'desc' = 'asc'
  ): Promise<KazakhWordSummary[]> {
    try {
      const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
        language_code: languageCode,
        sort_by: sortBy,
        sort_direction: sortDirection,
      });

      if (categoryId) params.append('category_id', categoryId.toString());
      if (wordTypeId) params.append('word_type_id', wordTypeId.toString());
      if (difficultyLevelId) params.append('difficulty_level_id', difficultyLevelId.toString());
      if (search && search.trim()) params.append('search', search.trim());

      console.log('Fetching words with params:', params.toString());

      const response = await api.get(`/admin/words?${params}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch admin words:', error);
      throw new Error('Failed to load words count');
    }
  },

  // New method to get filter options
  async getWordFilterOptions(): Promise<WordFilterOptions> {
    try {
      const response = await api.get('/admin/words/filter-options');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
      throw new Error('Failed to load filter options');
    }
  },

  // New method to get total count
  async getWordsCount(
    categoryId?: number,
    wordTypeId?: number,
    difficultyLevelId?: number,
    search?: string,
    languageCode: string = 'en'
  ): Promise<number> {
    try {
      const params = new URLSearchParams({
        language_code: languageCode,
      });
  
      if (categoryId) params.append('category_id', categoryId.toString());
      if (wordTypeId) params.append('word_type_id', wordTypeId.toString());
      if (difficultyLevelId) params.append('difficulty_level_id', difficultyLevelId.toString());
      if (search && search.trim()) params.append('search', search.trim());
  
      const response = await api.get(`/admin/words/count?${params}`);
      return response.data.total_count;
    } catch (error) {
      console.error('Failed to fetch words count:', error);
      // Add this return statement or throw an error
      return 0; // or throw new Error('Failed to load words count');
    }
  },

  async getAdminWordDetail(wordId: number, languageCode: string = 'en'): Promise<AdminWordDetailResponse> {
    try {
      const response = await api.get(`/admin/words/${wordId}?language_code=${languageCode}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch word detail:', error);
      throw new Error('Failed to load word details');
    }
  },
  
  async updateWord(wordId: number, updateData: AdminWordUpdateData): Promise<AdminWordDetailResponse> {
    try {
      const response = await api.put(`/admin/words/${wordId}`, updateData);
      return response.data;
    } catch (error) {
      console.error('Failed to update word:', error);
      throw new Error('Failed to update word');
    }
  },

  async deleteWord(wordId: number, forceDelete: boolean = false): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/admin/words/${wordId}?force_delete=${forceDelete}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error('Failed to delete word');
    }
  },

  // Bulk operations
  async bulkDeleteWords(wordIds: number[]): Promise<{ success: boolean; deleted_count: number; message: string }> {
    try {
      const response = await api.delete('/admin/words/bulk', {
        data: { word_ids: wordIds }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to bulk delete words:', error);
      throw new Error('Failed to delete selected words');
    }
  },

  async bulkUpdateCategory(wordIds: number[], categoryId: number): Promise<{ success: boolean; updated_count: number; message: string }> {
    try {
      const response = await api.patch('/admin/words/bulk', {
        word_ids: wordIds,
        category_id: categoryId
      });
      return response.data;
    } catch (error) {
      console.error('Failed to bulk update category:', error);
      throw new Error('Failed to update category for selected words');
    }
  },

  async bulkUpdateWordType(wordIds: number[], wordTypeId: number): Promise<{ success: boolean; updated_count: number; message: string }> {
    try {
      const response = await api.patch('/admin/words/bulk', {
        word_ids: wordIds,
        word_type_id: wordTypeId
      });
      return response.data;
    } catch (error) {
      console.error('Failed to bulk update word type:', error);
      throw new Error('Failed to update word type for selected words');
    }
  },

  async bulkUpdateDifficulty(wordIds: number[], difficultyLevelId: number): Promise<{ success: boolean; updated_count: number; message: string }> {
    try {
      const response = await api.patch('/admin/words/bulk', {
        word_ids: wordIds,
        difficulty_level_id: difficultyLevelId
      });
      return response.data;
    } catch (error) {
      console.error('Failed to bulk update difficulty:', error);
      throw new Error('Failed to update difficulty for selected words');
    }
  },

  // Statistics and analytics
  async getWordStatistics(): Promise<WordStatistics> {
    try {
      const response = await api.get('/admin/words/statistics');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch word statistics:', error);
      throw new Error('Failed to load word statistics');
    }
  },

  async getWordsNeedingAttention(): Promise<WordsNeedingAttention> {
    try {
      const response = await api.get('/admin/words/needs-attention');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch words needing attention:', error);
      throw new Error('Failed to load words needing attention');
    }
  },

  // Media management - Image operations
  async uploadWordImage(
    wordId: number,
    file: File,
    options: MediaUploadOptions = {}
  ): Promise<WordImageUploadResponse> {
    try {
      console.log('Starting upload for word:', wordId);
      console.log('File details:', {
        name: file.name,
        size: file.size,
        type: file.type
      });

      const formData = new FormData();
      formData.append('file', file);
      
      if (options.alt_text) formData.append('alt_text', options.alt_text);
      if (options.is_primary !== undefined) formData.append('is_primary', String(options.is_primary));
      if (options.source) formData.append('source', options.source);
      if (options.license) formData.append('license', options.license);

      console.log('FormData prepared, sending request...');

      const response = await api.post(`/admin/words/${wordId}/images/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30 second timeout
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || progressEvent.loaded));
          console.log('Upload progress:', percentCompleted + '%');
        }
      });
      
      console.log('Upload successful:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Upload error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: error.config
      });
      
      if (error.response?.data?.detail) {
        throw new Error(`Upload failed: ${error.response.data.detail}`);
      } else if (error.response?.status === 500) {
        throw new Error('Server error during upload. Please check the server logs.');
      } else if (error.response?.status === 413) {
        throw new Error('File too large. Please choose a smaller file.');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Upload timed out. Please try again with a smaller file.');
      } else {
        throw new Error(`Upload failed: ${error.message}`);
      }
    }
  },

  async deleteWordImage(wordId: number, imageId: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/admin/words/${wordId}/images/${imageId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete image:', error);
      throw new Error('Failed to delete image');
    }
  },

  async setPrimaryImage(wordId: number, imageId: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.put(`/word-images/${imageId}/primary?word_id=${wordId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to set primary image:', error);
      throw new Error('Failed to set primary image');
    }
  },

  async getWordImages(wordId: number): Promise<Array<{
    id: number;
    image_url: string;
    image_type: string;
    alt_text?: string;
    is_primary: boolean;
    source?: string;
    license?: string;
    created_at: string;
  }>> {
    try {
      const response = await api.get(`/word-images/${wordId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch word images:', error);
      throw new Error('Failed to load images');
    }
  },

  // Media management - Audio operations
  async uploadWordSound(
    wordId: number,
    file: File,
    options: AudioUploadOptions = {}
  ): Promise<WordSoundUploadResponse> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      if (options.sound_type) formData.append('sound_type', options.sound_type);
      if (options.alt_text) formData.append('alt_text', options.alt_text);

      const response = await api.post(`/admin/words/${wordId}/sounds/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      return response.data;
    } catch (error: any) {
      console.error('Failed to upload sound:', error);
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error('Failed to upload audio file');
    }
  },

  async deleteWordSound(wordId: number, soundId: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/admin/words/${wordId}/sounds/${soundId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete sound:', error);
      throw new Error('Failed to delete audio file');
    }
  },

  async getWordSounds(wordId: number): Promise<Array<{
    id: number;
    sound_url: string;
    sound_type?: string;
    alt_text?: string;
    created_at: string;
  }>> {
    try {
      const response = await api.get(`/word-sounds/${wordId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch word sounds:', error);
      throw new Error('Failed to load audio files');
    }
  },

  // Import/Export functionality
  async exportWords(format: 'csv' | 'json' = 'csv', filters?: {
    categoryId?: number;
    wordTypeId?: number;
    difficultyLevelId?: number;
  }): Promise<Blob> {
    try {
      const params = new URLSearchParams({ format });
      
      if (filters?.categoryId) params.append('category_id', filters.categoryId.toString());
      if (filters?.wordTypeId) params.append('word_type_id', filters.wordTypeId.toString());
      if (filters?.difficultyLevelId) params.append('difficulty_level_id', filters.difficultyLevelId.toString());

      const response = await api.get(`/admin/words/export?${params}`, {
        responseType: 'blob'
      });
      
      return response.data;
    } catch (error) {
      console.error('Failed to export words:', error);
      throw new Error('Failed to export words');
    }
  },

  async importWords(file: File, options: {
    updateExisting?: boolean;
    skipDuplicates?: boolean;
  } = {}): Promise<{
    success: boolean;
    imported_count: number;
    updated_count: number;
    skipped_count: number;
    errors: Array<{ row: number; error: string }>;
    message: string;
  }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      if (options.updateExisting) formData.append('update_existing', 'true');
      if (options.skipDuplicates) formData.append('skip_duplicates', 'true');

      const response = await api.post('/admin/words/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      return response.data;
    } catch (error: any) {
      console.error('Failed to import words:', error);
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error('Failed to import words');
    }
  },

  // Search and filtering helpers
  async searchWords(
    query: string,
    filters?: {
      categoryId?: number;
      wordTypeId?: number;
      difficultyLevelId?: number;
    },
    limit: number = 50
  ): Promise<KazakhWordSummary[]> {
    try {
      const params = new URLSearchParams({
        search: query,
        limit: limit.toString()
      });

      if (filters?.categoryId) params.append('category_id', filters.categoryId.toString());
      if (filters?.wordTypeId) params.append('word_type_id', filters.wordTypeId.toString());
      if (filters?.difficultyLevelId) params.append('difficulty_level_id', filters.difficultyLevelId.toString());

      const response = await api.get(`/admin/words?${params}`);
      return response.data;
    } catch (error) {
      console.error('Failed to search words:', error);
      throw new Error('Failed to search words');
    }
  },

  // Validation helpers
  async validateWordUniqueness(kazakhWord: string, excludeId?: number): Promise<{
    is_unique: boolean;
    existing_word?: {
      id: number;
      kazakh_word: string;
      category_name: string;
    };
  }> {
    try {
      const params = new URLSearchParams({ kazakh_word: kazakhWord });
      if (excludeId) params.append('exclude_id', excludeId.toString());

      const response = await api.get(`/admin/words/validate-uniqueness?${params}`);
      return response.data;
    } catch (error) {
      console.error('Failed to validate word uniqueness:', error);
      throw new Error('Failed to validate word uniqueness');
    }
  },

  // Content quality checks
  async getContentQualityReport(): Promise<{
    total_words: number;
    quality_score: number;
    issues: {
      words_without_translations: number;
      words_without_images: number;
      words_without_audio: number;
      words_with_short_translations: number;
      words_with_missing_metadata: number;
    };
    recommendations: Array<{
      priority: 'high' | 'medium' | 'low';
      issue: string;
      count: number;
      suggestion: string;
    }>;
  }> {
    try {
      const response = await api.get('/admin/words/quality-report');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch content quality report:', error);
      throw new Error('Failed to load content quality report');
    }
  },

  // Media management helpers
  async getMediaStatistics(): Promise<{
    total_images: number;
    total_audio_files: number;
    storage_used_mb: number;
    average_file_sizes: {
      images_kb: number;
      audio_kb: number;
    };
    media_by_category: Array<{
      category_id: number;
      category_name: string;
      image_count: number;
      audio_count: number;
    }>;
  }> {
    try {
      const response = await api.get('/admin/media/statistics');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch media statistics:', error);
      throw new Error('Failed to load media statistics');
    }
  },

  // Cleanup operations
  async cleanupOrphanedMedia(): Promise<{
    success: boolean;
    cleaned_files: number;
    freed_space_mb: number;
    message: string;
  }> {
    try {
      const response = await api.post('/admin/media/cleanup-orphaned');
      return response.data;
    } catch (error) {
      console.error('Failed to cleanup orphaned media:', error);
      throw new Error('Failed to cleanup orphaned media files');
    }
  },

  async optimizeMediaFiles(): Promise<{
    success: boolean;
    optimized_count: number;
    space_saved_mb: number;
    message: string;
  }> {
    try {
      const response = await api.post('/admin/media/optimize');
      return response.data;
    } catch (error) {
      console.error('Failed to optimize media files:', error);
      throw new Error('Failed to optimize media files');
    }
  }

  
};

