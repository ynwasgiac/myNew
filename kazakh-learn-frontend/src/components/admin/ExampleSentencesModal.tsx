// ExampleSentencesModal.tsx
import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import LoadingSpinner from '../ui/LoadingSpinner';
import Badge from '../ui/Badge';
import { toast } from 'sonner';
import api from '../../services/api';

interface ExampleSentence {
  id: number;
  kazakh_sentence: string;
  difficulty_level: number;
  usage_context?: string;
  created_at: string;
  translations: Translation[];
}

interface Translation {
  id: number;
  translated_sentence: string;
  language_code: string;
  created_at: string;
}

interface Language {
  id: number;
  language_code: string;
  language_name: string;
}

interface ExampleSentencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  wordId: number | null;
  wordInfo: {
    kazakh_word: string;
    kazakh_cyrillic?: string;
  } | null;
  onSave: () => void;
}

interface NewSentence {
  kazakh_sentence: string;
  difficulty_level: number;
  usage_context: string;
  translations: { [languageCode: string]: string };
}

const ExampleSentencesModal: React.FC<ExampleSentencesModalProps> = ({
  isOpen,
  onClose,
  wordId,
  wordInfo,
  onSave
}) => {
  const [sentences, setSentences] = useState<ExampleSentence[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [translating, setTranslating] = useState<{ [key: string]: boolean }>({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  
  const [newSentence, setNewSentence] = useState<NewSentence>({
    kazakh_sentence: '',
    difficulty_level: 1,
    usage_context: '',
    translations: {}
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Fetch existing sentences and languages when modal opens
  useEffect(() => {
    if (isOpen && wordId) {
      fetchData();
    }
  }, [isOpen, wordId]);

  const fetchData = async () => {
    if (!wordId) return;

    setLoading(true);
    try {
      // Fetch existing sentences
      const sentencesResponse = await api.get(`/words/${wordId}/example-sentences`);
      setSentences(sentencesResponse.data);

      // Fetch available languages
      const languagesResponse = await api.get('/languages');
      setLanguages(languagesResponse.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load example sentences');
    } finally {
      setLoading(false);
    }
  };

  const generateSentenceWithGPT = async () => {
    if (!wordInfo?.kazakh_word) {
      toast.error('Word information is required for generation');
      return;
    }

    setGenerating(true);
    try {
      const response = await api.post('/ai/generate-example-sentence', {
        kazakh_word: wordInfo.kazakh_word,
        kazakh_cyrillic: wordInfo.kazakh_cyrillic,
        difficulty_level: newSentence.difficulty_level,
        usage_context: newSentence.usage_context || 'daily conversation'
      });

      const generated = response.data;
      setNewSentence(prev => ({
        ...prev,
        kazakh_sentence: generated.kazakh_sentence,
        usage_context: generated.usage_context || prev.usage_context
      }));

      toast.success('Example sentence generated successfully');
    } catch (error: any) {
      console.error('Error generating sentence:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to generate sentence';
      toast.error(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  const translateSentenceWithGPT = async (languageCode: string, languageName: string) => {
    if (!newSentence.kazakh_sentence) {
      toast.error('Please enter a Kazakh sentence first');
      return;
    }

    const translationKey = `new_${languageCode}`;
    setTranslating(prev => ({ ...prev, [translationKey]: true }));

    try {
      const response = await api.post('/ai/translate-sentence', {
        kazakh_sentence: newSentence.kazakh_sentence,
        target_language_code: languageCode,
        target_language_name: languageName,
        context: newSentence.usage_context
      });

      const translation = response.data;
      setNewSentence(prev => ({
        ...prev,
        translations: {
          ...prev.translations,
          [languageCode]: translation.translated_sentence
        }
      }));

      toast.success(`Translation to ${languageName} generated successfully`);
    } catch (error: any) {
      console.error('Error translating sentence:', error);
      const errorMessage = error.response?.data?.detail || `Failed to translate to ${languageName}`;
      toast.error(errorMessage);
    } finally {
      setTranslating(prev => ({ ...prev, [translationKey]: false }));
    }
  };

  const translateExistingSentence = async (sentenceId: number, languageCode: string, languageName: string) => {
    const sentence = sentences.find(s => s.id === sentenceId);
    if (!sentence) return;

    const translationKey = `existing_${sentenceId}_${languageCode}`;
    setTranslating(prev => ({ ...prev, [translationKey]: true }));

    try {
      const response = await api.post('/ai/translate-sentence', {
        kazakh_sentence: sentence.kazakh_sentence,
        target_language_code: languageCode,
        target_language_name: languageName,
        context: sentence.usage_context
      });

      const translation = response.data;

      // Create the translation via API
      await api.post('/example-sentence-translations/', {
        example_sentence_id: sentenceId,
        language_code: languageCode,
        translated_sentence: translation.translated_sentence
      });

      // Refresh the sentences to show the new translation
      await fetchData();
      toast.success(`Translation to ${languageName} added successfully`);
    } catch (error: any) {
      console.error('Error translating existing sentence:', error);
      const errorMessage = error.response?.data?.detail || `Failed to translate to ${languageName}`;
      toast.error(errorMessage);
    } finally {
      setTranslating(prev => ({ ...prev, [translationKey]: false }));
    }
  };

  const saveSentence = async () => {
    if (!wordId) return;

    // Validate form
    const newErrors: { [key: string]: string } = {};
    if (!newSentence.kazakh_sentence.trim()) {
      newErrors.kazakh_sentence = 'Kazakh sentence is required';
    }
    if (newSentence.difficulty_level < 1 || newSentence.difficulty_level > 5) {
      newErrors.difficulty_level = 'Difficulty level must be between 1 and 5';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      // Create the example sentence
      const sentenceResponse = await api.post('/example-sentences/', {
        kazakh_word_id: wordId,
        kazakh_sentence: newSentence.kazakh_sentence.trim(),
        difficulty_level: newSentence.difficulty_level,
        usage_context: newSentence.usage_context.trim() || null
      });

      const sentenceId = sentenceResponse.data.id;

      // Create translations if any
      const translationPromises = Object.entries(newSentence.translations)
        .filter(([_, translation]) => translation.trim())
        .map(([languageCode, translation]) =>
          api.post('/example-sentence-translations/', {
            example_sentence_id: sentenceId,
            language_code: languageCode,
            translated_sentence: translation.trim()
          })
        );

      await Promise.all(translationPromises);

      // Reset form
      setNewSentence({
        kazakh_sentence: '',
        difficulty_level: 1,
        usage_context: '',
        translations: {}
      });
      setErrors({});
      setIsAddingNew(false);

      // Refresh data and notify parent
      await fetchData();
      onSave();
      toast.success('Example sentence added successfully');
    } catch (error: any) {
      console.error('Error saving sentence:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to save sentence';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const deleteSentence = async (sentenceId: number) => {
    if (!confirm('Are you sure you want to delete this example sentence?')) {
      return;
    }

    try {
      await api.delete(`/example-sentences/${sentenceId}`);
      await fetchData();
      toast.success('Example sentence deleted successfully');
    } catch (error: any) {
      console.error('Error deleting sentence:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to delete sentence';
      toast.error(errorMessage);
    }
  };

  const handleClose = () => {
    setIsAddingNew(false);
    setNewSentence({
      kazakh_sentence: '',
      difficulty_level: 1,
      usage_context: '',
      translations: {}
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Manage Example Sentences" size="xl">
      <div className="space-y-6">
        {/* Header with word info */}
        {wordInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-900">
              {wordInfo.kazakh_word}
              {wordInfo.kazakh_cyrillic && (
                <span className="text-blue-700 ml-2">({wordInfo.kazakh_cyrillic})</span>
              )}
            </h3>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
            <span className="ml-3 text-gray-600">Loading sentences...</span>
          </div>
        ) : (
          <>
            {/* Existing sentences */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-semibold text-gray-900">
                  Existing Sentences ({sentences.length})
                </h4>
                <button
                  onClick={() => setIsAddingNew(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                >
                  Add New Sentence
                </button>
              </div>

              {sentences.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">No example sentences yet.</p>
                  <p className="text-sm text-gray-400 mt-1">Add your first example sentence above.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sentences.map((sentence) => (
                    <div key={sentence.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900">{sentence.kazakh_sentence}</h5>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className="bg-gray-100 text-gray-800">
                              Level {sentence.difficulty_level}
                            </Badge>
                            {sentence.usage_context && (
                              <Badge className="bg-green-100 text-green-800">
                                {sentence.usage_context}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteSentence(sentence.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </div>

                      {/* Translations */}
                      <div className="mt-3">
                        <h6 className="text-sm font-medium text-gray-700 mb-2">
                          Translations ({sentence.translations.length})
                        </h6>
                        
                        {sentence.translations.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {sentence.translations.map((translation) => (
                              <div key={translation.id} className="bg-gray-50 p-2 rounded">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">
                                    <Badge className="bg-blue-100 text-blue-800 mr-2">
                                      {translation.language_code.toUpperCase()}
                                    </Badge>
                                    {translation.translated_sentence}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add translation buttons */}
                        <div className="flex flex-wrap gap-2">
                          {languages
                            .filter(lang => !sentence.translations.some(t => t.language_code === lang.language_code))
                            .map((language) => {
                              const translationKey = `existing_${sentence.id}_${language.language_code}`;
                              const isTranslating = translating[translationKey];
                              
                              return (
                                <button
                                  key={language.id}
                                  onClick={() => translateExistingSentence(sentence.id, language.language_code, language.language_name)}
                                  disabled={isTranslating}
                                  className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                >
                                  {isTranslating ? (
                                    <>
                                      <LoadingSpinner size="sm" />
                                      Translating...
                                    </>
                                  ) : (
                                    `+ ${language.language_name}`
                                  )}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add new sentence form */}
            {isAddingNew && (
              <div className="border-t pt-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Add New Example Sentence</h4>
                
                <div className="space-y-4">
                  {/* Kazakh sentence input with generate button */}
                  <div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Kazakh Sentence *
                        </label>
                        <textarea
                          value={newSentence.kazakh_sentence}
                          onChange={(e) => setNewSentence(prev => ({ ...prev, kazakh_sentence: e.target.value }))}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            errors.kazakh_sentence ? 'border-red-300' : 'border-gray-300'
                          }`}
                          rows={3}
                          placeholder="Enter Kazakh sentence or generate with AI"
                        />
                        {errors.kazakh_sentence && (
                          <p className="text-red-500 text-sm mt-1">{errors.kazakh_sentence}</p>
                        )}
                      </div>
                      <div className="flex flex-col justify-end">
                        <button
                          onClick={generateSentenceWithGPT}
                          disabled={generating}
                          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center whitespace-nowrap"
                        >
                          {generating ? (
                            <>
                              <LoadingSpinner size="sm"/>
                              Generating...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Generate with AI
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Difficulty and context */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Difficulty Level *
                      </label>
                      <select
                        value={newSentence.difficulty_level}
                        onChange={(e) => setNewSentence(prev => ({ ...prev, difficulty_level: parseInt(e.target.value) }))}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          errors.difficulty_level ? 'border-red-300' : 'border-gray-300'
                        }`}
                      >
                        {[1, 2, 3, 4, 5].map(level => (
                          <option key={level} value={level}>Level {level}</option>
                        ))}
                      </select>
                      {errors.difficulty_level && (
                        <p className="text-red-500 text-sm mt-1">{errors.difficulty_level}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Usage Context
                      </label>
                      <input
                        type="text"
                        value={newSentence.usage_context}
                        onChange={(e) => setNewSentence(prev => ({ ...prev, usage_context: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., daily conversation, formal"
                      />
                    </div>
                  </div>

                  {/* Translations */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Translations
                    </label>
                    <div className="space-y-3">
                      {languages.map((language) => {
                        const translationKey = `new_${language.language_code}`;
                        const isTranslating = translating[translationKey];
                        
                        return (
                          <div key={language.id} className="flex gap-2">
                            <div className="flex-1">
                              <div className="flex items-center mb-1">
                                <Badge className="bg-gray-100 text-gray-800 text-xs">
                                  {language.language_name}
                                </Badge>
                              </div>
                              <textarea
                                value={newSentence.translations[language.language_code] || ''}
                                onChange={(e) => setNewSentence(prev => ({
                                  ...prev,
                                  translations: {
                                    ...prev.translations,
                                    [language.language_code]: e.target.value
                                  }
                                }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                rows={2}
                                placeholder={`Enter ${language.language_name} translation`}
                              />
                            </div>
                            <div className="flex flex-col justify-end">
                              <button
                                onClick={() => translateSentenceWithGPT(language.language_code, language.language_name)}
                                disabled={isTranslating || !newSentence.kazakh_sentence}
                                className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm whitespace-nowrap"
                              >
                                {isTranslating ? (
                                  <>
                                    <LoadingSpinner size="sm"/>
                                    Translating...
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                                    </svg>
                                    Translate
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      onClick={() => setIsAddingNew(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveSentence}
                      disabled={saving}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {saving ? (
                        <>
                          <LoadingSpinner size="sm"/>
                          Saving...
                        </>
                      ) : (
                        'Save Sentence'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default ExampleSentencesModal;