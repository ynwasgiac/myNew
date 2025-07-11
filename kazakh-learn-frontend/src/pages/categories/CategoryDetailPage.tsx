// src/pages/categories/CategoryDetailPage.tsx - Written from scratch using reusable components
import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeftIcon,
  BookOpenIcon,
  AcademicCapIcon,
  HeartIcon,
  PlayIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';

import { categoriesAPI, wordsAPI, learningAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import type { Category, KazakhWordSummary } from '../../types/api';

import LoadingSpinner from '../../components/ui/LoadingSpinner';
import CategoryFilterPanel from '../../components/word/CategoryFilterPanel';
import { WordDisplay, BulkActionsBar } from '../../components/word/WordDisplayComponents';

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
  const queryClient = useQueryClient();
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
    staleTime: 5 * 60 * 1000, // 5 minutes
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
      200 // Get more words for better filtering
    ),
    enabled: !!categoryId,
    retry: 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
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
    staleTime: 30 * 1000, // 30 seconds for search results
  });

  // Fetch user's learning progress
  const { data: learningProgress } = useQuery({
    queryKey: ['learning-progress'],
    queryFn: () => learningAPI.getProgress(),
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  // =============================================
  // MUTATIONS
  // =============================================

  const addToLearningMutation = useMutation({
    mutationFn: (wordIds: number[]) => learningAPI.addWordToLearning(wordIds),
    onSuccess: (data, variables) => {
      const count = variables.length;
      toast.success(
        count === 1 
          ? t('messages.addedToLearning')
          : t('messages.addedMultipleToLearning', { count })
      );
      queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
      setSelectedWords([]);
    },
    onError: (error) => {
      console.error('Add to learning error:', error);
      toast.error(t('messages.addToLearningError'));
    },
  });

  const removeFromLearningMutation = useMutation({
    mutationFn: (wordIds: number[]) => learningAPI.removeWordFromLearning(wordIds),
    onSuccess: (data, variables) => {
      const count = variables.length;
      toast.success(
        count === 1
          ? t('messages.removedFromLearning')
          : t('messages.removedMultipleFromLearning', { count })
      );
      queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
    },
    onError: (error) => {
      console.error('Remove from learning error:', error);
      toast.error(t('messages.removeFromLearningError'));
    },
  });

  // =============================================
  // COMPUTED VALUES
  // =============================================

  // Get learning word IDs for heart status
  const learningWordIds = new Set(
    learningProgress?.map(progress => progress.kazakh_word_id) || []
  );

  // Determine which words to display and apply filters
  const getFilteredWords = (): KazakhWordSummary[] => {
    let wordsToFilter: KazakhWordSummary[];

    // Choose source: search results or category words
    if (searchTerm.length > 2) {
      // Filter search results to only include words from this category
      wordsToFilter = searchResults?.filter(word => 
        word.category_name?.toLowerCase().includes(
          category?.category_name?.toLowerCase() || ''
        )
      ) || [];
    } else {
      // Use category words directly
      wordsToFilter = rawWords || [];
    }

    // Apply additional filters
    return wordsToFilter.filter(word => {
      // Difficulty filter
      if (filters.difficulty_level_id && word.difficulty_level !== filters.difficulty_level_id) {
        return false;
      }

      // Word type filter (if implemented)
      if (filters.word_type_id) {
        // Add word type filtering logic here when available
      }

      return true;
    });
  };

  const filteredWords = getFilteredWords();
  const isLoading = categoryLoading || wordsLoading || (searchTerm.length > 2 && searchLoading);

  // =============================================
  // EVENT HANDLERS
  // =============================================

  const handleFilterChange = (key: keyof CategoryFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      difficulty_level_id: undefined,
      word_type_id: undefined,
    });
    setSearchTerm('');
  };

  const handleWordSelection = (wordId: number) => {
    setSelectedWords(prev => 
      prev.includes(wordId) 
        ? prev.filter(id => id !== wordId)
        : [...prev, wordId]
    );
  };

  const handleAddToLearning = (wordId: number) => {
    addToLearningMutation.mutate([wordId]);
  };

  const handleRemoveFromLearning = (wordId: number) => {
    removeFromLearningMutation.mutate([wordId]);
  };

  const handleBulkAddToLearning = () => {
    if (selectedWords.length > 0) {
      addToLearningMutation.mutate(selectedWords);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    // Clear selection when search changes
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

  // =============================================
  // RENDER HELPERS
  // =============================================

  const renderCategoryStats = () => {
    const totalWords = filteredWords.length;
    const wordsInLearning = filteredWords.filter(word => learningWordIds.has(word.id)).length;
    const completionRate = totalWords > 0 ? Math.round((wordsInLearning / totalWords) * 100) : 0;

    return (
      <div className="flex items-center space-x-6 text-sm text-gray-600">
        <div className="flex items-center space-x-2">
          <BookOpenIcon className="h-5 w-5" />
          <span>{t('stats.wordsCount', { count: totalWords })}</span>
        </div>
        <div className="flex items-center space-x-2">
          <HeartIcon className="h-5 w-5" />
          <span>{t('stats.inLearningList', { count: wordsInLearning })}</span>
        </div>
        <div className="flex items-center space-x-2">
          <SparklesIcon className="h-5 w-5" />
          <span>{t('stats.completion', { rate: completionRate })}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span>{t('stats.categoryId', { id: category?.id })}</span>
        </div>
      </div>
    );
  };

  const renderQuickActions = () => (
    <div className="mt-6 flex flex-wrap gap-3">
      <Link
        to={`/app/practice?category=${categoryId}`}
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 shadow-sm hover:shadow-md"
      >
        <PlayIcon className="h-4 w-4" />
        <span>{t('actions.practiceCategory')}</span>
      </Link>
      
      <Link
        to={`/app/quiz?category=${categoryId}`}
        className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 shadow-sm hover:shadow-md"
      >
        <AcademicCapIcon className="h-4 w-4" />
        <span>{t('actions.takeQuiz')}</span>
      </Link>

      {filteredWords.length > 0 && (
        <button
          onClick={() => {
            const wordsNotInLearning = filteredWords
              .filter(word => !learningWordIds.has(word.id))
              .map(word => word.id);
            if (wordsNotInLearning.length > 0) {
              addToLearningMutation.mutate(wordsNotInLearning);
            } else {
              toast.info(t('messages.allWordsAlreadyInLearning'));
            }
          }}
          disabled={addToLearningMutation.isPending}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 shadow-sm hover:shadow-md disabled:opacity-50"
        >
          <HeartIcon className="h-4 w-4" />
          <span>{t('actions.addAllToLearning')}</span>
        </button>
      )}
    </div>
  );

  // =============================================
  // ERROR & LOADING STATES
  // =============================================

  if (categoryLoading) {
    return <LoadingSpinner fullScreen text={t('loading.category')} />;
  }

  if (categoryError || !category) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">😕</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t('errors.categoryNotFound')}
        </h2>
        <p className="text-gray-600 mb-6">
          {t('errors.categoryNotFoundDescription')}
        </p>
        <button
          onClick={() => navigate('/app/categories')}
          className="btn-primary"
        >
          {t('actions.browseCategories')}
        </button>
      </div>
    );
  }

  if (wordsError) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t('errors.wordsLoadError')}
        </h2>
        <p className="text-gray-600 mb-6">
          {t('errors.wordsLoadErrorDescription')}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary"
        >
          {t('actions.retry')}
        </button>
      </div>
    );
  }

  // =============================================
  // MAIN RENDER
  // =============================================

  const categoryName = category.translations?.[0]?.translated_name || category.category_name;
  const categoryDescription = category.translations?.[0]?.translated_description || category.description;

  // Create navigation context for word detail navigation
  const navigationContext = {
    words: filteredWords,
    source: 'category' as const,
    categoryId: categoryId,
    searchTerm: searchTerm.length > 2 ? searchTerm : undefined,
    filters: filters
  };

  // Empty state configuration
  const emptyStateConfig = {
    title: searchTerm ? t('emptyState.noWordsFound') : t('emptyState.noWordsInCategory'),
    message: searchTerm 
      ? t('emptyState.searchMessage', { searchTerm })
      : t('emptyState.categoryMessage'),
    showClearAction: !!(searchTerm || filters.difficulty_level_id),
    onClear: handleClearFilters
  };

  return (
    <div className="space-y-6">
      {/* =============================================
          HEADER SECTION
          ============================================= */}
      <div className="flex items-center justify-between">
        {/* Back Navigation */}
        <button
          onClick={() => navigate('/app/categories')}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors group"
        >
          <ArrowLeftIcon className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
          <span>{t('navigation.backToCategories')}</span>
        </button>

        {/* Bulk Actions */}
        <BulkActionsBar
          selectedCount={selectedWords.length}
          onBulkAddToLearning={handleBulkAddToLearning}
          isAddingToLearning={addToLearningMutation.isPending}
        />
      </div>

      {/* =============================================
          CATEGORY HEADER
          ============================================= */}
      <div className={`bg-gradient-to-r ${getCategoryGradient(category.category_name)} rounded-xl p-8 shadow-sm border border-gray-100`}>
        <div className="flex items-center space-x-4 mb-4">
          <div className="text-6xl transform hover:scale-110 transition-transform">
            {getCategoryIcon(category.category_name)}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {categoryName}
            </h1>
            {categoryDescription && (
              <p className="text-lg text-gray-600 leading-relaxed">
                {categoryDescription}
              </p>
            )}
          </div>
        </div>

        {/* Category Statistics */}
        {renderCategoryStats()}

        {/* Quick Actions */}
        {renderQuickActions()}
      </div>

      {/* =============================================
          SEARCH AND FILTERS
          ============================================= */}
      <CategoryFilterPanel
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showTranslation={showTranslation}
        onShowTranslationChange={setShowTranslation}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        categoryName={categoryName}
      />

      {/* =============================================
          LOADING STATE
          ============================================= */}
      {isLoading && (
        <LoadingSpinner 
          text={searchTerm.length > 2 ? t('loading.searching') : t('loading.words')} 
        />
      )}

      {/* =============================================
          RESULTS INFO
          ============================================= */}
      {!isLoading && filteredWords && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {searchTerm 
              ? t('results.searchResults', { count: filteredWords.length, searchTerm })
              : t('results.showing', { count: filteredWords.length })
            }
          </p>
          
          {selectedWords.length > 0 && (
            <p className="text-sm text-blue-600 font-medium">
              {t('selection.selectedCount', { count: selectedWords.length })}
            </p>
          )}
        </div>
      )}

      {/* =============================================
          WORDS DISPLAY
          ============================================= */}
      {!isLoading && filteredWords && (
        <WordDisplay
          words={filteredWords}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedWords={selectedWords}
          onWordSelection={handleWordSelection}
          learningWordIds={learningWordIds}
          onAddToLearning={handleAddToLearning}
          onRemoveFromLearning={handleRemoveFromLearning}
          onBulkAddToLearning={handleBulkAddToLearning}
          showTranslation={showTranslation}
          onShowTranslationChange={setShowTranslation}
          isLoading={isLoading}
          emptyStateConfig={emptyStateConfig}
          navigationContext={navigationContext}
        />
      )}
    </div>
  );
};

export default CategoryDetailPage;