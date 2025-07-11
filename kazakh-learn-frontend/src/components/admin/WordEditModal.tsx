import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import Modal from '../../components/ui/Modal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Badge from '../../components/ui/Badge';
import { adminWordsAPI } from '../../services/adminWordsAPI';
import api from '../../services/api';
import type { AdminWordUpdateData } from '../../services/adminWordsAPI';
import { toast } from 'sonner';

interface WordEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  wordId: number | null;
  onSave: () => void;
}

interface WordFormData {
  kazakh_word: string;
  kazakh_cyrillic: string;
  word_type_id: number;
  category_id: number;
  difficulty_level_id: number;
}

interface Translation {
  id?: number;
  language_id: number;
  language_code: string;
  language_name: string;
  translation: string;
  alternative_translations?: string[];
  isNew?: boolean;
  isModified?: boolean;
  isDeleted?: boolean;
}

interface Category {
  id: number;
  category_name: string;
}

interface WordType {
  id: number;
  type_name: string;
}

interface DifficultyLevel {
  id: number;
  level_number: number;
  level_name: string;
}

interface Language {
  id: number;
  language_code: string;
  language_name: string;
  is_active: boolean;
}

const WordEditModal: React.FC<WordEditModalProps> = ({
  isOpen,
  onClose,
  wordId,
  onSave
}) => {
  const { t } = useTranslation();
  
  // Form state
  const [formData, setFormData] = useState<WordFormData>({
    kazakh_word: '',
    kazakh_cyrillic: '',
    word_type_id: 1,
    category_id: 1,
    difficulty_level_id: 1,
  });
  
  // Translation state
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [deletedTranslationIds, setDeletedTranslationIds] = useState<number[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<Language[]>([]);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'basic' | 'translations'>('basic');
  
  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Reference data
  const [categories, setCategories] = useState<Category[]>([]);
  const [wordTypes, setWordTypes] = useState<WordType[]>([]);
  const [difficultyLevels, setDifficultyLevels] = useState<DifficultyLevel[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Load reference data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadReferenceData();
    }
  }, [isOpen]);

  // Load word data after reference data is loaded
  useEffect(() => {
    if (isOpen && wordId && !dataLoading && availableLanguages.length > 0) {
      loadWordData();
    }
  }, [isOpen, wordId, dataLoading, availableLanguages.length]);

  const loadReferenceData = async () => {
    try {
      setDataLoading(true);
      
      // Make API calls using the correct endpoints
      const [categoriesResponse, wordTypesResponse, difficultyResponse, languagesResponse] = await Promise.all([
        api.get('/categories/?language_code=en&active_only=true'),
        api.get('/word-types/?language_code=en&active_only=true'),
        api.get('/difficulty-levels/?language_code=en&active_only=true'),
        api.get('/languages/?active_only=true'),
      ]);
      
      setCategories(categoriesResponse.data || []);
      setWordTypes(wordTypesResponse.data || []);
      setDifficultyLevels(difficultyResponse.data || []);
      setAvailableLanguages(languagesResponse.data || []);
      
      console.log('Reference data loaded:', {
        categories: categoriesResponse.data?.length || 0,
        wordTypes: wordTypesResponse.data?.length || 0,
        difficultyLevels: difficultyResponse.data?.length || 0,
        languages: languagesResponse.data?.length || 0
      });
    } catch (err) {
      console.error('Failed to load reference data:', err);
      toast.error('Failed to load form data');
      setError('Failed to load form reference data');
    } finally {
      setDataLoading(false);
    }
  };

  const loadWordData = async () => {
    if (!wordId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Get detailed word data with basic info
      const wordResponse = await api.get(`/words/${wordId}?language_code=en`);
      const wordData = wordResponse.data;
      
      console.log('Word data loaded:', wordData);
      
      // Safely extract IDs with fallbacks
      const wordTypeId = wordData.word_type?.id || 1;
      const categoryId = wordData.category?.id || 1;
      const difficultyLevelId = wordData.difficulty_level?.id || 1;
      
      setFormData({
        kazakh_word: wordData.kazakh_word || '',
        kazakh_cyrillic: wordData.kazakh_cyrillic || '',
        word_type_id: wordTypeId,
        category_id: categoryId,
        difficulty_level_id: difficultyLevelId,
      });
      
      // Get ALL translations for this word from the admin API
      let allTranslations: Translation[] = [];
      
      try {
        // Try to get translations from admin endpoint (if available)
        const translationsResponse = await api.get(`/admin/translations/word/${wordId}`);
        const adminTranslations = translationsResponse.data || [];
        
        console.log('Admin translations loaded:', adminTranslations);
        
        allTranslations = adminTranslations.map((trans: any) => ({
          id: trans.id,
          language_id: trans.language_id,
          language_code: trans.language_code,
          language_name: trans.language_name,
          translation: trans.translation,
          alternative_translations: trans.alternative_translations || [],
          isNew: false,
          isModified: false
        }));
      } catch (adminError) {
        console.warn('Admin translations endpoint not available, using regular endpoint');
        
        // Fallback: Get translations from regular endpoint and combine with language data
        if (wordData.translations && wordData.translations.length > 0) {
          for (const trans of wordData.translations) {
            const language = availableLanguages.find(lang => lang.language_code === trans.language_code);
            if (language) {
              allTranslations.push({
                id: trans.id,
                language_id: language.id,
                language_code: trans.language_code,
                language_name: language.language_name,
                translation: trans.translation,
                alternative_translations: trans.alternative_translations || [],
                isNew: false,
                isModified: false
              });
            }
          }
        }
        
        // If we still don't have translations, try to fetch them for each language
        if (allTranslations.length === 0 && availableLanguages.length > 0) {
          console.log('Trying to fetch translations for each language...');
          
          for (const language of availableLanguages) {
            try {
              const langResponse = await api.get(`/words/${wordId}?language_code=${language.language_code}`);
              const langWordData = langResponse.data;
              
              if (langWordData.translations && langWordData.translations.length > 0) {
                for (const trans of langWordData.translations) {
                  // Check if we already have this translation
                  const exists = allTranslations.some(existing => 
                    existing.language_code === trans.language_code
                  );
                  
                  if (!exists) {
                    allTranslations.push({
                      id: trans.id,
                      language_id: language.id,
                      language_code: trans.language_code,
                      language_name: language.language_name,
                      translation: trans.translation,
                      alternative_translations: trans.alternative_translations || [],
                      isNew: false,
                      isModified: false
                    });
                  }
                }
              }
            } catch (langError) {
              console.warn(`Failed to fetch translations for ${language.language_code}:`, langError);
            }
          }
        }
      }
      
      setTranslations(allTranslations);
      
      console.log('Form data set:', {
        kazakh_word: wordData.kazakh_word,
        word_type_id: wordTypeId,
        category_id: categoryId,
        difficulty_level_id: difficultyLevelId,
        translations_count: allTranslations.length,
        translations: allTranslations.map(t => `${t.language_code}: ${t.translation}`)
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load word data';
      console.error('Failed to load word data:', err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.kazakh_word.trim()) {
      errors.kazakh_word = 'Kazakh word is required';
    } else if (formData.kazakh_word.length < 2) {
      errors.kazakh_word = 'Kazakh word must be at least 2 characters';
    } else if (formData.kazakh_word.length > 100) {
      errors.kazakh_word = 'Kazakh word must be less than 100 characters';
    }
    
    if (formData.kazakh_cyrillic && formData.kazakh_cyrillic.length > 100) {
      errors.kazakh_cyrillic = 'Cyrillic version must be less than 100 characters';
    }
    
    if (!formData.word_type_id) {
      errors.word_type_id = 'Word type is required';
    }
    
    if (!formData.category_id) {
      errors.category_id = 'Category is required';
    }
    
    if (!formData.difficulty_level_id) {
      errors.difficulty_level_id = 'Difficulty level is required';
    }
    
    // Validate translations
    translations.forEach((trans, index) => {
      if (trans.translation.trim().length === 0) {
        errors[`translation_${index}`] = 'Translation cannot be empty';
      } else if (trans.translation.length > 200) {
        errors[`translation_${index}`] = 'Translation must be less than 200 characters';
      }
    });
    
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: keyof WordFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleTranslationChange = (index: number, field: keyof Translation, value: string) => {
    setTranslations(prev => prev.map((trans, i) => {
      if (i === index) {
        const updated = {
          ...trans,
          [field]: value,
          isModified: !trans.isNew // Mark as modified if it's not new
        };
        return updated;
      }
      return trans;
    }));
    
    // Clear validation error
    if (validationErrors[`translation_${index}`]) {
      setValidationErrors(prev => ({
        ...prev,
        [`translation_${index}`]: ''
      }));
    }
  };

  const addTranslation = () => {
    // Find a language that doesn't have a translation yet
    const usedLanguageIds = translations.map(t => t.language_id);
    const availableLanguage = availableLanguages.find(lang => !usedLanguageIds.includes(lang.id));
    
    if (!availableLanguage) {
      toast.warning('All available languages already have translations');
      return;
    }
    
    const newTranslation: Translation = {
      language_id: availableLanguage.id,
      language_code: availableLanguage.language_code,
      language_name: availableLanguage.language_name,
      translation: '',
      alternative_translations: [],
      isNew: true,
      isModified: false
    };
    
    // Add new translation at the beginning of the array (top of the list)
    setTranslations(prev => [newTranslation, ...prev]);
  };

  const addQuickTranslations = () => {
    // Define the three languages we want to add
    const targetLanguageCodes = ['ru', 'en', 'zh'];
    
    // Get currently used language IDs
    const usedLanguageIds = translations.map(t => t.language_id);
    
    // Find available languages for each target
    const newTranslations: Translation[] = [];
    
    for (const langCode of targetLanguageCodes) {
      const language = availableLanguages.find(lang => 
        lang.language_code === langCode && !usedLanguageIds.includes(lang.id)
      );
      
      if (language) {
        newTranslations.push({
          language_id: language.id,
          language_code: language.language_code,
          language_name: language.language_name,
          translation: '',
          alternative_translations: [],
          isNew: true,
          isModified: false
        });
        
        // Add to used IDs to prevent duplicates in this operation
        usedLanguageIds.push(language.id);
      }
    }
    
    if (newTranslations.length === 0) {
      toast.warning('Russian, English, and Chinese translations already exist');
      return;
    }
    
    // Add new translations at the beginning of the array
    setTranslations(prev => [...newTranslations, ...prev]);
    
    toast.success(`Added ${newTranslations.length} translation fields`);
  };

  const removeTranslation = (index: number) => {
    const translationToRemove = translations[index];
    
    if (translationToRemove.id && !translationToRemove.isNew) {
      // If it's an existing translation, add it to the deletion list
      setDeletedTranslationIds(prev => [...prev, translationToRemove.id!]);
    }
    
    // Remove from the current translations array
    setTranslations(prev => prev.filter((_, i) => i !== index));
  };

  const changeTranslationLanguage = (index: number, languageId: number) => {
    const language = availableLanguages.find(lang => lang.id === languageId);
    if (!language) return;
    
    setTranslations(prev => prev.map((trans, i) => {
      if (i === index) {
        return {
          ...trans,
          language_id: languageId,
          language_code: language.language_code,
          language_name: language.language_name,
          isModified: !trans.isNew
        };
      }
      return trans;
    }));
  };

  const saveTranslations = async () => {
    if (!wordId) return;
    
    try {
      // First, delete any translations that were marked for deletion
      for (const translationId of deletedTranslationIds) {
        try {
          console.log('Deleting translation with ID:', translationId);
          await api.delete(`/admin/translations/${translationId}`);
        } catch (deleteError) {
          console.error('Failed to delete translation:', deleteError);
          // Continue with other operations even if one deletion fails
        }
      }
      
      // Then, save or update translations
      for (const translation of translations) {
        if (translation.isNew) {
          // Create new translation
          console.log('Creating new translation:', translation);
          await api.post('/admin/translations/', {
            kazakh_word_id: wordId,
            language_id: translation.language_id,
            translation: translation.translation,
            alternative_translations: translation.alternative_translations?.filter(alt => alt.trim() !== '') || []
          });
        } else if (translation.isModified && translation.id) {
          // Update existing translation
          console.log('Updating existing translation:', translation);
          await api.put(`/admin/translations/${translation.id}`, {
            translation: translation.translation,
            alternative_translations: translation.alternative_translations?.filter(alt => alt.trim() !== '') || []
          });
        }
      }
      
      // Clear the deletion list after successful operations
      setDeletedTranslationIds([]);
    } catch (error) {
      console.error('Failed to save translations:', error);
      throw new Error('Failed to save translations');
    }
  };

  const handleSave = async () => {
    if (!wordId) return;
    
    // Validate form and set errors
    const errors: Record<string, string> = {};
    
    if (!formData.kazakh_word.trim()) {
      errors.kazakh_word = 'Kazakh word is required';
    } else if (formData.kazakh_word.length < 2) {
      errors.kazakh_word = 'Kazakh word must be at least 2 characters';
    } else if (formData.kazakh_word.length > 100) {
      errors.kazakh_word = 'Kazakh word must be less than 100 characters';
    }
    
    if (formData.kazakh_cyrillic && formData.kazakh_cyrillic.length > 100) {
      errors.kazakh_cyrillic = 'Cyrillic version must be less than 100 characters';
    }
    
    if (!formData.word_type_id) {
      errors.word_type_id = 'Word type is required';
    }
    
    if (!formData.category_id) {
      errors.category_id = 'Category is required';
    }
    
    if (!formData.difficulty_level_id) {
      errors.difficulty_level_id = 'Difficulty level is required';
    }
    
    // Validate translations
    translations.forEach((trans, index) => {
      if (trans.translation.trim().length === 0) {
        errors[`translation_${index}`] = 'Translation cannot be empty';
      } else if (trans.translation.length > 200) {
        errors[`translation_${index}`] = 'Translation must be less than 200 characters';
      }
    });
    
    setValidationErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      
      // Prepare update data (only include changed fields)
      const updateData: AdminWordUpdateData = {};
      
      if (formData.kazakh_word.trim()) {
        updateData.kazakh_word = formData.kazakh_word.trim();
      }
      
      if (formData.kazakh_cyrillic.trim()) {
        updateData.kazakh_cyrillic = formData.kazakh_cyrillic.trim();
      }
      
      if (formData.word_type_id) {
        updateData.word_type_id = formData.word_type_id;
      }
      
      if (formData.category_id) {
        updateData.category_id = formData.category_id;
      }
      
      if (formData.difficulty_level_id) {
        updateData.difficulty_level_id = formData.difficulty_level_id;
      }
      
      console.log('Saving word with data:', updateData);
      
      // Update word basic data
      await adminWordsAPI.updateWord(wordId, updateData);
      
      // Save translations
      await saveTranslations();
      
      toast.success('Word and translations updated successfully');
      onSave(); // Refresh the parent list
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update word';
      console.error('Failed to update word:', err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    // Reset form state
    setFormData({
      kazakh_word: '',
      kazakh_cyrillic: '',
      word_type_id: 1,
      category_id: 1,
      difficulty_level_id: 1,
    });
    setTranslations([]);
    setDeletedTranslationIds([]);
    setValidationErrors({});
    setError(null);
    setActiveTab('basic');
    onClose();
  };

  if (dataLoading) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Loading..." size="lg">
        <div className="flex justify-center items-center h-32">
          <LoadingSpinner />
          <span className="ml-2 text-gray-600">Loading form data...</span>
        </div>
      </Modal>
    );
  }

  const getAvailableLanguagesForSelect = (currentLanguageId?: number) => {
    const usedLanguageIds = translations
      .filter(t => t.language_id !== currentLanguageId)
      .map(t => t.language_id);
    return availableLanguages.filter(lang => !usedLanguageIds.includes(lang.id));
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title={wordId ? 'Edit Word' : 'Add Word'}
      size="lg"
    >
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('basic')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'basic'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Basic Information
            </button>
            <button
              onClick={() => setActiveTab('translations')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'translations'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Translations
              {translations.length > 0 && (
                <Badge className="ml-2 bg-blue-100 text-blue-800">
                  {translations.length}
                </Badge>
              )}
            </button>
          </nav>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-32">
            <LoadingSpinner />
            <span className="ml-2 text-gray-600">Loading word data...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Basic Information Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-4">
                {/* Kazakh Word */}
                <div>
                  <label htmlFor="kazakh_word" className="block text-sm font-medium text-gray-700 mb-1">
                    Kazakh Word *
                  </label>
                  <input
                    type="text"
                    id="kazakh_word"
                    value={formData.kazakh_word}
                    onChange={(e) => handleInputChange('kazakh_word', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.kazakh_word ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter Kazakh word"
                  />
                  {validationErrors.kazakh_word && (
                    <p className="text-red-600 text-sm mt-1">{validationErrors.kazakh_word}</p>
                  )}
                </div>

                {/* Kazakh Cyrillic */}
                <div>
                  <label htmlFor="kazakh_cyrillic" className="block text-sm font-medium text-gray-700 mb-1">
                    Kazakh Cyrillic
                  </label>
                  <input
                    type="text"
                    id="kazakh_cyrillic"
                    value={formData.kazakh_cyrillic}
                    onChange={(e) => handleInputChange('kazakh_cyrillic', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.kazakh_cyrillic ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter Cyrillic version (optional)"
                  />
                  {validationErrors.kazakh_cyrillic && (
                    <p className="text-red-600 text-sm mt-1">{validationErrors.kazakh_cyrillic}</p>
                  )}
                </div>

                {/* Category */}
                <div>
                  <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    id="category_id"
                    value={formData.category_id}
                    onChange={(e) => handleInputChange('category_id', parseInt(e.target.value))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.category_id ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select a category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.category_name}
                      </option>
                    ))}
                  </select>
                  {validationErrors.category_id && (
                    <p className="text-red-600 text-sm mt-1">{validationErrors.category_id}</p>
                  )}
                  {categories.length === 0 && (
                    <p className="text-yellow-600 text-sm mt-1">No categories available</p>
                  )}
                </div>

                {/* Word Type */}
                <div>
                  <label htmlFor="word_type_id" className="block text-sm font-medium text-gray-700 mb-1">
                    Word Type *
                  </label>
                  <select
                    id="word_type_id"
                    value={formData.word_type_id}
                    onChange={(e) => handleInputChange('word_type_id', parseInt(e.target.value))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.word_type_id ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select a word type</option>
                    {wordTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.type_name}
                      </option>
                    ))}
                  </select>
                  {validationErrors.word_type_id && (
                    <p className="text-red-600 text-sm mt-1">{validationErrors.word_type_id}</p>
                  )}
                  {wordTypes.length === 0 && (
                    <p className="text-yellow-600 text-sm mt-1">No word types available</p>
                  )}
                </div>

                {/* Difficulty Level */}
                <div>
                  <label htmlFor="difficulty_level_id" className="block text-sm font-medium text-gray-700 mb-1">
                    Difficulty Level *
                  </label>
                  <select
                    id="difficulty_level_id"
                    value={formData.difficulty_level_id}
                    onChange={(e) => handleInputChange('difficulty_level_id', parseInt(e.target.value))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.difficulty_level_id ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select difficulty level</option>
                    {difficultyLevels.map((level) => (
                      <option key={level.id} value={level.id}>
                        Level {level.level_number} - {level.level_name}
                      </option>
                    ))}
                  </select>
                  {validationErrors.difficulty_level_id && (
                    <p className="text-red-600 text-sm mt-1">{validationErrors.difficulty_level_id}</p>
                  )}
                  {difficultyLevels.length === 0 && (
                    <p className="text-yellow-600 text-sm mt-1">No difficulty levels available</p>
                  )}
                </div>
              </div>
            )}

            {/* Translations Tab */}
            {activeTab === 'translations' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Translations</h3>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={addQuickTranslations}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                      title="Add Russian, English, and Chinese translations"
                    >
                      +++
                    </button>
                    <button
                      type="button"
                      onClick={addTranslation}
                      disabled={translations.length >= availableLanguages.length}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Translation
                    </button>
                  </div>
                </div>

                {translations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                    <p>No translations added yet</p>
                    <p className="text-sm">Click "+++" to quickly add Russian, English, and Chinese</p>
                    <p className="text-sm">or "Add Translation" to start adding translations</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {translations.map((translation, index) => (
                      <div key={index} className="bg-gray-50 p-4 rounded-lg border">
                        <div className="flex items-start space-x-4">
                          <div className="flex-1 space-y-3">
                            {/* Language Selection */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Language
                              </label>
                              <select
                                value={translation.language_id}
                                onChange={(e) => changeTranslationLanguage(index, parseInt(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                <option value={translation.language_id}>
                                  {translation.language_name} ({translation.language_code})
                                </option>
                                {getAvailableLanguagesForSelect(translation.language_id).map((lang) => (
                                  <option key={lang.id} value={lang.id}>
                                    {lang.language_name} ({lang.language_code})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Main Translation */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Translation *
                              </label>
                              <input
                                type="text"
                                value={translation.translation}
                                onChange={(e) => handleTranslationChange(index, 'translation', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                  validationErrors[`translation_${index}`] ? 'border-red-300' : 'border-gray-300'
                                }`}
                                placeholder="Enter translation"
                              />
                              {validationErrors[`translation_${index}`] && (
                                <p className="text-red-600 text-sm mt-1">{validationErrors[`translation_${index}`]}</p>
                              )}
                            </div>

                            {/* Alternative Translations */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Alternative Translations
                                <span className="text-gray-500 text-xs ml-1">(comma-separated)</span>
                              </label>
                              <input
                                type="text"
                                value={translation.alternative_translations?.join(', ') || ''}
                                onChange={(e) => {
                                  const alternatives = e.target.value
                                    .split(',')
                                    .map(alt => alt.trim())
                                    .filter(alt => alt !== '');
                                  handleTranslationChange(index, 'alternative_translations', alternatives as any);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Enter alternative translations separated by commas"
                              />
                            </div>
                          </div>

                          {/* Remove Button */}
                          <button
                            type="button"
                            onClick={() => removeTranslation(index)}
                            className="mt-8 p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md"
                            title="Remove translation"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>

                        {/* Status indicators */}
                        {(translation.isNew || translation.isModified) && (
                          <div className="mt-2 flex space-x-2">
                            {translation.isNew && (
                              <Badge className="bg-green-100 text-green-800">New</Badge>
                            )}
                            {translation.isModified && (
                              <Badge className="bg-yellow-100 text-yellow-800">Modified</Badge>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {translations.length >= availableLanguages.length && (
                  <p className="text-sm text-gray-500 italic">
                    All available languages have translations
                  </p>
                )}
              </div>
            )}

            {/* Enhanced Information Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-blue-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-blue-800 mb-1">Translation Management</h4>
                  <p className="text-sm text-blue-700">
                    Use "+++" to quickly add Russian, English, and Chinese translation fields. 
                    Click "Add Translation" to add one language at a time. Changes are saved when you click "Save Changes".
                  </p>
                </div>
              </div>
            </div>

            {/* Debug Info (remove in production) */}
            {process.env.NODE_ENV === 'development' && (
              <div className="bg-gray-50 p-3 rounded text-xs">
                <p><strong>Debug Info:</strong></p>
                <p>Categories: {categories.length}</p>
                <p>Word Types: {wordTypes.length}</p>
                <p>Difficulty Levels: {difficultyLevels.length}</p>
                <p>Available Languages: {availableLanguages.length}</p>
                <p>Current Translations: {translations.length}</p>
                <p>Deleted Translation IDs: {deletedTranslationIds.length > 0 ? deletedTranslationIds.join(', ') : 'None'}</p>
                <p>Active Tab: {activeTab}</p>
                <p>Has Validation Errors: {Object.keys(validationErrors).length > 0 ? 'Yes' : 'No'}</p>
                <p>New Translations: {translations.filter(t => t.isNew).length}</p>
                <p>Modified Translations: {translations.filter(t => t.isModified).length}</p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !wordId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {saving ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Saving...</span>
              </>
            ) : (
              <>
                Save Changes
                {(translations.filter(t => t.isNew).length > 0 || translations.filter(t => t.isModified).length > 0 || deletedTranslationIds.length > 0) && (
                  <Badge className="ml-2 bg-blue-800 text-blue-100">
                    {translations.filter(t => t.isNew || t.isModified).length + deletedTranslationIds.length} changes
                  </Badge>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default WordEditModal;