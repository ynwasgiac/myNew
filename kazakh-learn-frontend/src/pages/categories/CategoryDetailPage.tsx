// src/pages/categories/CategoryDetailPage.tsx - Updated to use shared useLearningMutations
import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeftIcon,
  BookOpenIcon,
  AcademicCapIcon,
  HeartIcon,
  PlayIcon,
  SparklesIcon,
  PlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';

import { categoriesAPI, wordsAPI } from '../../services/api';
import { learningAPI } from '../../services/learningAPI';
import { useLearningMutations } from '../../hooks/useLearningMutations';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import type { Category, KazakhWordSummary } from '../../types/api';

import LoadingSpinner from '../../components/ui/LoadingSpinner';
import CategoryFilterPanel from '../../components/word/CategoryFilterPanel';
import { WordDisplay } from '../../components/word/WordDisplayComponents';

// =============================================
// TYPES & INTERFACES
// =============================================

interface CategoryFilters {
  difficulty_level_id?: number;
  word_type_id?: number;
}

// =============================================
// CATEGORY DETAIL PAGE COMPONENT
// =============================================

const CategoryDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation('categoryDetail');
  const categoryId = parseInt(id || '0');

  // =============================================
  // STATE MANAGEMENT
  // =============================================

  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedWords, setSelectedWords] = useState<number[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);
  const [filters, setFilters] = useState<CategoryFilters>({
    difficulty_level_id: undefined,
    word_type_id: undefined,
  });

  // =============================================
  // SHARED LEARNING MUTATIONS
  // =============================================

  const { addToLearningMutation, removeFromLearningMutation } = useLearningMutations({
    onAddSuccess: (data, variables) => {
      const count = variables.wordIds.length;
      toast.success(
        count === 1 
          ? t('messages.addedToLearning')
          : t('messages.addedMultipleToLearning', { count })
      );
      setSelectedWords([]);
    },
    onRemoveSuccess: (data, variables) => {
      const count = variables.length;
      toast.success(
        count === 1
          ? t('messages.removedFromLearning')
          : t('messages.removedMultipleFromLearning', { count })
      );
      setSelectedWords([]);
    },
    onAddError: (error) => {
      console.error('Add to learning error:', error);
      toast.error(t('messages.addToLearningError'));
    },
    onRemoveError: (error) => {
      console.error('Remove from learning error:', error);
      toast.error(t('messages.removeFromLearningError'));
    },
  });

  // =============================================
  // DATA FETCHING
  // =============================================

  // Fetch category details
  const { 
    data: category, 
    isLoading: categoryLoading, 
    error: categoryError 
  } = useQuery({
    queryKey: ['category', categoryId, user?.main_language?.language_code],
    queryFn: () => categoriesAPI.getCategory(categoryId, user?.main_language?.language_code),
    enabled: !!categoryId,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch words in this category
  const { 
    data: rawWords, 
    isLoading: wordsLoading,
    error: wordsError
  } = useQuery({
    queryKey: ['category-words', categoryId, user?.main_language?.language_code],
    queryFn: () => wordsAPI.getWordsByCategory(
      categoryId, 
      user?.main_language?.language_code,
      0,
      200
    ),
    enabled: !!categoryId,
    retry: 2,
    staleTime: 2 * 60 * 1000,
  });

  // Search words if search term is provided
  const { 
    data: searchResults, 
    isLoading: searchLoading 
  } = useQuery({
    queryKey: ['word-search', searchTerm, user?.main_language?.language_code],
    queryFn: () => wordsAPI.searchWords(
      searchTerm, 
      user?.main_language?.language_code, 
      100
    ),
    enabled: searchTerm.length > 2,
    staleTime: 30 * 1000,
  });

  // Fetch user's learning progress
  const { data: learningProgress } = useQuery({
    queryKey: ['learning-progress'],
    queryFn: () => learningAPI.getProgress(),
    staleTime: 1 * 60 * 1000,
  });

  // =============================================
  // EVENT HANDLERS
  // =============================================

  const handleWordSelection = (wordId: number) => {
    setSelectedWords(prev => 
      prev.includes(wordId) 
        ? prev.filter(id => id !== wordId)
        : [...prev, wordId]
    );
  };

  const handleAddToLearning = (wordId: number) => {
    addToLearningMutation.mutate({ wordIds: [wordId], status: 'want_to_learn' });
  };

  const handleRemoveFromLearning = (wordId: number) => {
    removeFromLearningMutation.mutate([wordId]);
  };

  const handleBulkAddToLearning = () => {
    if (selectedWords.length > 0) {
      addToLearningMutation.mutate({ wordIds: selectedWords, status: 'want_to_learn' });
    }
  };

  const handleBulkRemoveFromLearning = () => {
    if (selectedWords.length > 0) {
      removeFromLearningMutation.mutate(selectedWords);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (selectedWords.length > 0) {
      setSelectedWords([]);
    }
  };

  // =============================================
  // UTILITY FUNCTIONS
  // =============================================

  const getCategoryIcon = (categoryName?: string): string => {
    if (!categoryName) return '📚';
    
    const iconMap: Record<string, string> = {
      'food': '🍎',
      'animals': '🐾',
      'family': '👨‍👩‍👧‍👦',
      'colors': '🎨',
      'numbers': '🔢',
      'body': '👤',
      'nature': '🌱',
      'transport': '🚗',
      'clothing': '👕',
      'house': '🏠',
      'time': '⏰',
      'weather': '🌤️',
      'tools': '🔧',
      'sports': '⚽',
      'school': '🎓',
      'technology': '💻',
    };
    
    const key = categoryName.toLowerCase();
    return iconMap[key] || '📚';
  };

  const getCategoryGradient = (categoryName?: string): string => {
    if (!categoryName) return 'from-blue-50 to-purple-50';
    
    const gradientMap: Record<string, string> = {
      'food': 'from-orange-50 to-red-50',
      'animals': 'from-green-50 to-blue-50',
      'family': 'from-pink-50 to-purple-50',
      'colors': 'from-rainbow-50 to-purple-50',
      'numbers': 'from-blue-50 to-indigo-50',
      'body': 'from-rose-50 to-pink-50',
      'nature': 'from-green-50 to-emerald-50',
      'transport': 'from-gray-50 to-blue-50',
      'clothing': 'from-purple-50 to-pink-50',
      'house': 'from-yellow-50 to-orange-50',
    };
    
    const key = categoryName.toLowerCase();
    return gradientMap[key] || 'from-blue-50 to-purple-50';
  };

  // Create learning word IDs set from progress data
  const learningWordIds = new Set<number>();
  if (learningProgress) {
    learningProgress.forEach(progress => {
      learningWordIds.add(progress.kazakh_word_id);
    });
  }

  // Determine which words to display
  const displayWords = searchTerm.length > 2 ? (searchResults || []) : (rawWords || []);
  
  // Apply filters (fix property name: difficulty_level not difficulty_level_id)
  const filteredWords = displayWords.filter(word => {
    if (filters.difficulty_level_id && word.difficulty_level !== filters.difficulty_level_id) {
      return false;
    }
    return true;
  });

  // =============================================
  // RENDER HELPERS
  // =============================================

  const renderCategoryStats = () => {
    const totalWords = filteredWords.length;
    const wordsInLearning = filteredWords.filter(word => learningWordIds.has(word.id)).length;
    const completionRate = totalWords > 0 ? Math.round((wordsInLearning / totalWords) * 100) : 0;

    return (
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-blue-600">{totalWords}</div>
          <div className="text-sm text-gray-500">{t('stats.totalWords')}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-green-600">{wordsInLearning}</div>
          <div className="text-sm text-gray-500">{t('stats.learning')}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-purple-600">{completionRate}%</div>
          <div className="text-sm text-gray-500">{t('stats.completion')}</div>
        </div>
      </div>
    );
  };

  // Custom Bulk Actions Bar Component
  const renderBulkActionsBar = () => {
    if (selectedWords.length === 0) return null;

    return (
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-blue-700 font-medium">
            {selectedWords.length} word{selectedWords.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleBulkAddToLearning}
              disabled={addToLearningMutation.isPending}
              className="btn-primary flex items-center space-x-2 text-sm"
            >
              <PlusIcon className="h-4 w-4" />
              <span>
                {addToLearningMutation.isPending ? 'Adding...' : 'Add to Learning'}
              </span>
            </button>
            <button
              onClick={() => setSelectedWords([])}
              className="btn-secondary flex items-center space-x-2 text-sm"
            >
              <XMarkIcon className="h-4 w-4" />
              <span>Clear Selection</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // =============================================
  // LOADING & ERROR STATES
  // =============================================

  if (categoryLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (categoryError || !category) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('errors.categoryNotFound')}</h1>
          <Link to="/categories" className="btn-primary">
            {t('actions.backToCategories')}
          </Link>
        </div>
      </div>
    );
  }

  // =============================================
  // MAIN RENDER
  // =============================================

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header with Back Button */}
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-1" />
          {t('actions.back')}
        </button>
      </div>

      {/* Category Header */}
      <div className={`bg-gradient-to-r ${getCategoryGradient(category.category_name)} p-6 rounded-xl mb-6`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-4xl mr-4">{getCategoryIcon(category.category_name)}</span>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {category.translations?.[0]?.translated_name || category.category_name}
              </h1>
              {category.translations?.[0]?.translated_description && (
                <p className="text-gray-700">
                  {category.translations[0].translated_description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {renderCategoryStats()}

      {/* Custom Bulk Actions Bar */}
      {renderBulkActionsBar()}

      {/* Filters and Search */}
      <CategoryFilterPanel
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        filters={filters}
        onFilterChange={(key, value) => setFilters(prev => ({ ...prev, [key]: value }))}
        onClearFilters={() => {
          setFilters({ difficulty_level_id: undefined, word_type_id: undefined });
          setSearchTerm('');
          setSelectedWords([]);
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showTranslation={showTranslation}
        onShowTranslationChange={setShowTranslation}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(prev => !prev)}
        categoryName={category.category_name}
      />

      {/* Words Display */}
      <WordDisplay
        words={filteredWords}
        learningWordIds={learningWordIds}
        selectedWords={selectedWords}
        viewMode={viewMode}
        showTranslation={showTranslation}
        onWordSelection={handleWordSelection}
        onAddToLearning={handleAddToLearning}
        onRemoveFromLearning={handleRemoveFromLearning}
        onBulkAddToLearning={handleBulkAddToLearning}
        onViewModeChange={setViewMode}
        onShowTranslationChange={setShowTranslation}
        isLoading={wordsLoading || searchLoading}
        emptyStateConfig={{
          title: searchTerm ? t('emptyState.noSearchResults') : t('emptyState.noWords'),
          message: searchTerm ? t('emptyState.tryDifferentSearch') : t('emptyState.categoryEmpty'),
          showClearAction: !!searchTerm,
          onClear: () => setSearchTerm('')
        }}
        navigationContext={{
          words: filteredWords,
          source: 'category',
          categoryId: categoryId,
          searchTerm: searchTerm
        }}
      />
    </div>
  );
};

export default CategoryDetailPage;