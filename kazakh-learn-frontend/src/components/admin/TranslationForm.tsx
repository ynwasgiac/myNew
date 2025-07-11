// src/components/admin/TranslationForm.tsx
import React, { useState } from 'react';
import { 
  GlobeAltIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';

import { useTranslation } from 'react-i18next';
import type { Language } from '../../types/api';

// Define translation form data interface
export interface TranslationFormData {
  id?: number;
  language_code: string;
  translated_name: string;
  translated_description: string;
}

interface TranslationFormProps {
  languages: Language[];
  translations: TranslationFormData[];
  onChange: (translations: TranslationFormData[]) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
  required?: boolean;
  showGuidelines?: boolean;
}

const TranslationForm: React.FC<TranslationFormProps> = ({
  languages,
  translations,
  onChange,
  errors = {},
  disabled = false,
  required = true,
  showGuidelines = true,
}) => {
  const { t } = useTranslation('admin');
  const [expandedLanguages, setExpandedLanguages] = useState<string[]>(['en']); // Start with English expanded

  // Update a specific translation field
  const updateTranslation = (
    languageCode: string, 
    field: keyof Omit<TranslationFormData, 'id' | 'language_code'>, 
    value: string
  ) => {
    const updatedTranslations = translations.map(translation => {
      if (translation.language_code === languageCode) {
        return { ...translation, [field]: value };
      }
      return translation;
    });
    onChange(updatedTranslations);
  };

  // Toggle expanded state for a language
  const toggleLanguageExpanded = (languageCode: string) => {
    setExpandedLanguages(prev => {
      if (prev.includes(languageCode)) {
        return prev.filter(code => code !== languageCode);
      } else {
        return [...prev, languageCode];
      }
    });
  };

  // Get language display information
  const getLanguageInfo = (language: Language) => {
    const flagEmojis: Record<string, string> = {
      'en': '🇺🇸',
      'kk': '🇰🇿',
      'ru': '🇷🇺',
    };
    
    const languageNames: Record<string, string> = {
      'en': 'English',
      'kk': 'Қазақша',
      'ru': 'Русский',
    };
    
    return {
      flag: flagEmojis[language.language_code] || '🌐',
      name: languageNames[language.language_code] || language.language_name,
      code: language.language_code.toUpperCase(),
      isRTL: false, // Add RTL support later if needed
    };
  };

  // Get completion status for a translation
  const getTranslationStatus = (translation: TranslationFormData) => {
    const hasName = translation.translated_name.trim().length > 0;
    const hasDescription = translation.translated_description.trim().length > 0;
    
    if (hasName && hasDescription) return 'complete';
    if (hasName) return 'partial';
    return 'empty';
  };

  // Get status display info
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'complete':
        return {
          icon: <CheckCircleIcon className="h-4 w-4 text-green-500" />,
          text: 'Complete',
          color: 'text-green-600',
          bgColor: 'bg-green-50 border-green-200'
        };
      case 'partial':
        return {
          icon: <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />,
          text: 'Partial',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50 border-yellow-200'
        };
      default:
        return {
          icon: <div className="h-4 w-4 rounded-full border-2 border-gray-300" />,
          text: 'Empty',
          color: 'text-gray-500',
          bgColor: 'bg-gray-50 border-gray-200'
        };
    }
  };

  // Copy English text to other languages
  const copyEnglishToAll = () => {
    const englishTranslation = translations.find(t => t.language_code === 'en');
    if (!englishTranslation || !englishTranslation.translated_name) return;

    const updatedTranslations = translations.map(translation => {
      if (translation.language_code !== 'en' && !translation.translated_name) {
        return {
          ...translation,
          translated_name: englishTranslation.translated_name,
          translated_description: englishTranslation.translated_description
        };
      }
      return translation;
    });
    onChange(updatedTranslations);
  };

  // Clear all translations
  const clearAllTranslations = () => {
    const clearedTranslations = translations.map(translation => ({
      ...translation,
      translated_name: '',
      translated_description: ''
    }));
    onChange(clearedTranslations);
  };

  // Get completion stats
  const completionStats = {
    total: languages.length,
    complete: translations.filter(t => getTranslationStatus(t) === 'complete').length,
    partial: translations.filter(t => getTranslationStatus(t) === 'partial').length,
    empty: translations.filter(t => getTranslationStatus(t) === 'empty').length,
  };

  return (
    <div className="space-y-6">
      {/* Header with Overview */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <GlobeAltIcon className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-medium text-gray-900">
              Translation Management
            </h3>
          </div>
          <div className="text-sm text-gray-600">
            {completionStats.complete}/{completionStats.total} Complete
          </div>
        </div>
        
        {/* Progress Overview */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {languages.map(language => {
            const translation = translations.find(t => t.language_code === language.language_code);
            const status = translation ? getTranslationStatus(translation) : 'empty';
            const statusInfo = getStatusInfo(status);
            const langInfo = getLanguageInfo(language);
            
            return (
              <button
                key={language.language_code}
                onClick={() => toggleLanguageExpanded(language.language_code)}
                className={`flex items-center space-x-3 p-3 rounded-md border-2 transition-all hover:shadow-sm ${
                  statusInfo.bgColor
                } ${expandedLanguages.includes(language.language_code) ? 'ring-2 ring-blue-500' : ''}`}
              >
                <span className="text-2xl">{langInfo.flag}</span>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {langInfo.name}
                  </p>
                  <div className="flex items-center space-x-1">
                    {statusInfo.icon}
                    <span className={`text-xs ${statusInfo.color}`}>
                      {statusInfo.text}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyEnglishToAll}
            disabled={disabled || !translations.find(t => t.language_code === 'en')?.translated_name}
            className="inline-flex items-center px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ClipboardDocumentIcon className="h-3 w-3 mr-1" />
            Copy English to Empty
          </button>
          
          <button
            type="button"
            onClick={clearAllTranslations}
            disabled={disabled}
            className="inline-flex items-center px-3 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear All
          </button>

          <button
            type="button"
            onClick={() => setExpandedLanguages(languages.map(l => l.language_code))}
            className="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100"
          >
            Expand All
          </button>

          <button
            type="button"
            onClick={() => setExpandedLanguages([])}
            className="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Translation Forms */}
      <div className="space-y-4">
        {languages.map(language => {
          const translation = translations.find(t => t.language_code === language.language_code);
          const langInfo = getLanguageInfo(language);
          const status = translation ? getTranslationStatus(translation) : 'empty';
          const statusInfo = getStatusInfo(status);
          const isExpanded = expandedLanguages.includes(language.language_code);
          
          if (!translation) return null;

          return (
            <div
              key={language.language_code}
              className={`border rounded-lg transition-all duration-200 ${
                isExpanded ? 'border-blue-300 shadow-md' : 'border-gray-200'
              }`}
            >
              {/* Language Header */}
              <div
                className={`flex items-center justify-between p-4 cursor-pointer ${
                  isExpanded ? 'bg-blue-50' : 'bg-gray-50 hover:bg-gray-100'
                }`}
                onClick={() => toggleLanguageExpanded(language.language_code)}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{langInfo.flag}</span>
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">
                      {langInfo.name}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Language Code: {langInfo.code}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1">
                    {statusInfo.icon}
                    <span className={`text-sm font-medium ${statusInfo.color}`}>
                      {statusInfo.text}
                    </span>
                  </div>
                  <div className={`transform transition-transform duration-200 ${
                    isExpanded ? 'rotate-180' : ''
                  }`}>
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Translation Fields - Collapsible */}
              {isExpanded && (
                <div className="p-6 space-y-4 border-t border-gray-200 bg-white">
                  {/* Translated Name */}
                  <div>
                    <label 
                      htmlFor={`translation_${language.language_code}_name`}
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Translated Name
                      {required && language.language_code === 'en' && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </label>
                    <input
                      type="text"
                      id={`translation_${language.language_code}_name`}
                      value={translation.translated_name}
                      onChange={(e) => updateTranslation(language.language_code, 'translated_name', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                        errors[`translation_${language.language_code}_name`] 
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                          : 'border-gray-300'
                      }`}
                      placeholder={`Enter category name in ${langInfo.name}...`}
                      disabled={disabled}
                      dir={langInfo.isRTL ? 'rtl' : 'ltr'}
                    />
                    {errors[`translation_${language.language_code}_name`] && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors[`translation_${language.language_code}_name`]}
                      </p>
                    )}
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        {translation.translated_name.length}/100 characters
                      </p>
                      {translation.translated_name.length > 80 && (
                        <p className="text-xs text-yellow-600">
                          Consider shortening for better display
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Translated Description */}
                  <div>
                    <label 
                      htmlFor={`translation_${language.language_code}_description`}
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Translated Description
                    </label>
                    <textarea
                      id={`translation_${language.language_code}_description`}
                      rows={3}
                      value={translation.translated_description}
                      onChange={(e) => updateTranslation(language.language_code, 'translated_description', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-vertical ${
                        errors[`translation_${language.language_code}_description`] 
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                          : 'border-gray-300'
                      }`}
                      placeholder={`Enter category description in ${langInfo.name}...`}
                      disabled={disabled}
                      dir={langInfo.isRTL ? 'rtl' : 'ltr'}
                    />
                    {errors[`translation_${language.language_code}_description`] && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors[`translation_${language.language_code}_description`]}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {translation.translated_description.length}/500 characters
                    </p>
                  </div>

                  {/* Language-specific Tips */}
                  {language.language_code === 'kk' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                      <h5 className="text-sm font-medium text-blue-800 mb-2 flex items-center">
                        <InformationCircleIcon className="h-4 w-4 mr-1" />
                        Kazakh Translation Tips
                      </h5>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• Use proper Kazakh grammar and word order</li>
                        <li>• Consider cultural context and local usage</li>
                        <li>• Use Cyrillic script consistently</li>
                        <li>• Avoid direct word-for-word translations</li>
                      </ul>
                    </div>
                  )}

                  {language.language_code === 'ru' && (
                    <div className="bg-purple-50 border border-purple-200 rounded-md p-3">
                      <h5 className="text-sm font-medium text-purple-800 mb-2 flex items-center">
                        <InformationCircleIcon className="h-4 w-4 mr-1" />
                        Russian Translation Tips
                      </h5>
                      <ul className="text-sm text-purple-700 space-y-1">
                        <li>• Maintain formal register for educational content</li>
                        <li>• Use standard Russian without regional dialects</li>
                        <li>• Consider the learning context of the audience</li>
                      </ul>
                    </div>
                  )}

                  {language.language_code === 'en' && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-3">
                      <h5 className="text-sm font-medium text-green-800 mb-2 flex items-center">
                        <InformationCircleIcon className="h-4 w-4 mr-1" />
                        English Translation Tips
                      </h5>
                      <ul className="text-sm text-green-700 space-y-1">
                        <li>• Use clear, simple language for learners</li>
                        <li>• Keep names concise and descriptive</li>
                        <li>• Avoid complex terminology when possible</li>
                        <li>• This will be used as the base for other translations</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Translation Guidelines */}
      {showGuidelines && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-amber-800 mb-3 flex items-center">
            <InformationCircleIcon className="h-4 w-4 mr-2" />
            Translation Guidelines
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h5 className="text-xs font-semibold text-amber-800 mb-2">✅ DO</h5>
              <ul className="text-xs text-amber-700 space-y-1">
                <li>• Keep translations concise and clear</li>
                <li>• Maintain consistency across categories</li>
                <li>• Consider the target audience (language learners)</li>
                <li>• Use culturally appropriate terms</li>
              </ul>
            </div>
            <div>
              <h5 className="text-xs font-semibold text-amber-800 mb-2">❌ AVOID</h5>
              <ul className="text-xs text-amber-700 space-y-1">
                <li>• Direct word-for-word translations</li>
                <li>• Technical jargon or complex terms</li>
                <li>• Regional dialects or slang</li>
                <li>• Overly long descriptions</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Validation Summary */}
      {Object.keys(errors).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-red-800 mb-2">
            Translation Errors
          </h4>
          <ul className="text-sm text-red-700 space-y-1">
            {Object.entries(errors).map(([key, message]) => (
              <li key={key}>• {message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TranslationForm;