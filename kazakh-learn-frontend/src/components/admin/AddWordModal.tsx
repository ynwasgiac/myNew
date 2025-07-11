import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import Modal from '../../components/ui/Modal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Badge from '../../components/ui/Badge';
import { adminWordsAPI } from '../../services/adminWordsAPI';
import api from '../../services/api';
import { toast } from 'sonner';

interface TranslationServiceResponse {
  primary_translation: string;
  alternative_translations: string[];
  confidence: number;
  language_code: string;
  language_name: string;
}

interface QuickTranslationServiceResponse {
  translations: Record<string, TranslationServiceResponse>;
  success_count: number;
  total_count: number;
  kazakh_word: string;
  processing_time_seconds?: number;
}

interface AddWordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface WordCreateData {
  kazakh_word: string;
  kazakh_cyrillic: string;
  word_type_id: number;
  category_id: number;
  difficulty_level_id: number;
}

interface Translation {
  language_id: number;
  language_code: string;
  language_name: string;
  translation: string;
  alternative_translations?: string[];
  isNew: boolean;
}

interface TranslationResult {
  primary_translation: string;
  alternative_translations: string[];
  confidence: number;
  language_code: string;
  language_name: string;
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

const AddWordModal: React.FC<AddWordModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const { t } = useTranslation();
  
  // Form state
  const [formData, setFormData] = useState<WordCreateData>({
    kazakh_word: '',
    kazakh_cyrillic: '',
    word_type_id: 1,
    category_id: 1,
    difficulty_level_id: 1,
  });
  
  // Translation state
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<Language[]>([]);
  const [translatingLanguages, setTranslatingLanguages] = useState<Set<string>>(new Set());
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'basic' | 'translations'>('basic');
  
  // Loading and error states
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Reference data
  const [categories, setCategories] = useState<Category[]>([]);
  const [wordTypes, setWordTypes] = useState<WordType[]>([]);
  const [difficultyLevels, setDifficultyLevels] = useState<DifficultyLevel[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Translation service availability
  const [translationServiceAvailable, setTranslationServiceAvailable] = useState(false);

  // Load reference data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadReferenceData();
      checkTranslationService();
    }
  }, [isOpen]);

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
      
      // Set default values to the first available options
      if (categoriesResponse.data?.length > 0) {
        setFormData(prev => ({ ...prev, category_id: categoriesResponse.data[0].id }));
      }
      if (wordTypesResponse.data?.length > 0) {
        setFormData(prev => ({ ...prev, word_type_id: wordTypesResponse.data[0].id }));
      }
      if (difficultyResponse.data?.length > 0) {
        setFormData(prev => ({ ...prev, difficulty_level_id: difficultyResponse.data[0].id }));
      }
      
      console.log('Reference data loaded for Add Word:', {
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

  const checkTranslationService = async () => {
    try {
      console.log('Checking translation service...');
      const response = await api.get('/admin/translate/test');
      console.log('Translation service response:', response.data);
      
      // Check if the service is available based on the response
      const isAvailable = response.data?.service_available === true;
      console.log('Translation service available:', isAvailable);
      
      setTranslationServiceAvailable(isAvailable);
    } catch (err: any) {
      console.error('Translation service check failed:', err);
      console.error('Error details:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message
      });
      setTranslationServiceAvailable(false);
    }
  };

  const handleInputChange = (field: keyof WordCreateData, value: string | number) => {
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
        return {
          ...trans,
          [field]: value
        };
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
      isNew: true
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
          isNew: true
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

  const translateWord = async (translationIndex: number) => {
    const translation = translations[translationIndex];
    
    if (!formData.kazakh_word.trim()) {
      toast.error('Please enter the Kazakh word first');
      return;
    }
  
    if (!translationServiceAvailable) {
      toast.error('Translation service is not available');
      return;
    }
  
    try {
      console.log(`Starting translation for ${translation.language_code}...`);
      
      // Add language to translating set
      setTranslatingLanguages(prev => new Set(prev).add(translation.language_code));
  
      const requestData = {
        kazakh_word: formData.kazakh_word.trim(),
        kazakh_cyrillic: formData.kazakh_cyrillic.trim() || null,
        target_language_code: translation.language_code,
        target_language_name: translation.language_name,
        context: `Word type: ${wordTypes.find(wt => wt.id === formData.word_type_id)?.type_name || 'Unknown'}`
      };
  
      console.log('Translation request:', requestData);
  
      const response = await api.post('/admin/translate/word', requestData);
      console.log('Translation response:', response.data);
  
      // Handle the TranslationServiceResponse structure
      const result: TranslationServiceResponse = response.data;
  
      // Update the translation with the result
      setTranslations(prev => prev.map((trans, i) => {
        if (i === translationIndex) {
          return {
            ...trans,
            translation: result.primary_translation,
            alternative_translations: result.alternative_translations || []
          };
        }
        return trans;
      }));
  
      const confidencePercent = Math.round((result.confidence || 0.8) * 100);
      toast.success(`Translated to ${translation.language_name} (confidence: ${confidencePercent}%)`);
  
    } catch (error: any) {
      console.error('Translation failed:', error);
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      toast.error(`Translation to ${translation.language_name} failed: ${errorMessage}`);
    } finally {
      // Remove language from translating set
      setTranslatingLanguages(prev => {
        const newSet = new Set(prev);
        newSet.delete(translation.language_code);
        return newSet;
      });
    }
  };

  const quickTranslateAll = async () => {
    if (!formData.kazakh_word.trim()) {
      toast.error('Please enter the Kazakh word first');
      return;
    }
  
    if (!translationServiceAvailable) {
      toast.error('Translation service is not available');
      return;
    }
  
    try {
      console.log('Starting quick translation...');
      
      // Add all common languages to translating set
      const commonLanguages = ['ru', 'en', 'zh'];
      setTranslatingLanguages(prev => {
        const newSet = new Set(prev);
        commonLanguages.forEach(lang => newSet.add(lang));
        return newSet;
      });
  
      const requestData = {
        kazakh_word: formData.kazakh_word.trim(),
        kazakh_cyrillic: formData.kazakh_cyrillic.trim() || null
      };
  
      console.log('Quick translation request:', requestData);
  
      const response = await api.post('/admin/translate/quick', requestData);
      console.log('Quick translation response:', response.data);
  
      // Handle the QuickTranslationServiceResponse structure
      const results: QuickTranslationServiceResponse = response.data;
  
      // Update or add translations based on results
      const newTranslations = [...translations];
      let addedCount = 0;
      let updatedCount = 0;
  
      // Handle the response structure correctly
      const translationsData = results.translations || {};
  
      for (const [langCode, result] of Object.entries(translationsData)) {
        if (!result.primary_translation) continue;
  
        // Find if translation already exists
        const existingIndex = newTranslations.findIndex(t => t.language_code === langCode);
        
        if (existingIndex >= 0) {
          // Update existing translation
          newTranslations[existingIndex] = {
            ...newTranslations[existingIndex],
            translation: result.primary_translation,
            alternative_translations: result.alternative_translations || []
          };
          updatedCount++;
        } else {
          // Add new translation
          const language = availableLanguages.find(lang => lang.language_code === langCode);
          if (language) {
            newTranslations.unshift({
              language_id: language.id,
              language_code: language.language_code,
              language_name: language.language_name,
              translation: result.primary_translation,
              alternative_translations: result.alternative_translations || [],
              isNew: true
            });
            addedCount++;
          }
        }
      }
  
      setTranslations(newTranslations);
      
      const totalSuccess = results.success_count || (addedCount + updatedCount);
      toast.success(`Quick translation completed! Added: ${addedCount}, Updated: ${updatedCount}, Total successful: ${totalSuccess}`);
  
    } catch (error: any) {
      console.error('Quick translation failed:', error);
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      toast.error(`Quick translation failed: ${errorMessage}`);
    } finally {
      // Clear all translating languages
      setTranslatingLanguages(new Set());
    }
  }; 

  const removeTranslation = (index: number) => {
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
          language_name: language.language_name
        };
      }
      return trans;
    }));
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
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const createTranslations = async (wordId: number) => {
    if (translations.length === 0) return;
    
    try {
      // Create all translations
      for (const translation of translations) {
        if (translation.translation.trim()) {
          console.log('Creating translation:', translation);
          await api.post('/admin/translations/', {
            kazakh_word_id: wordId,
            language_id: translation.language_id,
            translation: translation.translation,
            alternative_translations: translation.alternative_translations?.filter(alt => alt.trim() !== '') || []
          });
        }
      }
    } catch (error) {
      console.error('Failed to create translations:', error);
      throw new Error('Failed to create translations');
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    try {
      setSaving(true);
      setError(null);
      
      // Prepare create data
      const createData = {
        kazakh_word: formData.kazakh_word.trim(),
        kazakh_cyrillic: formData.kazakh_cyrillic.trim() || undefined,
        word_type_id: formData.word_type_id,
        category_id: formData.category_id,
        difficulty_level_id: formData.difficulty_level_id,
      };
      
      console.log('Creating new word with data:', createData);
      
      // Create word using admin API
      const newWord = await adminWordsAPI.createWord(createData);
      
      console.log('Word created successfully:', newWord);
      
      // Create translations if any were added
      if (translations.length > 0) {
        await createTranslations(newWord.id);
        console.log('Translations created successfully');
      }
      
      const successMessage = translations.length > 0 
        ? `Word "${createData.kazakh_word}" created with ${translations.length} translations!`
        : `Word "${createData.kazakh_word}" created successfully!`;
      
      toast.success(successMessage);
      onSave(); // Refresh the parent list
      handleClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create word';
      console.error('Failed to create word:', err);
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
      word_type_id: categories.length > 0 ? categories[0].id : 1,
      category_id: wordTypes.length > 0 ? wordTypes[0].id : 1,
      difficulty_level_id: difficultyLevels.length > 0 ? difficultyLevels[0].id : 1,
    });
    setTranslations([]);
    setValidationErrors({});
    setError(null);
    setActiveTab('basic');
    setTranslatingLanguages(new Set());
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !saving && activeTab === 'basic') {
      event.preventDefault();
      handleSave();
    }
  };

  const getAvailableLanguagesForSelect = (currentLanguageId?: number) => {
    const usedLanguageIds = translations
      .filter(t => t.language_id !== currentLanguageId)
      .map(t => t.language_id);
    return availableLanguages.filter(lang => !usedLanguageIds.includes(lang.id));
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

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="Add New Word"
      size="lg"
    >
      <div className="space-y-6" onKeyDown={handleKeyDown}>
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
                  autoFocus
                />
                {validationErrors.kazakh_word && (
                  <p className="text-red-600 text-sm mt-1">{validationErrors.kazakh_word}</p>
                )}
              </div>

              {/* Kazakh Cyrillic */}
              <div>
                <label htmlFor="kazakh_cyrillic" className="block text-sm font-medium text-gray-700 mb-1">
                  Kazakh Cyrillic
                  <span className="text-gray-500 text-xs ml-1">(optional)</span>
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
                  {translationServiceAvailable && (
                    <button
                      type="button"
                      onClick={quickTranslateAll}
                      disabled={!formData.kazakh_word.trim() || translatingLanguages.size > 0}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Auto-translate to Russian, English, and Chinese"
                    >
                      {translatingLanguages.size > 0 ? (
                        <>
                          <LoadingSpinner size="sm" />
                          <span className="ml-2">Translating...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                          </svg>
                          Quick Translate
                        </>
                      )}
                    </button>
                  )}
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

              {/* Translation Service Status */}
              {!translationServiceAvailable && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-yellow-800 text-sm">Translation service is not available. You can still add translations manually.</span>
                  </div>
                </div>
              )}

              {translations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                  <p>No translations added yet</p>
                  <p className="text-sm">Click "+++" to quickly add Russian, English, and Chinese</p>
                  <p className="text-sm">or "Add Translation" to add one at a time</p>
                  {translationServiceAvailable && (
                    <p className="text-sm text-purple-600">Use "Quick Translate" to auto-translate!</p>
                  )}
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
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-sm font-medium text-gray-700">
                                Translation *
                              </label>
                              {translationServiceAvailable && (
                                <button
                                  type="button"
                                  onClick={() => translateWord(index)}
                                  disabled={!formData.kazakh_word.trim() || translatingLanguages.has(translation.language_code)}
                                  className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-purple-700 bg-purple-100 hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Auto-translate this field"
                                >
                                  {translatingLanguages.has(translation.language_code) ? (
                                    <>
                                      <LoadingSpinner size="sm" />
                                      <span className="ml-1">Translating...</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                                      </svg>
                                      Translate
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
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
                      <div className="mt-2">
                        <Badge className="bg-green-100 text-green-800">New</Badge>
                      </div>
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

          {/* Information Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-blue-800 mb-1">Smart Translation Features</h4>
                <p className="text-sm text-blue-700">
                  Use "+++" to quickly add Russian, English, and Chinese translation fields. 
                  {translationServiceAvailable && (
                    <span> Use "Quick Translate" to auto-translate to common languages, or click "Translate" on individual fields for AI-powered translations.</span>
                  )}
                  {!translationServiceAvailable && (
                    <span> Manual translation entry is available.</span>
                  )}
                  After creating the word, you can edit it to add images and audio files.
                </p>
              </div>
            </div>
          </div>

          {/* Debug Info (development only) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-gray-50 p-3 rounded text-xs">
              <p><strong>Debug Info:</strong></p>
              <p>Categories: {categories.length}</p>
              <p>Word Types: {wordTypes.length}</p>
              <p>Difficulty Levels: {difficultyLevels.length}</p>
              <p>Available Languages: {availableLanguages.length}</p>
              <p>Current Translations: {translations.length}</p>
              <p>Active Tab: {activeTab}</p>
              <p>Has Validation Errors: {Object.keys(validationErrors).length > 0 ? 'Yes' : 'No'}</p>
              <p>Translation Service Available: {translationServiceAvailable ? 'Yes' : 'No'}</p>
              <p>Translating Languages: {Array.from(translatingLanguages).join(', ') || 'None'}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center"
          >
            {saving ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Creating...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Word
                {translations.length > 0 && (
                  <Badge className="ml-2 bg-green-800 text-green-100">
                    +{translations.length}
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

export default AddWordModal;