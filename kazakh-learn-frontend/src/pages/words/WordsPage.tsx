// src/pages/words/WordsPage.tsx - Updated with True Pagination (React Query v5 Compatible)
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

import { wordsAPI, categoriesAPI, wordTypesAPI, difficultyAPI, learningAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import type { WordFilters, PaginatedWordsResponse } from '../../types/api';

import LoadingSpinner from '../../components/ui/LoadingSpinner';
import WordsFilterPanel from '../../components/word/WordsFilterPanel';
import { WordDisplay, BulkActionsBar } from '../../components/word/WordDisplayComponents';

const WordsPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation('words');
  const queryClient = useQueryClient();

  // State for filters and pagination
  const [filters, setFilters] = useState<WordFilters>({
    page: 1,
    page_size: 20,
    language_code: user?.main_language?.language_code || 'en'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedWords, setSelectedWords] = useState<number[]>([]);
  const [showTranslation, setShowTranslation] = useState(true);

  // Reset to first page when filters change (except page itself)
  const handleFilterChange = (key: keyof WordFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1 // Reset to page 1 unless we're changing the page itself
    }));
    
    // Clear selections when filters change
    if (key !== 'page') {
      setSelectedWords([]);
    }
  };

  // Handle search with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm !== (filters.search || '')) {
        setFilters(prev => ({
          ...prev,
          search: searchTerm || undefined,
          page: 1 // Reset to first page when search changes
        }));
        setSelectedWords([]); // Clear selections when search changes
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm, filters.search]);

  // Fetch paginated words data - FIXED for React Query v5
  const { 
    data: wordsData, 
    isLoading: wordsLoading, 
    error: wordsError,
    isFetching 
  } = useQuery({
    queryKey: ['words-paginated', filters],
    queryFn: () => wordsAPI.getWordsPaginated(filters),
    placeholderData: keepPreviousData, // v5 syntax: replaced keepPreviousData: true
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Fetch filter options
  const { data: categories } = useQuery({
    queryKey: ['categories', filters.language_code],
    queryFn: () => categoriesAPI.getCategories(filters.language_code),
  });

  const { data: wordTypes } = useQuery({
    queryKey: ['word-types', filters.language_code],
    queryFn: () => wordTypesAPI.getWordTypes(filters.language_code),
  });

  const { data: difficultyLevels } = useQuery({
    queryKey: ['difficulty-levels', filters.language_code],
    queryFn: () => difficultyAPI.getDifficultyLevels(filters.language_code),
  });

  const { data: learningProgress } = useQuery({
    queryKey: ['learning-progress'],
    queryFn: () => learningAPI.getProgress(),
  });

  // Mutations
  const addToLearningMutation = useMutation({
    mutationFn: (wordIds: number[]) => learningAPI.addWordToLearning(wordIds),
    onSuccess: () => {
      toast.success(t('messages.addedToLearning'));
      queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
      setSelectedWords([]);
    },
    onError: (error) => {
      toast.error(t('messages.addToLearningError'));
      console.error('Add to learning error:', error);
    },
  });

  const removeFromLearningMutation = useMutation({
    mutationFn: (wordIds: number[]) => learningAPI.removeWordFromLearning(wordIds),
    onSuccess: () => {
      toast.success(t('messages.removedFromLearning'));
      queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
    },
    onError: (error) => {
      toast.error(t('messages.removeFromLearningError'));
      console.error('Remove from learning error:', error);
    },
  });

  // Get learning word IDs for heart status
  const learningWordIds = new Set(
    learningProgress?.map(progress => progress.kazakh_word_id) || []
  );

  // Event handlers
  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const clearFilters = () => {
    setFilters({
      page: 1,
      page_size: 20,
      language_code: user?.main_language?.language_code || 'en'
    });
    setSearchTerm('');
    setSelectedWords([]);
  };

  const toggleWordSelection = (wordId: number) => {
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

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    handleFilterChange('page', newPage);
    setSelectedWords([]); // Clear selections when changing page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setFilters(prev => ({
      ...prev,
      page_size: newPageSize,
      page: 1 // Reset to first page when changing page size
    }));
    setSelectedWords([]);
  };

  // Create navigation context for word detail navigation
  const navigationContext = {
    words: wordsData?.words || [],
    source: 'browse' as const,
    searchTerm: filters.search,
    filters: filters
  };

  // Empty state config
  const emptyStateConfig = {
    title: filters.search ? t('emptyState.searchTitle') : t('emptyState.noWordsTitle'),
    message: filters.search 
      ? t('emptyState.searchMessage', { searchTerm: filters.search })
      : t('emptyState.noWordsMessage'),
    showClearAction: !!(filters.search || filters.category_id || filters.word_type_id || filters.difficulty_level_id),
    onClear: clearFilters
  };

  if (wordsError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{t('errors.loadingError')}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 btn-primary"
        >
          {t('actions.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('page.title')}</h1>
          <p className="text-gray-600">
            {wordsData ? t('page.subtitle', { count: wordsData.total_count }) : t('page.loading')}
          </p>
        </div>

        {/* Bulk Actions */}
        <BulkActionsBar
          selectedCount={selectedWords.length}
          onBulkAddToLearning={handleBulkAddToLearning}
          isAddingToLearning={addToLearningMutation.isPending}
        />
      </div>

      {/* Search and Filters */}
      <WordsFilterPanel
        searchTerm={searchTerm}
        onSearchChange={handleSearch}
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={clearFilters}
        categories={categories}
        wordTypes={wordTypes}
        difficultyLevels={difficultyLevels}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showTranslation={showTranslation}
        onShowTranslationChange={setShowTranslation}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
      />

      {/* Results Info and Page Size Selector */}
      {!wordsLoading && wordsData && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-600">
              {t('results.showing', {
                start: wordsData.pagination.start_index,
                end: wordsData.pagination.end_index,
                total: wordsData.total_count
              })}
            </p>
            
            {isFetching && (
              <div className="flex items-center space-x-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm">{t('loading.updating')}</span>
              </div>
            )}
          </div>
          
          {/* Page Size Selector */}
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">{t('pagination.itemsPerPage')}:</label>
            <select
              value={filters.page_size}
              onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      )}

      {/* Loading State */}
      {wordsLoading && <LoadingSpinner text={t('loading.words')} />}

      {/* Words Display */}
      {!wordsLoading && wordsData && (
        <WordDisplay
          words={wordsData.words}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedWords={selectedWords}
          onWordSelection={toggleWordSelection}
          learningWordIds={learningWordIds}
          onAddToLearning={handleAddToLearning}
          onRemoveFromLearning={handleRemoveFromLearning}
          onBulkAddToLearning={handleBulkAddToLearning}
          showTranslation={showTranslation}
          onShowTranslationChange={setShowTranslation}
          isLoading={isFetching}
          emptyStateConfig={emptyStateConfig}
          navigationContext={navigationContext}
        />
      )}

      {/* Enhanced Pagination */}
      {!wordsLoading && wordsData && wordsData.pagination.total_pages > 1 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            {/* Previous Button */}
            <button
              onClick={() => handlePageChange(wordsData.pagination.current_page - 1)}
              disabled={!wordsData.has_previous || isFetching}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeftIcon className="h-5 w-5" />
              <span>{t('pagination.previous')}</span>
            </button>

            {/* Page Numbers */}
            <div className="flex items-center space-x-2">
              {/* First page */}
              {wordsData.pagination.current_page > 3 && (
                <>
                  <button
                    onClick={() => handlePageChange(1)}
                    className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                  >
                    1
                  </button>
                  {wordsData.pagination.current_page > 4 && (
                    <span className="px-2 text-gray-500">...</span>
                  )}
                </>
              )}

              {/* Current page and neighbors */}
              {Array.from({ length: Math.min(5, wordsData.pagination.total_pages) }, (_, i) => {
                const startPage = Math.max(1, wordsData.pagination.current_page - 2);
                const pageNum = startPage + i;
                
                if (pageNum > wordsData.pagination.total_pages) return null;
                
                const isCurrentPage = pageNum === wordsData.pagination.current_page;
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    disabled={isFetching}
                    className={`px-3 py-2 text-sm font-medium rounded-md ${
                      isCurrentPage
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Last page */}
              {wordsData.pagination.current_page < wordsData.pagination.total_pages - 2 && (
                <>
                  {wordsData.pagination.current_page < wordsData.pagination.total_pages - 3 && (
                    <span className="px-2 text-gray-500">...</span>
                  )}
                  <button
                    onClick={() => handlePageChange(wordsData.pagination.total_pages)}
                    className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                  >
                    {wordsData.pagination.total_pages}
                  </button>
                </>
              )}
            </div>

            {/* Next Button */}
            <button
              onClick={() => handlePageChange(wordsData.pagination.current_page + 1)}
              disabled={!wordsData.has_next || isFetching}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{t('pagination.next')}</span>
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Page Info */}
          <div className="mt-3 text-center text-sm text-gray-600">
            {t('pagination.pageInfo', {
              current: wordsData.pagination.current_page,
              total: wordsData.pagination.total_pages
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default WordsPage;