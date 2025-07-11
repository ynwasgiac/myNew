// src/components/admin/CategoryEditModal.tsx
import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, GlobeAltIcon, CheckIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';

import { useTranslation } from 'react-i18next';
import type { Category, Language } from '../../types/api';
import type { CategoryFormData, TranslationFormData, FormValidationState } from '../../types/admin';

import Button from '../ui/Button';
import Modal from '../ui/Modal';
import TranslationForm from './TranslationForm';

interface CategoryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: Category | null;
  languages: Language[];
  onSave: (categoryData: CategoryFormData) => Promise<void>;
  loading?: boolean;
}

const CategoryEditModal: React.FC<CategoryEditModalProps> = ({
  isOpen,
  onClose,
  category,
  languages,
  onSave,
  loading = false,
}) => {
  const { t } = useTranslation('admin');
  const isEditing = Boolean(category);

  // Form state
  const [formData, setFormData] = useState<CategoryFormData>({
    category_name: '',
    description: '',
    is_active: true,
    translations: [],
  });

  const [validation, setValidation] = useState<FormValidationState>({
    isValid: false,
    errors: {},
    touched: {},
  });

  const [activeTab, setActiveTab] = useState<'basic' | 'translations'>('basic');

  // Initialize form data
  useEffect(() => {
    if (isOpen) {
      if (category) {
        // Editing existing category
        setFormData({
          category_name: category.category_name,
          description: category.description || '',
          is_active: category.is_active,
          translations: languages.map(lang => {
            const existingTranslation = category.translations?.find(
              t => t.language_code === lang.language_code
            );
            return {
              id: existingTranslation?.id,
              language_code: lang.language_code,
              translated_name: existingTranslation?.translated_name || '',
              translated_description: existingTranslation?.translated_description || '',
            };
          }),
        });
      } else {
        // Creating new category
        setFormData({
          category_name: '',
          description: '',
          is_active: true,
          translations: languages.map(lang => ({
            language_code: lang.language_code,
            translated_name: '',
            translated_description: '',
          })),
        });
      }
      
      setValidation({
        isValid: false,
        errors: {},
        touched: {},
      });
    }
  }, [isOpen, category, languages]);

  // Validation
  useEffect(() => {
    validateForm();
  }, [formData]);

  const validateForm = () => {
    const errors: Record<string, string> = {};

    // Category name validation
    if (!formData.category_name.trim()) {
      errors.category_name = t('validation.categoryNameRequired');
    } else if (formData.category_name.length < 2) {
      errors.category_name = t('validation.categoryNameTooShort');
    } else if (formData.category_name.length > 50) {
      errors.category_name = t('validation.categoryNameTooLong');
    }

    // Description validation
    if (formData.description && formData.description.length > 500) {
      errors.description = t('validation.descriptionTooLong');
    }

    // Translation validation
    const hasTranslationError = formData.translations.some(translation => {
      if (translation.translated_name && translation.translated_name.length > 100) {
        errors[`translation_${translation.language_code}_name`] = t('validation.translationNameTooLong');
        return true;
      }
      if (translation.translated_description && translation.translated_description.length > 500) {
        errors[`translation_${translation.language_code}_description`] = t('validation.translationDescriptionTooLong');
        return true;
      }
      return false;
    });

    // Check if at least one translation has a name
    const hasValidTranslation = formData.translations.some(t => t.translated_name.trim());
    if (!hasValidTranslation) {
      errors.translations = t('validation.atLeastOneTranslation');
    }

    setValidation({
      isValid: Object.keys(errors).length === 0,
      errors,
      touched: validation.touched,
    });
  };

  // Event handlers
  const handleFieldChange = (field: keyof CategoryFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValidation(prev => ({
      ...prev,
      touched: { ...prev.touched, [field]: true },
    }));
  };

  const handleTranslationsChange = (translations: TranslationFormData[]) => {
    handleFieldChange('translations', translations);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validation.isValid) {
      toast.error(t('validation.formHasErrors'));
      return;
    }

    try {
      await onSave(formData);
    } catch (error) {
      console.error('Save error:', error);
      toast.error(t('categories.saveError'));
    }
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const getLanguageName = (languageCode: string) => {
    const language = languages.find(l => l.language_code === languageCode);
    return language?.language_name || languageCode.toUpperCase();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <div className="px-6 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? t('categories.editTitle') : t('categories.createTitle')}
            </h2>
            <p className="text-sm text-gray-600">
              {isEditing 
                ? t('categories.editSubtitle', { name: category?.category_name })
                : t('categories.createSubtitle')
              }
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('basic')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'basic'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('tabs.basicInfo')}
            </button>
            <button
              onClick={() => setActiveTab('translations')}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'translations'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <GlobeAltIcon className="h-4 w-4" />
              <span>{t('tabs.translations')}</span>
              {formData.translations.filter(t => t.translated_name.trim()).length > 0 && (
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                  {formData.translations.filter(t => t.translated_name.trim()).length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              {/* Category Name */}
              <div>
                <label htmlFor="category_name" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('fields.categoryName')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="category_name"
                  value={formData.category_name}
                  onChange={(e) => handleFieldChange('category_name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                    validation.errors.category_name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder={t('placeholders.categoryName')}
                  disabled={loading}
                />
                {validation.errors.category_name && (
                  <p className="mt-1 text-sm text-red-600">{validation.errors.category_name}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('fields.description')}
                </label>
                <textarea
                  id="description"
                  rows={4}
                  value={formData.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                    validation.errors.description ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder={t('placeholders.description')}
                  disabled={loading}
                />
                {validation.errors.description && (
                  <p className="mt-1 text-sm text-red-600">{validation.errors.description}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {formData.description.length}/500 {t('fields.characters')}
                </p>
              </div>

              {/* Active Status */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => handleFieldChange('is_active', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={loading}
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                  {t('fields.isActive')}
                </label>
              </div>

              {!formData.is_active && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">
                        {t('warnings.inactiveCategory')}
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>{t('warnings.inactiveCategoryDetails')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Translations Tab */}
          {activeTab === 'translations' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {t('translations.title')}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {t('translations.subtitle')}
                </p>
                
                {validation.errors.translations && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
                    <p className="text-sm text-red-600">{validation.errors.translations}</p>
                  </div>
                )}

                <TranslationForm
                  languages={languages}
                  translations={formData.translations}
                  onChange={handleTranslationsChange}
                  errors={validation.errors}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              {validation.isValid && (
                <div className="flex items-center text-green-600">
                  <CheckIcon className="h-4 w-4 mr-1" />
                  <span className="text-sm">{t('validation.formValid')}</span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <Button
                type="button"
                onClick={handleClose}
                variant="secondary"
                disabled={loading}
              >
                {t('actions.cancel')}
              </Button>
              
              <Button
                type="submit"
                variant="primary"
                disabled={!validation.isValid || loading}
                loading={loading}
              >
                {isEditing ? t('actions.update') : t('actions.create')}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default CategoryEditModal;