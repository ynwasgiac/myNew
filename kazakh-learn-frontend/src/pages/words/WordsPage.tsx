// src/pages/words/WordsPage.tsx - Enhanced with Images, Sounds & Media Features
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  HeartIcon,
  SpeakerWaveIcon,
  PhotoIcon,
  EyeIcon,
  ViewColumnsIcon,
  ListBulletIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { Link } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { wordsAPI, categoriesAPI, wordTypesAPI, difficultyAPI } from '../../services/api';
import { learningAPI } from '../../services/learningAPI';
import { useTranslation } from '../../hooks/useTranslation';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import type { WordFilters, KazakhWordSummary, Category, WordType, DifficultyLevel, PaginatedWordsResponse } from '../../types/api';
import type { LearningStatus } from '../../types/learning';

// Simple debounce utility
const debounce = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

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

  // Debounced search function
  const debouncedSearch = debounce((term: string) => {
    setFilters(prev => ({ ...prev, search: term || undefined, page: 1 }));
  }, 500);

  // Apply debounced search when searchTerm changes
  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm]);

  // Reset to first page when filters change (except page itself)
  const handleFilterChange = (key: keyof WordFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1
    }));
    
    if (key !== 'page') {
      setSelectedWords([]);
    }
  };

  // Fetch words data using TRUE PAGINATION
  const { 
    data: wordsData, 
    isLoading: wordsLoading, 
    error: wordsError,
    isFetching 
  } = useQuery<PaginatedWordsResponse>({
    queryKey: ['words-paginated', filters],
    queryFn: () => wordsAPI.getWordsPaginated(filters),
    placeholderData: (previousData: PaginatedWordsResponse | undefined) => previousData,
    staleTime: 30000
  });

  // Fetch filter options
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesAPI.getCategories(),
    staleTime: 60000
  });

  const { data: wordTypes = [] } = useQuery({
    queryKey: ['word-types'],
    queryFn: () => wordTypesAPI.getWordTypes(),
    staleTime: 60000
  });

  const { data: difficultyLevels = [] } = useQuery({
    queryKey: ['difficulty-levels'],
    queryFn: () => difficultyAPI.getDifficultyLevels(),
    staleTime: 60000
  });

  // Fetch user's learning progress
  const { data: learningProgress = [] } = useQuery({
    queryKey: ['learning-progress-all'],
    queryFn: () => learningAPI.getProgress({ limit: 1000 }),
    staleTime: 30000
  });

  // Create learning word IDs set
  const learningWordIds = new Set<number>();
  learningProgress.forEach(progress => {
    learningWordIds.add(progress.kazakh_word_id);
  });

  // Mutations for learning operations
  const addToLearningMutation = useMutation({
    mutationFn: async (wordIds: number[]) => {
      if (wordIds.length === 1) {
        return await learningAPI.addWordToLearning(wordIds[0], 'want_to_learn');
      } else {
        return await learningAPI.addMultipleWords({
          word_ids: wordIds,
          status: 'want_to_learn' as LearningStatus
        });
      }
    },
    onSuccess: (data, variables) => {
      const count = variables.length;
      toast.success(count === 1 ? 'Word added to learning' : `${count} words added to learning`);
      queryClient.invalidateQueries({ queryKey: ['learning-progress-all'] });
      setSelectedWords([]);
    },
    onError: () => {
      toast.error('Failed to add words to learning');
    }
  });

  const removeFromLearningMutation = useMutation({
    mutationFn: async (wordIds: number[]) => {
      await Promise.all(wordIds.map(id => learningAPI.removeWordFromLearning(id)));
    },
    onSuccess: (data, variables) => {
      const count = variables.length;
      toast.success(count === 1 ? 'Word removed from learning' : `${count} words removed from learning`);
      queryClient.invalidateQueries({ queryKey: ['learning-progress-all'] });
    },
    onError: () => {
      toast.error('Failed to remove words from learning');
    }
  });

  // Event handlers
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleClearFilters = () => {
    setFilters({
      page: 1,
      page_size: 20,
      language_code: user?.main_language?.language_code || 'en'
    });
    setSearchTerm('');
    setSelectedWords([]);
  };

  const handleWordSelection = (wordId: number) => {
    setSelectedWords(prev => 
      prev.includes(wordId) 
        ? prev.filter(id => id !== wordId)
        : [...prev, wordId]
    );
  };

  const handleSelectAll = () => {
    const currentPageWordIds = words.map(word => word.id);
    setSelectedWords(prev => {
      const hasAllSelected = currentPageWordIds.every(id => prev.includes(id));
      if (hasAllSelected) {
        return prev.filter(id => !currentPageWordIds.includes(id));
      } else {
        return Array.from(new Set([...prev, ...currentPageWordIds]));
      }
    });
  };

  const handleToggleWordInLearning = (wordId: number) => {
    if (learningWordIds.has(wordId)) {
      removeFromLearningMutation.mutate([wordId]);
    } else {
      addToLearningMutation.mutate([wordId]);
    }
  };

  const handleBatchAddToLearning = () => {
    if (selectedWords.length === 0) {
      toast.error('No words selected');
      return;
    }
    
    const wordsNotInLearning = selectedWords.filter(id => !learningWordIds.has(id));
    if (wordsNotInLearning.length === 0) {
      toast('All selected words are already in learning');
      return;
    }
    
    addToLearningMutation.mutate(wordsNotInLearning);
  };

  const handleBatchRemoveFromLearning = () => {
    if (selectedWords.length === 0) {
      toast.error('No words selected');
      return;
    }
    
    const wordsInLearning = selectedWords.filter(id => learningWordIds.has(id));
    if (wordsInLearning.length === 0) {
      toast('No selected words are in learning');
      return;
    }
    
    removeFromLearningMutation.mutate(wordsInLearning);
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
    setSelectedWords([]);
  };

  // Extract data from paginated response
  const words: KazakhWordSummary[] = wordsData?.words || [];
  const currentPage = wordsData?.pagination.current_page || 1;
  const totalPages = wordsData?.pagination.total_pages || 0;
  const totalWords = wordsData?.total_count || 0;
  const hasNext = wordsData?.has_next || false;
  const hasPrevious = wordsData?.has_previous || false;
  const pageSize = wordsData?.pagination.page_size || filters.page_size || 20;

  const isLoading = wordsLoading && !wordsData;
  const isUpdating = isFetching && !!wordsData;

  // Error state
  if (wordsError && !wordsData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Words</h2>
          <p className="text-gray-600 mb-4">Failed to load words. Please try again.</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return <LoadingSpinner fullScreen text="Loading words..." />;
  }

  const selectedWordsInLearning = selectedWords.filter(id => learningWordIds.has(id)).length;
  const selectedWordsNotInLearning = selectedWords.filter(id => !learningWordIds.has(id)).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Words</h1>
              <p className="mt-2 text-gray-600">
                Browse and manage your vocabulary {totalWords > 0 && `(${totalWords.toLocaleString()} words)`}
              </p>
            </div>
            
            {selectedWords.length > 0 && (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600">
                  {selectedWords.length} selected
                </span>
                <div className="flex space-x-2">
                  {selectedWordsNotInLearning > 0 && (
                    <button
                      onClick={handleBatchAddToLearning}
                      disabled={addToLearningMutation.isPending}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      <PlusIcon className="h-4 w-4" />
                      <span>Add to Learning ({selectedWordsNotInLearning})</span>
                    </button>
                  )}
                  {selectedWordsInLearning > 0 && (
                    <button
                      onClick={handleBatchRemoveFromLearning}
                      disabled={removeFromLearningMutation.isPending}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      <XMarkIcon className="h-4 w-4" />
                      <span>Remove from Learning ({selectedWordsInLearning})</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search words..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'grid' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <ViewColumnsIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <ListBulletIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center justify-center space-x-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FunnelIcon className="h-5 w-5" />
                <span>Filters</span>
              </button>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Category Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      value={filters.category_id || ''}
                      onChange={(e) => handleFilterChange('category_id', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Categories</option>
                      {categories.map((category: Category) => (
                        <option key={category.id} value={category.id}>
                          {category.category_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Word Type Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Word Type
                    </label>
                    <select
                      value={filters.word_type_id || ''}
                      onChange={(e) => handleFilterChange('word_type_id', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Types</option>
                      {wordTypes.map((type: WordType) => (
                        <option key={type.id} value={type.id}>
                          {type.type_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Difficulty Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Difficulty
                    </label>
                    <select
                      value={filters.difficulty_level_id || ''}
                      onChange={(e) => handleFilterChange('difficulty_level_id', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Difficulties</option>
                      {difficultyLevels.map((level: DifficultyLevel) => (
                        <option key={level.id} value={level.id}>
                          {level.level_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Clear Filters */}
                  <div className="flex items-end">
                    <button
                      onClick={handleClearFilters}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      <XMarkIcon className="h-4 w-4" />
                      <span>Clear</span>
                    </button>
                  </div>
                </div>

                {/* Show Translation Toggle */}
                <div className="mt-4 flex items-center">
                  <input
                    type="checkbox"
                    id="show-translation"
                    checked={showTranslation}
                    onChange={(e) => setShowTranslation(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="show-translation" className="ml-2 text-sm text-gray-700">
                    Show translations
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Words Display */}
        <div className="bg-white rounded-lg shadow-sm border">
          {words.length === 0 ? (
            <div className="text-center py-12">
              <PhotoIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Words Found</h3>
              <p className="text-gray-600">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              {/* Select All Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={words.length > 0 && words.every(word => selectedWords.includes(word.id))}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Select All
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    Showing {wordsData?.pagination.start_index || 0} to {wordsData?.pagination.end_index || 0} of {totalWords} words
                  </span>
                </div>
              </div>

              {/* Words Display */}
              {viewMode === 'grid' ? (
                <WordGridView 
                  words={words}
                  selectedWords={selectedWords}
                  learningWordIds={learningWordIds}
                  showTranslation={showTranslation}
                  onWordSelection={handleWordSelection}
                  onToggleWordInLearning={handleToggleWordInLearning}
                  isUpdating={addToLearningMutation.isPending || removeFromLearningMutation.isPending}
                />
              ) : (
                <WordListView 
                  words={words}
                  selectedWords={selectedWords}
                  learningWordIds={learningWordIds}
                  showTranslation={showTranslation}
                  onWordSelection={handleWordSelection}
                  onToggleWordInLearning={handleToggleWordInLearning}
                  isUpdating={addToLearningMutation.isPending || removeFromLearningMutation.isPending}
                />
              )}

              {/* Enhanced Pagination */}
              {totalPages > 1 && (
                <div className="p-6 border-t border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    {/* Previous Button */}
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={!hasPrevious || isUpdating}
                      className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeftIcon className="h-5 w-5" />
                      <span>Previous</span>
                    </button>

                    {/* Page Numbers */}
                    <div className="flex items-center space-x-2">
                      {/* First page */}
                      {currentPage > 3 && (
                        <>
                          <button
                            onClick={() => handlePageChange(1)}
                            className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                          >
                            1
                          </button>
                          {currentPage > 4 && (
                            <span className="px-2 text-gray-500">...</span>
                          )}
                        </>
                      )}

                      {/* Current page and neighbors */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                        const pageNum = startPage + i;
                        
                        if (pageNum > totalPages) return null;
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${
                              pageNum === currentPage
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      {/* Last page */}
                      {currentPage < totalPages - 2 && (
                        <>
                          {currentPage < totalPages - 3 && (
                            <span className="px-2 text-gray-500">...</span>
                          )}
                          <button
                            onClick={() => handlePageChange(totalPages)}
                            className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </div>

                    {/* Next Button */}
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={!hasNext || isUpdating}
                      className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>Next</span>
                      <ChevronRightIcon className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Page Info */}
                  <div className="mt-3 text-center text-sm text-gray-600">
                    Showing {wordsData?.pagination.start_index || 0} to {wordsData?.pagination.end_index || 0} of {totalWords} words
                  </div>

                  {/* Page Size Selector */}
                  <div className="mt-3 flex justify-center">
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-gray-600">Items per page:</label>
                      <select
                        value={pageSize}
                        onChange={(e) => handleFilterChange('page_size', parseInt(e.target.value))}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={30}>30</option>
                        <option value={50}>50</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Loading Overlay */}
        {isUpdating && (
          <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <LoadingSpinner text="Updating..." />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Word Grid View Component with Images
interface WordGridViewProps {
  words: KazakhWordSummary[];
  selectedWords: number[];
  learningWordIds: Set<number>;
  showTranslation: boolean;
  onWordSelection: (wordId: number) => void;
  onToggleWordInLearning: (wordId: number) => void;
  isUpdating: boolean;
}

const WordGridView: React.FC<WordGridViewProps> = ({
  words,
  selectedWords,
  learningWordIds,
  showTranslation,
  onWordSelection,
  onToggleWordInLearning,
  isUpdating
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
      {words.map((word) => (
        <WordCard
          key={word.id}
          word={word}
          isSelected={selectedWords.includes(word.id)}
          isInLearning={learningWordIds.has(word.id)}
          showTranslation={showTranslation}
          onSelect={() => onWordSelection(word.id)}
          onToggleLearning={() => onToggleWordInLearning(word.id)}
          isUpdating={isUpdating}
        />
      ))}
    </div>
  );
};

// Word List View Component
interface WordListViewProps {
  words: KazakhWordSummary[];
  selectedWords: number[];
  learningWordIds: Set<number>;
  showTranslation: boolean;
  onWordSelection: (wordId: number) => void;
  onToggleWordInLearning: (wordId: number) => void;
  isUpdating: boolean;
}

const WordListView: React.FC<WordListViewProps> = ({
  words,
  selectedWords,
  learningWordIds,
  showTranslation,
  onWordSelection,
  onToggleWordInLearning,
  isUpdating
}) => {
  return (
    <div className="divide-y divide-gray-200">
      {words.map((word) => (
        <WordListItem
          key={word.id}
          word={word}
          isSelected={selectedWords.includes(word.id)}
          isInLearning={learningWordIds.has(word.id)}
          showTranslation={showTranslation}
          onSelect={() => onWordSelection(word.id)}
          onToggleLearning={() => onToggleWordInLearning(word.id)}
          isUpdating={isUpdating}
        />
      ))}
    </div>
  );
};

// Individual Word Card Component with Image and Audio
interface WordCardProps {
  word: KazakhWordSummary;
  isSelected: boolean;
  isInLearning: boolean;
  showTranslation: boolean;
  onSelect: () => void;
  onToggleLearning: () => void;
  isUpdating: boolean;
}

const WordCard: React.FC<WordCardProps> = ({
  word,
  isSelected,
  isInLearning,
  showTranslation,
  onSelect,
  onToggleLearning,
  isUpdating
}) => {
  const { playAudio } = useAudioPlayer({ wordId: word.id, word });

  const getImageFallback = () => {
    return `/images/words/categories/${word.category_name?.toLowerCase() || 'general'}/placeholder.jpg`;
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement;
    img.src = getImageFallback();
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
  };

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };

  return (
    <Link 
      to={`/app/words/${word.id}`}
      className={`block bg-white rounded-lg border-2 transition-all duration-200 hover:shadow-md hover:scale-105 ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Selection Checkbox */}
      <div className="p-3 pb-0">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}} // Controlled by onClick
          onClick={handleCheckboxClick}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
        />
      </div>

      {/* Word Image */}
      <div className="px-3 pb-3">
        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
          {word.primary_image ? (
            <img
              src={word.primary_image}
              alt={`Image for ${word.kazakh_word}`}
              className="w-full h-full object-cover"
              onError={handleImageError}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <PhotoIcon className="h-12 w-12 text-gray-400" />
            </div>
          )}
          
          {/* Learning Status Badge */}
          {isInLearning && (
            <div className="absolute top-2 left-2">
              <HeartIconSolid className="h-5 w-5 text-red-500" />
            </div>
          )}
        </div>
      </div>

      {/* Word Content */}
      <div className="p-4 pt-0">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          {word.kazakh_word}
        </h3>
        {word.kazakh_cyrillic && (
          <p className="text-sm text-gray-600 mb-2">{word.kazakh_cyrillic}</p>
        )}

        {showTranslation && word.primary_translation && (
          <p className="text-sm text-gray-700 mb-3">{word.primary_translation}</p>
        )}

        {/* Word Metadata */}
        <div className="flex flex-wrap gap-1 mb-3">
          {word.category_name && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {word.category_name}
            </span>
          )}
          {word.word_type_name && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {word.word_type_name}
            </span>
          )}
          {word.difficulty_level && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              Level {word.difficulty_level}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* Audio Button */}
            <button
              onClick={(e) => handleActionClick(e, () => playAudio())}
              className="p-2 text-gray-400 hover:text-blue-600 transition-colors rounded-full hover:bg-blue-50"
              title="Play pronunciation"
            >
              <SpeakerWaveIcon className="h-4 w-4" />
            </button>
            
            {/* View Details Icon */}
            <div className="p-2 text-gray-400">
              <EyeIcon className="h-4 w-4" />
            </div>
          </div>

          {/* Learning Heart Button */}
          <button
            onClick={(e) => handleActionClick(e, onToggleLearning)}
            disabled={isUpdating}
            className={`p-2 rounded-full transition-all duration-200 ${
              isInLearning
                ? 'text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-600'
                : 'text-gray-400 bg-gray-50 hover:bg-red-50 hover:text-red-500'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isInLearning ? 'Remove from Learning' : 'Add to Learning'}
          >
            {isInLearning ? (
              <HeartIconSolid className="h-5 w-5" />
            ) : (
              <HeartIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </Link>
  );
};

// Individual Word List Item Component
interface WordListItemProps {
  word: KazakhWordSummary;
  isSelected: boolean;
  isInLearning: boolean;
  showTranslation: boolean;
  onSelect: () => void;
  onToggleLearning: () => void;
  isUpdating: boolean;
}

const WordListItem: React.FC<WordListItemProps> = ({
  word,
  isSelected,
  isInLearning,
  showTranslation,
  onSelect,
  onToggleLearning,
  isUpdating
}) => {
  const { playAudio } = useAudioPlayer({ wordId: word.id, word });

  const getImageFallback = () => {
    return `/images/words/categories/${word.category_name?.toLowerCase() || 'general'}/placeholder.jpg`;
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement;
    img.src = getImageFallback();
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
  };

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };

  return (
    <Link 
      to={`/app/words/${word.id}`}
      className={`block p-6 hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
      }`}
    >
      <div className="flex items-start space-x-4">
        {/* Selection Checkbox */}
        <div className="flex-shrink-0 pt-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}} // Controlled by onClick
            onClick={handleCheckboxClick}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
          />
        </div>

        {/* Word Image */}
        <div className="flex-shrink-0">
          <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden relative">
            {word.primary_image ? (
              <img
                src={word.primary_image}
                alt={`Image for ${word.kazakh_word}`}
                className="w-full h-full object-cover"
                onError={handleImageError}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                <PhotoIcon className="h-6 w-6 text-gray-400" />
              </div>
            )}
            
            {/* Learning Status Badge */}
            {isInLearning && (
              <div className="absolute -top-1 -right-1">
                <HeartIconSolid className="h-4 w-4 text-red-500" />
              </div>
            )}
          </div>
        </div>

        {/* Word Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900 mb-1 hover:text-blue-600 transition-colors">
                {word.kazakh_word}
              </h3>
              {word.kazakh_cyrillic && (
                <p className="text-sm text-gray-600 mb-2">{word.kazakh_cyrillic}</p>
              )}

              {showTranslation && word.primary_translation && (
                <p className="text-gray-700 mb-2">{word.primary_translation}</p>
              )}

              {/* Word Metadata */}
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                {word.category_name && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {word.category_name}
                  </span>
                )}
                {word.word_type_name && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {word.word_type_name}
                  </span>
                )}
                {word.difficulty_level && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Level {word.difficulty_level}
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 ml-4">
              {/* Audio Button */}
              <button
                onClick={(e) => handleActionClick(e, () => playAudio())}
                className="p-2 text-gray-400 hover:text-blue-600 transition-colors rounded-full hover:bg-blue-50"
                title="Play pronunciation"
              >
                <SpeakerWaveIcon className="h-5 w-5" />
              </button>
              
              {/* View Details Icon */}
              <div className="p-2 text-gray-400">
                <EyeIcon className="h-5 w-5" />
              </div>

              {/* Learning Heart Button */}
              <button
                onClick={(e) => handleActionClick(e, onToggleLearning)}
                disabled={isUpdating}
                className={`p-3 rounded-full transition-all duration-200 ${
                  isInLearning
                    ? 'text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-600'
                    : 'text-gray-400 bg-gray-50 hover:bg-red-50 hover:text-red-500'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isInLearning ? 'Remove from Learning' : 'Add to Learning'}
              >
                {isInLearning ? (
                  <HeartIconSolid className="h-6 w-6" />
                ) : (
                  <HeartIcon className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default WordsPage;