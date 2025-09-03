import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import WordEditModal from '../../components/admin/WordEditModal';
import { WordImagesManager, WordSoundsManager } from '../../components/admin/WordMediaManager';
import { 
  adminWordsAPI, 
  type KazakhWordSummary, 
  type WordFilterOptions,
  type FilterOption,
  type DifficultyFilterOption 
} from '../../services/adminWordsAPI';
import { toast } from 'sonner';
import AddWordModal from '../../components/admin/AddWordModal';
import ExampleSentencesModal from '../../components/admin/ExampleSentencesModal';
import { 
  DocumentTextIcon  // Добавить этот импорт для иконки Example Sentences
} from '@heroicons/react/24/outline';
import { 
  Plus as PlusIcon,
  Loader as LoaderIcon,
  CheckCircle as CheckCircleIcon,
  AlertCircle as AlertCircleIcon,
  Sparkles as SparklesIcon
} from 'lucide-react';

// Memoized table row component (unchanged)
const WordTableRow = memo<{
  word: KazakhWordSummary;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onManageImages: (word: KazakhWordSummary) => void;
  onManageSounds: (word: KazakhWordSummary) => void;
  onExampleSentences: (word: any) => void; 
  getDifficultyColor: (level: number) => string;
  getTypeColor: (type: string) => string;
}>(({ 
  word, 
  isSelected, 
  onSelect, 
  onEdit, 
  onDelete, 
  onManageImages, 
  onManageSounds,
  onExampleSentences,
  getDifficultyColor,
  getTypeColor 
}) => {
  const handleSelectChange = useCallback(() => {
    onSelect(word.id);
  }, [onSelect, word.id]);

  const handleEdit = useCallback(() => {
    onEdit(word.id);
  }, [onEdit, word.id]);

  const handleDelete = useCallback(() => {
    onDelete(word.id);
  }, [onDelete, word.id]);

  const handleImagesClick = useCallback(() => {
    onManageImages(word);
  }, [onManageImages, word]);

  const handleSoundsClick = useCallback(() => {
    onManageSounds(word);
  }, [onManageSounds, word]);

  // Add this handler for example sentences
  const handleExampleSentencesClick = useCallback(() => {
    console.log('🖱️ КНОПКА EXAMPLE SENTENCES НАЖАТА в WordTableRow');
    console.log('📊 Word object:', word);
    console.log('🔗 Calling onExampleSentences function...');
    onExampleSentences(word);
    console.log('✅ onExampleSentences вызвана');
  }, [onExampleSentences, word]);

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleSelectChange}
          className="rounded border-gray-300"
        />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">
          {word.kazakh_word}
        </div>
        {word.kazakh_cyrillic && (
          <div className="text-sm text-gray-500">
            {word.kazakh_cyrillic}
          </div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex space-x-2">
          <button 
            onClick={handleEdit}
            className="text-indigo-600 hover:text-indigo-900"
            title="Edit Word"
          >
            Edit
          </button>
          <button 
            onClick={handleDelete}
            className="text-red-600 hover:text-red-900"
            title="Delete Word & Media"
          >
            Delete
          </button>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex space-x-2">
          <button
            onClick={handleImagesClick}
            className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200"
            title="Manage Images"
          >
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
            Images
          </button>
          <button
            onClick={handleSoundsClick}
            className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-purple-700 bg-purple-100 hover:bg-purple-200"
            title="Manage Audio"
          >
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" clipRule="evenodd" />
            </svg>
            Audio
          </button>
          <button
            onClick={handleExampleSentencesClick}
            className="text-orange-600 hover:text-orange-900"
            title="Manage Example Sentences"
          >
            <DocumentTextIcon className="h-4 w-4" />
          </button>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">
          {word.primary_translation || (
            <span className="text-gray-400 italic">No translation</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">
          {word.category_name || (
            <span className="text-gray-400 italic">Unknown</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <Badge className={getTypeColor(word.word_type_name || 'unknown')}>
          {word.word_type_name || 'N/A'}
        </Badge>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <Badge className={getDifficultyColor(word.difficulty_level)}>
          Level {word.difficulty_level}
        </Badge>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <Badge className="bg-green-100 text-green-800">
          Active
        </Badge>
      </td>
    </tr>
  );
});

WordTableRow.displayName = 'WordTableRow';

const AdminWordsPage: React.FC = () => {
  const { t } = useTranslation();
  const [words, setWords] = useState<KazakhWordSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalWords, setTotalWords] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  
  // Selection states
  const [selectedWords, setSelectedWords] = useState<number[]>([]);
  
  // Delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingWordId, setDeletingWordId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [forceDelete, setForceDelete] = useState(false);

  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingWordId, setEditingWordId] = useState<number | null>(null);

  // Media management states
  const [showImagesModal, setShowImagesModal] = useState(false);
  const [showSoundsModal, setShowSoundsModal] = useState(false);
  const [selectedWordForMedia, setSelectedWordForMedia] = useState<KazakhWordSummary | null>(null);
  
  // Add these new state variables for sentence generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'starting' | 'processing' | 'completed' | 'error'>('idle');

  const [showExampleSentencesModal, setShowExampleSentencesModal] = useState(false);
  const [selectedWordForSentences, setSelectedWordForSentences] = useState<{
    id: number;
    kazakh_word: string;
    kazakh_cyrillic?: string;
  } | null>(null);

  // Server-side filters and sorting
  const [filters, setFilters] = useState({
    categoryId: null as number | null,
    wordTypeId: null as number | null,
    difficultyLevelId: null as number | null,
    search: '',
  });
  const [sortBy, setSortBy] = useState<string>('kazakh_word');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filter options from server
  const [filterOptions, setFilterOptions] = useState<WordFilterOptions>({
    categories: [],
    word_types: [],
    difficulty_levels: []
  });
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(true);

  // Debouncing for search
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Statistics
  const [showStats, setShowStats] = useState(false);
  const [wordStats, setWordStats] = useState<any>(null);

  // Critical refs to prevent unnecessary re-renders
  const isMediaModalOpen = useRef(false);
  const lastFetchTime = useRef(0);
  const fetchCooldown = 300; // Reduced cooldown for better UX

  // Load filter options on component mount
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        setFilterOptionsLoading(true);
        const options = await adminWordsAPI.getWordFilterOptions();
        setFilterOptions(options);
      } catch (error) {
        console.error('Failed to load filter options:', error);
        toast.error('Failed to load filter options');
      } finally {
        setFilterOptionsLoading(false);
      }
    };

    loadFilterOptions();
  }, []);

  
  // Add this function for sentence generation
  const runSentenceGeneration = async () => {
    try {
      setIsGenerating(true);
      setGenerationStatus('starting');
      
      // Try both possible token keys
      let token = localStorage.getItem('access_token');
      if (!token) {
        token = localStorage.getItem('kazakh_learn_token');
      }
      
      if (!token) {
        toast.error('No authentication token found. Please login again.');
        return;
      }
      
      const response = await fetch('http://localhost:8000/admin/run-sentence-generation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
  
      if (!response.ok) {
        throw new Error('Failed to start sentence generation');
      }
  
      const data = await response.json();
      setGenerationStatus('processing');
      toast.success('Sentence generation started successfully!');
      
      // Simulate completion after 30 seconds
      setTimeout(() => {
        setGenerationStatus('completed');
        setIsGenerating(false);
        toast.success('Sentence generation completed!');
        // Reset status after showing completion
        setTimeout(() => setGenerationStatus('idle'), 5000);
      }, 30000);
      
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to start sentence generation');
      setGenerationStatus('error');
      setIsGenerating(false);
      // Reset status after showing error
      setTimeout(() => setGenerationStatus('idle'), 5000);
    }
  }; 
  

  // Fetch words with server-side filtering
  const fetchWords = useCallback(async (
    page: number = 1,
    forceRefetch = false,
    resetPagination = false
  ) => {
    const now = Date.now();
    
    // Prevent rapid successive fetches unless forced
    if (!forceRefetch && (now - lastFetchTime.current) < fetchCooldown) {
      console.log('Fetch cooldown active, skipping fetch');
      return;
    }

    // Never fetch while media modal is open unless forced
    if (isMediaModalOpen.current && !forceRefetch) {
      console.log('Media modal open, skipping fetch');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      lastFetchTime.current = now;
      
      // Calculate skip based on page
      const skip = resetPagination ? 0 : (page - 1) * pageSize;
      
      console.log('Fetching words with filters:', {
        skip,
        limit: pageSize,
        categoryId: filters.categoryId,
        wordTypeId: filters.wordTypeId,
        difficultyLevelId: filters.difficultyLevelId,
        search: filters.search,
        sortBy,
        sortDirection,
      });
      
      // Fetch words and total count in parallel
      const [wordsData, totalCount] = await Promise.all([
        adminWordsAPI.getAdminWords(
          skip,
          pageSize,
          filters.categoryId || undefined,
          filters.wordTypeId || undefined,
          filters.difficultyLevelId || undefined,
          filters.search || undefined,
          'en', // language code
          sortBy,
          sortDirection
        ),
        adminWordsAPI.getWordsCount(
          filters.categoryId || undefined,
          filters.wordTypeId || undefined,
          filters.difficultyLevelId || undefined,
          filters.search || undefined,
          'en'
        )
      ]);
      
      if (resetPagination) {
        setWords(wordsData);
        setCurrentPage(1);
      } else {
        setWords(wordsData);
      }
      
      setTotalWords(totalCount);
      setHasMore((page * pageSize) < totalCount);
      
      console.log('Words fetched successfully:', {
        wordsCount: wordsData.length,
        totalCount,
        hasMore: (page * pageSize) < totalCount
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      toast.error('Failed to load words');
    } finally {
      setLoading(false);
    }
  }, [filters, pageSize, sortBy, sortDirection]);

  const fetchStatistics = useCallback(async () => {
    try {
      const stats = await adminWordsAPI.getWordStatistics();
      setWordStats(stats);
    } catch (err) {
      console.error('Failed to load statistics:', err);
    }
  }, []);

  // Debounced search effect
  useEffect(() => {
    // Clear existing timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    // Set new timer for search
    const timer = setTimeout(() => {
      setFilters(prev => ({
        ...prev,
        search: searchTerm
      }));
    }, 500); // 500ms debounce

    setSearchDebounceTimer(timer);

    // Cleanup
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [searchTerm]);

  // Fetch words when filters change
  useEffect(() => {
    if (!filterOptionsLoading) {
      fetchWords(1, false, true); // Reset to page 1 when filters change
    }
  }, [fetchWords, filterOptionsLoading]);

  // Initial data loading
  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  // Stable utility functions
  const getDifficultyColor = useCallback((level: number) => {
    switch (level) {
      case 1: return 'bg-green-100 text-green-800';
      case 2: return 'bg-yellow-100 text-yellow-800';
      case 3: return 'bg-orange-100 text-orange-800';
      case 4: return 'bg-red-100 text-red-800';
      case 5: return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }, []);

  const getTypeColor = useCallback((type: string) => {
    switch (type?.toLowerCase()) {
      case 'noun': return 'bg-blue-100 text-blue-800';
      case 'verb': return 'bg-purple-100 text-purple-800';
      case 'adjective': return 'bg-orange-100 text-orange-800';
      case 'adverb': return 'bg-pink-100 text-pink-800';
      case 'phrase': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }, []);

  // Event handlers
  const handleSort = useCallback((field: string) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  }, [sortBy, sortDirection]);

  const handleFilterChange = useCallback((filterKey: keyof typeof filters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: value
    }));
  }, []);

  const handleSelectWord = useCallback((wordId: number) => {
    setSelectedWords(prev => 
      prev.includes(wordId) 
        ? prev.filter(id => id !== wordId)
        : [...prev, wordId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedWords.length === words.length && words.length > 0) {
      setSelectedWords([]);
    } else {
      setSelectedWords(words.map(word => word.id));
    }
  }, [selectedWords.length, words]);

  const handleEditWord = useCallback((wordId: number) => {
    setEditingWordId(wordId);
    setShowEditModal(true);
  }, []);

  const handleDeleteWord = useCallback((wordId: number) => {
    setDeletingWordId(wordId);
    setDeleteError(null);
    setForceDelete(false);
    setShowDeleteModal(true);
  }, []);

  // Media management handlers
  const handleManageImages = useCallback((word: KazakhWordSummary) => {
    console.log('🖼️ Opening images modal for:', word.kazakh_word);
    isMediaModalOpen.current = true;
    setSelectedWordForMedia(word);
    setShowImagesModal(true);
  }, []);

  const handleManageSounds = useCallback((word: KazakhWordSummary) => {
    console.log('🔊 Opening sounds modal for:', word.kazakh_word);
    isMediaModalOpen.current = true;
    setSelectedWordForMedia(word);
    setShowSoundsModal(true);
  }, []);

  const handleMediaModalClose = useCallback(() => {
    console.log('✨ Closing media modal');
    isMediaModalOpen.current = false;
    setShowImagesModal(false);
    setShowSoundsModal(false);
    setSelectedWordForMedia(null);
  }, []);

  const handleEditModalClose = useCallback(() => {
    setShowEditModal(false);
    setEditingWordId(null);
  }, []);

  const handleEditModalSave = useCallback(() => {
    console.log('💾 Word edited - refreshing list');
    fetchWords(currentPage, true);
    toast.success('Word updated successfully');
  }, [fetchWords, currentPage]);

  const handleAddWordSave = useCallback(() => {
    console.log('➕ Word added - refreshing list');
    fetchWords(1, true, true);
    setShowAddModal(false);
  }, [fetchWords]);

  // Delete confirmation handler
  const confirmDeleteWord = useCallback(async () => {
    if (!deletingWordId) return;

    try {
      setActionLoading(true);
      setDeleteError(null);
      
      await adminWordsAPI.deleteWord(deletingWordId, forceDelete);
      
      // Refresh the current page
      fetchWords(currentPage, true);
      
      toast.success('Word and all associated media deleted successfully');
      setShowDeleteModal(false);
      setDeletingWordId(null);
      setForceDelete(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete word';
      
      if (errorMessage.includes('progress records')) {
        setDeleteError(errorMessage);
        setForceDelete(false);
      } else {
        toast.error(errorMessage);
        setShowDeleteModal(false);
      }
    } finally {
      setActionLoading(false);
    }
  }, [deletingWordId, forceDelete, fetchWords, currentPage]);

  // Bulk operations
  const handleBulkDelete = useCallback(async () => {
    if (selectedWords.length === 0) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedWords.length} selected words? This will also delete all associated media files. This action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      setActionLoading(true);
      await adminWordsAPI.bulkDeleteWords(selectedWords);
      
      setSelectedWords([]);
      fetchWords(currentPage, true);
      
      toast.success(`${selectedWords.length} words and their media files deleted successfully`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete words';
      toast.error(errorMessage);
    } finally {
      setActionLoading(false);
    }
  }, [selectedWords, fetchWords, currentPage]);

  // Clear filters
  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setFilters({
      categoryId: null,
      wordTypeId: null,
      difficultyLevelId: null,
      search: '',
    });
    setSortBy('kazakh_word');
    setSortDirection('asc');
  }, []);

  // Pagination handlers
  const handleNextPage = useCallback(() => {
    if (hasMore) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchWords(nextPage, false, false);
    }
  }, [currentPage, hasMore, fetchWords]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      const prevPage = currentPage - 1;
      setCurrentPage(prevPage);
      fetchWords(prevPage, false, false);
    }
  }, [currentPage, fetchWords]);

  // Export functionality
  const handleExportWords = useCallback(async (format: 'csv' | 'json' = 'csv') => {
    try {
      const exportFilters = {
        categoryId: filters.categoryId || undefined,
        wordTypeId: filters.wordTypeId || undefined,
        difficultyLevelId: filters.difficultyLevelId || undefined,
      };

      const blob = await adminWordsAPI.exportWords(format, exportFilters);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kazakh-words-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`Words exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error('Failed to export words');
    }
  }, [filters]);

  const handleExampleSentencesOpen = (word: any) => {
    console.log('🔥 КНОПКА НАЖАТА! handleExampleSentencesOpen вызвана');
    console.log('📝 Word data:', word);
    
    console.log('🔍 СОСТОЯНИЕ ДО ИЗМЕНЕНИЯ:');
    console.log('  showExampleSentencesModal:', showExampleSentencesModal);
    console.log('  selectedWordForSentences:', selectedWordForSentences);
    
    setSelectedWordForSentences({
      id: word.id,
      kazakh_word: word.kazakh_word,
      kazakh_cyrillic: word.kazakh_cyrillic
    });
    setShowExampleSentencesModal(true);
    
    console.log('✅ setState вызваны, проверяем через 100ms...');
    
    setTimeout(() => {
      console.log('🔍 СОСТОЯНИЕ ПОСЛЕ ИЗМЕНЕНИЯ:');
      console.log('  showExampleSentencesModal:', showExampleSentencesModal);
      console.log('  selectedWordForSentences:', selectedWordForSentences);
    }, 100);
  };
  
  const handleExampleSentencesClose = () => {
    setShowExampleSentencesModal(false);
    setSelectedWordForSentences(null);
  };
  
  const handleExampleSentencesSave = () => {
    // Refresh the words list to update any counts
    fetchWords(currentPage, true);
  };

  // Get sort icon
  const getSortIcon = useCallback((field: string) => {
    if (sortBy !== field) return null;
    return sortDirection === 'asc' ? '↑' : '↓';
  }, [sortBy, sortDirection]);

  if (filterOptionsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
        <span className="ml-3 text-gray-600">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-red-800 font-medium">Error Loading Words</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
        <button
          onClick={() => fetchWords(currentPage, true)}
          className="mt-3 bg-red-100 text-red-800 px-3 py-1 rounded text-sm hover:bg-red-200"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Words Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Showing {words.length} of {totalWords} words (Page {currentPage})
            {filters.search || filters.categoryId || filters.wordTypeId || filters.difficultyLevelId ? ' - Filtered' : ''}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* AI Generation Button - Add this to your existing buttons */}
          <button
            onClick={runSentenceGeneration}
            disabled={isGenerating}
            className={`
              flex items-center px-4 py-2 rounded-lg text-sm
              font-medium text-white transition-all duration-200
              ${isGenerating 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'
              }
            `}
          >
            {isGenerating ? (
              <>
                <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <SparklesIcon className="h-4 w-4 mr-2" />
                AI Sentences
              </>
            )}
          </button>
          <button
            onClick={() => setShowStats(!showStats)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm"
          >
            {showStats ? 'Hide Stats' : 'Show Stats'}
          </button>
          <button
            onClick={() => handleExportWords('csv')}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm"
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Add Word
          </button>
        </div>

        {generationStatus !== 'idle' && (
        <div className="bg-white rounded-lg border p-3 mb-4">
          <div className="flex items-center text-sm">
            {generationStatus === 'starting' && (
              <>
                <LoaderIcon className="h-4 w-4 mr-2 animate-spin text-blue-600" />
                <span className="text-blue-600">Starting sentence generation...</span>
              </>
            )}
            {generationStatus === 'processing' && (
              <>
                <LoaderIcon className="h-4 w-4 mr-2 animate-spin text-purple-600" />
                <span className="text-purple-600">Generating sentences for words...</span>
              </>
            )}
            {generationStatus === 'completed' && (
              <>
                <CheckCircleIcon className="h-4 w-4 mr-2 text-green-600" />
                <span className="text-green-600">Sentence generation completed successfully!</span>
              </>
            )}
            {generationStatus === 'error' && (
              <>
                <AlertCircleIcon className="h-4 w-4 mr-2 text-red-600" />
                <span className="text-red-600">Sentence generation failed. Please try again.</span>
              </>
            )}
          </div>
        </div>
      )}
      </div>

      {/* Statistics Panel */}
      {showStats && wordStats && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Word Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{wordStats.total_words}</div>
              <div className="text-sm text-blue-600">Total Words</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{wordStats.words_without_translations}</div>
              <div className="text-sm text-yellow-600">Missing Translations</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{wordStats.words_without_images}</div>
              <div className="text-sm text-red-600">Missing Images</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {Math.round(((wordStats.total_words - wordStats.words_without_translations) / wordStats.total_words) * 100)}%
              </div>
              <div className="text-sm text-green-600">Completion Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Server-Side Filters Section */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search words, translations, categories..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {loading && searchTerm && (
              <div className="text-xs text-gray-500 mt-1">Searching...</div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filters.categoryId || ''}
              onChange={(e) => handleFilterChange('categoryId', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {filterOptions.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={filters.wordTypeId || ''}
              onChange={(e) => handleFilterChange('wordTypeId', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Types</option>
              {filterOptions.word_types.map((wordType) => (
                <option key={wordType.id} value={wordType.id}>
                  {wordType.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select
                value={filters.difficultyLevelId || ''}
                onChange={(e) => handleFilterChange('difficultyLevelId', e.target.value ? parseInt(e.target.value) : null)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Levels</option>
                {filterOptions.difficulty_levels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(searchTerm || filters.categoryId || filters.wordTypeId || filters.difficultyLevelId) && (
            <button
              onClick={clearFilters}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedWords.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-blue-900">
                {selectedWords.length} word{selectedWords.length !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={handleBulkDelete}
                className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200"
                disabled={actionLoading}
              >
                Delete Selected
              </button>
            </div>
            <button
              onClick={() => setSelectedWords([])}
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Words Table */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedWords.length === words.length && words.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('kazakh_word')}
                >
                  Word {getSortIcon('kazakh_word')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Media
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" onClick={() => handleSort('translation')}>
                  Translation {getSortIcon('translation')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('category_name')}
                >
                  Category {getSortIcon('category_name')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('word_type_name')}
                >
                  Type {getSortIcon('word_type_name')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('difficulty_level')}
                >
                  Difficulty {getSortIcon('difficulty_level')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && words.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center">
                    <LoadingSpinner />
                    <span className="ml-2 text-gray-600">Loading words...</span>
                  </td>
                </tr>
              ) : (
                words.map((word) => (
                  <WordTableRow
                    key={word.id}
                    word={word}
                    isSelected={selectedWords.includes(word.id)}
                    onSelect={handleSelectWord}
                    onEdit={handleEditWord}
                    onDelete={handleDeleteWord}
                    onManageImages={handleManageImages}
                    onManageSounds={handleManageSounds}
                    onExampleSentences={handleExampleSentencesOpen}
                    getDifficultyColor={getDifficultyColor}
                    getTypeColor={getTypeColor}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1 || loading}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={handleNextPage}
              disabled={!hasMore || loading}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{((currentPage - 1) * pageSize) + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(currentPage * pageSize, totalWords)}
                </span>{' '}
                of <span className="font-medium">{totalWords}</span> results
                {(filters.search || filters.categoryId || filters.wordTypeId || filters.difficultyLevelId) && (
                  <span className="text-blue-600 ml-1">(filtered)</span>
                )}
              </p>
            </div>
            
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1 || loading}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                
                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                  Page {currentPage}
                </span>
                
                <button
                  onClick={handleNextPage}
                  disabled={!hasMore || loading}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {words.length === 0 && !loading && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No words found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || filters.categoryId || filters.wordTypeId || filters.difficultyLevelId
              ? 'No words match your current filters. Try adjusting your search criteria.'
              : 'Get started by adding your first word.'
            }
          </p>
          {(searchTerm || filters.categoryId || filters.wordTypeId || filters.difficultyLevelId) && (
            <div className="mt-6">
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      <WordEditModal
        isOpen={showEditModal}
        onClose={handleEditModalClose}
        wordId={editingWordId}
        onSave={handleEditModalSave}
      />

      {/* Media Management Modals */}
      <WordImagesManager
        isOpen={showImagesModal}
        onClose={handleMediaModalClose}
        word={selectedWordForMedia ? {
          id: selectedWordForMedia.id,
          kazakh_word: selectedWordForMedia.kazakh_word,
          kazakh_cyrillic: selectedWordForMedia.kazakh_cyrillic
        } : null}
      />

      <WordSoundsManager
        isOpen={showSoundsModal}
        onClose={handleMediaModalClose}
        word={selectedWordForMedia ? {
          id: selectedWordForMedia.id,
          kazakh_word: selectedWordForMedia.kazakh_word,
          kazakh_cyrillic: selectedWordForMedia.kazakh_cyrillic
        } : null}
      />

      {/* Add Word Modal */}
      <AddWordModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddWordSave}
      />
      
      <ExampleSentencesModal
        isOpen={showExampleSentencesModal}
        onClose={handleExampleSentencesClose}
        wordId={selectedWordForSentences?.id || null}
        wordInfo={selectedWordForSentences ? {
          kazakh_word: selectedWordForSentences.kazakh_word,
          kazakh_cyrillic: selectedWordForSentences.kazakh_cyrillic
        } : null}
        onSave={handleExampleSentencesSave}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteError(null);
          setForceDelete(false);
        }}
        title="Confirm Delete"
      >
        <div className="space-y-4">
          {!deleteError ? (
            <div>
              <p className="text-gray-900">Are you sure you want to delete this word?</p>
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex">
                  <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-yellow-800">
                      This will also delete all associated media files
                    </h4>
                    <div className="mt-1 text-sm text-yellow-700">
                      <ul className="list-disc list-inside space-y-1">
                        <li>All images for this word</li>
                        <li>All audio files for this word</li>
                        <li>Files will be permanently removed from storage</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">This action cannot be undone.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 mb-2">Cannot Delete Word</h4>
                <p className="text-yellow-700 text-sm mb-3">{deleteError}</p>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="forceDelete"
                    checked={forceDelete}
                    onChange={(e) => setForceDelete(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="forceDelete" className="text-sm text-yellow-700">
                    Force delete (this will remove all user progress and media files for this word)
                  </label>
                </div>
              </div>
              
              {forceDelete && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm font-medium">
                    ⚠️ Warning: This will permanently delete user learning progress and all media files!
                  </p>
                </div>
              )}
            </div>
          )}
          
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteError(null);
                setForceDelete(false);
              }}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteWord}
              disabled={actionLoading || (!!deleteError && !forceDelete)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading ? 'Deleting...' : (deleteError && !forceDelete) ? 'Cannot Delete' : 'Delete Word & Media'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminWordsPage;