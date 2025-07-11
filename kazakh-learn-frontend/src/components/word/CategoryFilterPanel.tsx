// src/components/word/CategoryFilterPanel.tsx
import React from 'react';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon
} from '@heroicons/react/24/outline';

import { useTranslation } from '../../hooks/useTranslation';
import { ViewModeControls } from './WordDisplayComponents';

// =============================================
// INTERFACES
// =============================================

interface CategoryFilters {
  difficulty_level_id?: number;
  word_type_id?: number;
}

interface CategoryFilterPanelProps {
  // Search
  searchTerm: string;
  onSearchChange: (value: string) => void;
  
  // Filters (simpler than WordsFilterPanel)
  filters: CategoryFilters;
  onFilterChange: (key: keyof CategoryFilters, value: any) => void;
  onClearFilters: () => void;
  
  // View Controls
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  showTranslation?: boolean;
  onShowTranslationChange?: (show: boolean) => void;
  
  // UI State
  showFilters: boolean;
  onToggleFilters: () => void;
  
  // Category specific
  categoryName?: string;
}

// =============================================
// CATEGORY FILTER PANEL COMPONENT
// =============================================

export const CategoryFilterPanel: React.FC<CategoryFilterPanelProps> = ({
  searchTerm,
  onSearchChange,
  filters,
  onFilterChange,
  onClearFilters,
  viewMode,
  onViewModeChange,
  showTranslation,
  onShowTranslationChange,
  showFilters,
  onToggleFilters,
  categoryName
}) => {
  const { t } = useTranslation('categoryDetail');

  // Check if any filters are active
  const hasActiveFilters = !!(
    searchTerm || 
    filters.difficulty_level_id || 
    filters.word_type_id
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center space-y-4 lg:space-y-0 lg:space-x-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder={t('search.placeholder')}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
          {/* Search indicator */}
          {searchTerm && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-blue-600 font-medium">
                  {searchTerm.length > 2 ? t('search.searching') : t('search.typeMore')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* View Mode Controls */}
        <ViewModeControls
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          showTranslation={showTranslation}
          onShowTranslationChange={onShowTranslationChange}
        />

        {/* Filter Toggle Button */}
        <button
          onClick={onToggleFilters}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md border transition-all duration-200 ${
            showFilters 
              ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
          }`}
        >
          <FunnelIcon className="h-5 w-5" />
          <span>{t('filters.title')}</span>
          {hasActiveFilters && (
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          )}
        </button>
      </div>

      {/* Expanded Filters Panel */}
      {showFilters && (
        <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
          {/* Filter Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Difficulty Level Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('filters.difficultyLevel')}
              </label>
              <select
                value={filters.difficulty_level_id || ''}
                onChange={(e) => onFilterChange('difficulty_level_id', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">{t('filters.allLevels')}</option>
                <option value="1">{t('filters.levels.beginner')}</option>
                <option value="2">{t('filters.levels.elementary')}</option>
                <option value="3">{t('filters.levels.intermediate')}</option>
                <option value="4">{t('filters.levels.advanced')}</option>
                <option value="5">{t('filters.levels.expert')}</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            <div className="flex items-end">
              <button
                onClick={onClearFilters}
                disabled={!hasActiveFilters}
                className="w-full px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('filters.clear')}
              </button>
            </div>
          </div>
          
          {/* Category Context Information */}
          {categoryName && (
            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <FunnelIcon className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-blue-900 mb-1">
                    {t('filters.categoryContextTitle')}
                  </h4>
                  <p className="text-sm text-blue-700">
                    {t('filters.categoryContext', { categoryName })}
                  </p>
                  {hasActiveFilters && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {searchTerm && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {t('filters.activeSearch')}: "{searchTerm}"
                        </span>
                      )}
                      {filters.difficulty_level_id && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {t('filters.activeDifficulty')}: {t(`filters.levels.level${filters.difficulty_level_id}`)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quick Filter Suggestions */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-600 font-medium">{t('filters.quickFilters')}:</span>
            
            <button
              onClick={() => onFilterChange('difficulty_level_id', 1)}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
            >
              {t('filters.levels.beginner')}
            </button>
            
            <button
              onClick={() => onFilterChange('difficulty_level_id', 3)}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors"
            >
              {t('filters.levels.intermediate')}
            </button>
            
            <button
              onClick={() => onFilterChange('difficulty_level_id', 5)}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200 transition-colors"
            >
              {t('filters.levels.expert')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryFilterPanel;