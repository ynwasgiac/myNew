// src/components/word/WordsFilterPanel.tsx
import React from 'react';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon
} from '@heroicons/react/24/outline';

import { useTranslation } from '../../hooks/useTranslation';
import type { WordFilters, Category, WordType, DifficultyLevel } from '../../types/api';
import { ViewModeControls } from './WordDisplayComponents';

// =============================================
// INTERFACES
// =============================================

interface WordsFilterPanelProps {
  // Search
  searchTerm: string;
  onSearchChange: (value: string) => void;
  
  // Filters
  filters: WordFilters;
  onFilterChange: (key: keyof WordFilters, value: any) => void;
  onClearFilters: () => void;
  
  // Filter Data
  categories?: Category[];
  wordTypes?: WordType[];
  difficultyLevels?: DifficultyLevel[];
  
  // View Controls
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  showTranslation?: boolean;
  onShowTranslationChange?: (show: boolean) => void;
  
  // UI State
  showFilters: boolean;
  onToggleFilters: () => void;
}

// =============================================
// WORDS FILTER PANEL COMPONENT
// =============================================

export const WordsFilterPanel: React.FC<WordsFilterPanelProps> = ({
  searchTerm,
  onSearchChange,
  filters,
  onFilterChange,
  onClearFilters,
  categories,
  wordTypes,
  difficultyLevels,
  viewMode,
  onViewModeChange,
  showTranslation,
  onShowTranslationChange,
  showFilters,
  onToggleFilters
}) => {
  const { t } = useTranslation('words');

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex flex-col lg:flex-row lg:items-center space-y-4 lg:space-y-0 lg:space-x-4">
        {/* Search */}
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder={t('search.placeholder')}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* View Mode Controls */}
        <ViewModeControls
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          showTranslation={showTranslation}
          onShowTranslationChange={onShowTranslationChange}
        />

        {/* Filter Toggle */}
        <button
          onClick={onToggleFilters}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md border ${
            showFilters 
              ? 'bg-blue-50 border-blue-200 text-blue-700' 
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <FunnelIcon className="h-5 w-5" />
          <span>{t('filters.title')}</span>
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('filters.category.label')}
              </label>
              <select
                value={filters.category_id || ''}
                onChange={(e) => onFilterChange('category_id', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">{t('filters.category.all')}</option>
                {categories?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.translations?.[0]?.translated_name || category.category_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Word Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('filters.wordType.label')}
              </label>
              <select
                value={filters.word_type_id || ''}
                onChange={(e) => onFilterChange('word_type_id', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">{t('filters.wordType.all')}</option>
                {wordTypes?.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.translations?.[0]?.translated_name || type.type_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('filters.difficulty.label')}
              </label>
              <select
                value={filters.difficulty_level_id || ''}
                onChange={(e) => onFilterChange('difficulty_level_id', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">{t('filters.difficulty.all')}</option>
                {difficultyLevels?.map((level) => (
                  <option key={level.id} value={level.id}>
                    {t('filters.difficulty.level', { 
                      level: level.level_number, 
                      name: level.translations?.[0]?.translated_name || level.level_name 
                    })}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <button
                onClick={onClearFilters}
                className="w-full px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                {t('filters.clear')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WordsFilterPanel;