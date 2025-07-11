// src/components/word/WordDisplayComponents.tsx
import React, { useState } from 'react';
import { 
  ViewColumnsIcon,
  ListBulletIcon,
  SpeakerWaveIcon,
  HeartIcon,
  EyeIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

import { useTranslation } from '../../hooks/useTranslation';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import type { KazakhWordSummary } from '../../types/api';

import WordCard from './WordCard';

// =============================================
// INTERFACES
// =============================================

export interface WordDisplayProps {
  words: KazakhWordSummary[];
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  selectedWords: number[];
  onWordSelection: (wordId: number) => void;
  learningWordIds: Set<number>;
  onAddToLearning: (wordId: number) => void;
  onRemoveFromLearning: (wordId: number) => void;
  onBulkAddToLearning?: () => void;
  showTranslation?: boolean;
  onShowTranslationChange?: (show: boolean) => void;
  isLoading?: boolean;
  emptyStateConfig?: {
    title: string;
    message: string;
    showClearAction?: boolean;
    onClear?: () => void;
  };
  // Navigation context for WordDetailPage
  navigationContext?: {
    words: KazakhWordSummary[];
    source: 'browse' | 'search' | 'category' | 'learning';
    searchTerm?: string;
    categoryId?: number;
    filters?: any;
  };
}

interface WordRowProps {
  word: KazakhWordSummary;
  isSelected: boolean;
  isInLearningList: boolean;
  showTranslation: boolean;
  onToggleSelection: (wordId: number) => void;
  onAddToLearning: (wordId: number) => void;
  onRemoveFromLearning: (wordId: number) => void;
  navigationContext?: WordDisplayProps['navigationContext'];
}

interface EnhancedWordCardProps {
  word: KazakhWordSummary;
  isInLearningList: boolean;
  isSelected: boolean;
  onToggleSelection: (wordId: number) => void;
  onAddToLearning: (wordId: number) => void;
  onRemoveFromLearning: (wordId: number) => void;
  navigationContext?: WordDisplayProps['navigationContext'];
}

// =============================================
// WORD ROW COMPONENT (Table View)
// =============================================

const WordRow: React.FC<WordRowProps> = ({
  word,
  isSelected,
  isInLearningList,
  showTranslation,
  onToggleSelection,
  onAddToLearning,
  onRemoveFromLearning,
  navigationContext
}) => {
  const { t } = useTranslation('words');
  const [isPlaying, setIsPlaying] = useState(false);
  
  const { hasAudio, playAudio } = useAudioPlayer({
    wordId: word.id,
    word: word
  });

  const handlePlayAudio = async () => {
    setIsPlaying(true);
    try {
      await playAudio('Audio played successfully', 'Audio not available');
    } finally {
      setTimeout(() => setIsPlaying(false), 1000);
    }
  };

  // Generate navigation URL with context
  const getWordDetailUrl = () => {
    const baseUrl = `/app/words/${word.id}`;
    
    if (!navigationContext) return baseUrl;
    
    const params = new URLSearchParams();
    
    if (navigationContext.source) {
      params.set('source', navigationContext.source);
    }
    
    if (navigationContext.searchTerm) {
      params.set('q', navigationContext.searchTerm);
    }
    
    if (navigationContext.categoryId) {
      params.set('category', navigationContext.categoryId.toString());
    }
    
    if (navigationContext.filters) {
      Object.entries(navigationContext.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, value.toString());
        }
      });
    }
    
    return `${baseUrl}?${params.toString()}`;
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelection(word.id)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center space-x-3">
          <div className="flex-1">
            <Link 
              to={getWordDetailUrl()}
              className="kazakh-text font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              {word.kazakh_word}
            </Link>
            {word.kazakh_cyrillic && (
              <div className="cyrillic-text text-sm text-gray-600">
                {word.kazakh_cyrillic}
              </div>
            )}
          </div>
          {hasAudio && (
            <button
              onClick={handlePlayAudio}
              className={`audio-button audio-button-table-inline ${
                isPlaying ? 'audio-button-playing' : ''
              }`}
              title={t('actions.playAudio')}
              disabled={isPlaying}
            >
              <SpeakerWaveIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </td>
      {showTranslation && (
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {word.primary_translation}
        </td>
      )}
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="badge badge-gray">
          {word.category_name}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="badge badge-blue">
          {word.word_type_name}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`badge difficulty-${word.difficulty_level}`}>
          {word.difficulty_level}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              if (isInLearningList) {
                onRemoveFromLearning(word.id);
              } else {
                onAddToLearning(word.id);
              }
            }}
            className={`p-2 rounded-full transition-all duration-200 ${
              isInLearningList
                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                : 'bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-500'
            }`}
            title={isInLearningList 
              ? t('actions.removeFromLearning') 
              : t('actions.addToLearning')
            }
          >
            <HeartIcon className={`h-5 w-5 ${isInLearningList ? 'fill-current' : ''}`} />
          </button>
          <Link
            to={getWordDetailUrl()}
            className="p-2 rounded-full text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-all duration-200"
            title={t('actions.view')}
          >
            <EyeIcon className="h-5 w-5" />
          </Link>
        </div>
      </td>
    </tr>
  );
};

// =============================================
// ENHANCED WORD CARD COMPONENT (Grid View)
// =============================================

const EnhancedWordCard: React.FC<EnhancedWordCardProps> = ({
  word,
  isInLearningList,
  isSelected,
  onToggleSelection,
  onAddToLearning,
  onRemoveFromLearning,
  navigationContext
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  
  const { hasAudio, playAudio } = useAudioPlayer({
    wordId: word.id,
    word: word
  });

  const handlePlayAudio = async () => {
    setIsPlaying(true);
    try {
      await playAudio('Audio played successfully', 'Audio not available');
    } finally {
      setTimeout(() => setIsPlaying(false), 1500);
    }
  };

  const handleToggleLearning = () => {
    if (isInLearningList) {
      onRemoveFromLearning(word.id);
    } else {
      onAddToLearning(word.id);
    }
  };

  // Generate navigation URL with context
  const getWordDetailUrl = () => {
    const baseUrl = `/app/words/${word.id}`;
    
    if (!navigationContext) return baseUrl;
    
    const params = new URLSearchParams();
    
    if (navigationContext.source) {
      params.set('source', navigationContext.source);
    }
    
    if (navigationContext.searchTerm) {
      params.set('q', navigationContext.searchTerm);
    }
    
    if (navigationContext.categoryId) {
      params.set('category', navigationContext.categoryId.toString());
    }
    
    if (navigationContext.filters) {
      Object.entries(navigationContext.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, value.toString());
        }
      });
    }
    
    return `${baseUrl}?${params.toString()}`;
  };

  return (
    <div className="relative word-card-with-audio">
      {/* Selection Checkbox */}
      <div className="absolute top-2 left-2 z-20">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelection(word.id)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded shadow-sm"
        />
      </div>

      {/* Clickable Word Card */}
      <Link to={getWordDetailUrl()} className="block">
        <WordCard
          word={word}
          isInLearningList={isInLearningList}
          onAddToLearning={onAddToLearning}
          onRemoveFromLearning={onRemoveFromLearning}
          showActions={false} // Hide bottom actions since we have overlay buttons
        />
      </Link>
      
      {/* Action buttons overlay */}
      <div className="absolute top-3 right-3 flex flex-col space-y-2 z-10">
        {/* Audio button */}
        {hasAudio && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handlePlayAudio();
            }}
            className={`audio-button audio-button-card-overlay ${
              isPlaying ? 'animate-pulse-soft bg-green-500' : ''
            }`}
            title="Play pronunciation"
            disabled={isPlaying}
          >
            <SpeakerWaveIcon className="h-5 w-5" />
          </button>
        )}
        
        {/* Heart/Learning button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleToggleLearning();
          }}
          className={`audio-button ${
            isInLearningList
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
              : 'bg-white/90 hover:bg-white text-red-500 hover:text-red-600 shadow-md border border-red-200 hover:border-red-300'
          }`}
          title={isInLearningList ? 'Remove from learning list' : 'Add to learning list'}
        >
          <HeartIcon className={`h-5 w-5 ${isInLearningList ? 'fill-current' : ''}`} />
        </button>
      </div>
    </div>
  );
};

// =============================================
// VIEW MODE CONTROLS
// =============================================

interface ViewModeControlsProps {
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  showTranslation?: boolean;
  onShowTranslationChange?: (show: boolean) => void;
}

export const ViewModeControls: React.FC<ViewModeControlsProps> = ({
  viewMode,
  onViewModeChange,
  showTranslation,
  onShowTranslationChange
}) => {
  const { t } = useTranslation('words');

  return (
    <div className="flex items-center space-x-2">
      {/* View Toggle */}
      <button
        onClick={() => onViewModeChange('grid')}
        className={`p-2 rounded-md ${
          viewMode === 'grid' 
            ? 'bg-blue-100 text-blue-600' 
            : 'text-gray-400 hover:text-gray-600'
        }`}
        title={t('view.grid')}
      >
        <ViewColumnsIcon className="h-5 w-5" />
      </button>
      <button
        onClick={() => onViewModeChange('list')}
        className={`p-2 rounded-md ${
          viewMode === 'list' 
            ? 'bg-blue-100 text-blue-600' 
            : 'text-gray-400 hover:text-gray-600'
        }`}
        title={t('view.list')}
      >
        <ListBulletIcon className="h-5 w-5" />
      </button>
      
      {/* Translation Toggle - only show in list view */}
      {viewMode === 'list' && onShowTranslationChange && (
        <>
          <div className="h-4 w-px bg-gray-300 mx-2" />
          <button
            onClick={() => onShowTranslationChange(!showTranslation)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              showTranslation
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={showTranslation ? t('filters.translation.hide') : t('filters.translation.show')}
          >
            {showTranslation ? t('filters.translation.hide') : t('filters.translation.show')}
          </button>
        </>
      )}
    </div>
  );
};

// =============================================
// BULK ACTIONS BAR
// =============================================

interface BulkActionsBarProps {
  selectedCount: number;
  onBulkAddToLearning: () => void;
  isAddingToLearning?: boolean;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  onBulkAddToLearning,
  isAddingToLearning = false
}) => {
  const { t } = useTranslation('words');

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center space-x-4">
      <span className="text-sm text-gray-600">
        {t('selection.selectedCount', { count: selectedCount })}
      </span>
      <button
        onClick={onBulkAddToLearning}
        disabled={isAddingToLearning}
        className="btn-primary flex items-center space-x-2"
      >
        <PlusIcon className="h-4 w-4" />
        <span>{t('actions.addToLearning')}</span>
      </button>
    </div>
  );
};

// =============================================
// MAIN WORD DISPLAY COMPONENT
// =============================================

export const WordDisplay: React.FC<WordDisplayProps> = ({
  words,
  viewMode,
  onViewModeChange,
  selectedWords,
  onWordSelection,
  learningWordIds,
  onAddToLearning,
  onRemoveFromLearning,
  onBulkAddToLearning,
  showTranslation = true,
  onShowTranslationChange,
  isLoading = false,
  emptyStateConfig,
  navigationContext
}) => {
  const { t } = useTranslation('words');

  // Handle select all functionality
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      words.forEach(word => {
        if (!selectedWords.includes(word.id)) {
          onWordSelection(word.id);
        }
      });
    } else {
      words.forEach(word => {
        if (selectedWords.includes(word.id)) {
          onWordSelection(word.id);
        }
      });
    }
  };

  const isAllSelected = words.length > 0 && words.every(word => selectedWords.includes(word.id));
  const isPartiallySelected = words.some(word => selectedWords.includes(word.id)) && !isAllSelected;

  // Empty State
  if (!isLoading && words.length === 0 && emptyStateConfig) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📚</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {emptyStateConfig.title}
        </h3>
        <p className="text-gray-600 mb-4">
          {emptyStateConfig.message}
        </p>
        {emptyStateConfig.showClearAction && emptyStateConfig.onClear && (
          <button
            onClick={emptyStateConfig.onClear}
            className="btn-primary"
          >
            {t('filters.clear')}
          </button>
        )}
      </div>
    );
  }

  // Grid View
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {words.map((word) => (
          <EnhancedWordCard
            key={word.id}
            word={word}
            isInLearningList={learningWordIds.has(word.id)}
            isSelected={selectedWords.includes(word.id)}
            onToggleSelection={onWordSelection}
            onAddToLearning={onAddToLearning}
            onRemoveFromLearning={onRemoveFromLearning}
            navigationContext={navigationContext}
          />
        ))}
      </div>
    );
  }

  // List View (Table)
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isPartiallySelected;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.headers.word')}
              </th>
              {showTranslation && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('table.headers.translation')}
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.headers.category')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.headers.type')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.headers.level')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.headers.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {words.map((word) => (
              <WordRow
                key={word.id}
                word={word}
                isSelected={selectedWords.includes(word.id)}
                isInLearningList={learningWordIds.has(word.id)}
                showTranslation={showTranslation}
                onToggleSelection={onWordSelection}
                onAddToLearning={onAddToLearning}
                onRemoveFromLearning={onRemoveFromLearning}
                navigationContext={navigationContext}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WordDisplay;