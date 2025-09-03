// src/pages/learning/LearnedWordsPage.tsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Trophy, Search, Eye, EyeOff, ArrowUpDown, ArrowUp, ArrowDown, Filter, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { learningAPI } from '../../services/learningAPI';
import { useAuth } from '../../contexts/AuthContext';
import type { UserWordProgressWithWord } from '../../types/api';
import type { LearningStatus } from '../../types/learning';
import { LEARNED_STATUSES } from '../../types/learning';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface LearnedWord {
  id: number;
  kazakh_word: string;
  translation: string;
  times_correct: number;
  times_incorrect: number;
  last_practiced_at: string | null;
  status: string;
}

const LearnedWordsPage: React.FC = () => {
  const { t } = useTranslation(['learning', 'common']);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showKazakhWord, setShowKazakhWord] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const [sortBy, setSortBy] = useState<'status' | 'times_correct' | 'times_incorrect' | 'last_practiced' | 'kazakh_word'>('status');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Multiple selection state
  const [selectedWords, setSelectedWords] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState<string>('');

  // Mutation for updating word status
  const updateStatusMutation = useMutation({
    mutationFn: ({ wordId, status }: { wordId: number; status: string }) =>
      learningAPI.updateWordProgress(wordId, { status: status as any }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learned-words'] });
      toast.success(t('learnedWords.messages.updateSuccess'));
    },
    onError: () => {
      toast.error(t('learnedWords.messages.updateError'));
    }
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ wordIds, status }: { wordIds: number[]; status: string }) => {
      const results = await Promise.allSettled(
        wordIds.map(wordId => learningAPI.updateWordProgress(wordId, { status: status as any }))
      );
      
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.length - successful;
      
      return { successful, failed, total: results.length };
    },
    onSuccess: ({ successful, failed }) => {
      if (successful > 0) {
        toast.success(t('learnedWords.messages.bulkUpdateSuccess'));
        queryClient.invalidateQueries({ queryKey: ['learned-words'] });
        setSelectedWords([]);
        setBulkAction('');
      }
      if (failed > 0) {
        toast.error(t('learnedWords.messages.bulkUpdateError'));
      }
    },
    onError: () => {
      toast.error(t('learnedWords.messages.bulkUpdateError'));
    }
  });

  const handleStatusChange = (wordId: number, newStatus: string) => {
    updateStatusMutation.mutate({ wordId, status: newStatus });
  };

  const handleWordSelection = (wordId: number) => {
    setSelectedWords(prev => 
      prev.includes(wordId) 
        ? prev.filter(id => id !== wordId)
        : [...prev, wordId]
    );
  };

  const handleSelectAll = () => {
    const currentPageWordIds = filteredAndSortedWords.map((word: LearnedWord) => word.id);
    const allSelected = currentPageWordIds.every((id: number) => selectedWords.includes(id));
    
    if (allSelected) {
      setSelectedWords(prev => prev.filter(id => !currentPageWordIds.includes(id)));
    } else {
      setSelectedWords(prev => Array.from(new Set([...prev, ...currentPageWordIds])));
    }
  };

  const handleBulkAction = () => {
    if (selectedWords.length === 0 || !bulkAction) return;
    
    bulkUpdateMutation.mutate({ 
      wordIds: selectedWords, 
      status: bulkAction 
    });
  };

  // Get user's preferred language or default to English
  const userLanguage = user?.main_language?.language_code || 'en';

  // Получаем изученные и освоенные слова
  const { data: learnedWords, isLoading, error } = useQuery({
    queryKey: ['learned-words', searchTerm, userLanguage],
    queryFn: () => learningAPI.getLearnedWords({
      limit: 1000, // Get all learned words
      include_mastered: true,
      language_code: userLanguage
    }),
    select: (data: any) => {
      // The getLearnedWords API returns an array directly or { words: [] }
      const wordsArray = Array.isArray(data) ? data : (data?.words || []);

      // Transform to simple structure for table
      return wordsArray.map((wordData: any): LearnedWord => {
        // Use the flattened API response structure
        const kazakh = wordData.kazakh_word || 'Unknown';
        const translation = wordData.translation || 'No translation';
        
        return {
          id: wordData.id,
          kazakh_word: kazakh,
          translation,
          times_correct: wordData.times_correct || 0,
          times_incorrect: wordData.times_incorrect || 0,
          last_practiced_at: wordData.last_practiced_at || null,
          status: wordData.status || 'learned'
        };
      });
    }
  });

  // Filter and sort words based on search term, status filter, and sort options
  const filteredAndSortedWords = learnedWords?.filter((word: LearnedWord) => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = word.kazakh_word.toLowerCase().includes(searchLower) ||
                           word.translation.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }
    
    // Status filter
    if (statusFilter !== 'all' && word.status !== statusFilter) {
      return false;
    }
    
    return true;
  }).sort((a: LearnedWord, b: LearnedWord) => {
    let compareValue = 0;
    
    switch (sortBy) {
      case 'status':
        const statusOrder = ['want_to_learn', 'learning', 'learned', 'mastered', 'review'];
        const aIndex = statusOrder.indexOf(a.status);
        const bIndex = statusOrder.indexOf(b.status);
        compareValue = aIndex - bIndex;
        break;
      case 'times_correct':
        compareValue = a.times_correct - b.times_correct;
        break;
      case 'times_incorrect':
        compareValue = a.times_incorrect - b.times_incorrect;
        break;
      case 'last_practiced':
        const aDate = new Date(a.last_practiced_at || 0).getTime();
        const bDate = new Date(b.last_practiced_at || 0).getTime();
        compareValue = aDate - bDate;
        break;
      case 'kazakh_word':
        compareValue = a.kazakh_word.localeCompare(b.kazakh_word);
        break;
      default:
        compareValue = 0;
    }
    
    return sortOrder === 'asc' ? compareValue : -compareValue;
  }) || [];

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: typeof sortBy) => {
    if (sortBy !== field) return <ArrowUpDown className="h-4 w-4 opacity-40" />;
    return sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  // Format date helper
  const formatDate = (dateString: string | null) => {
    if (!dateString) return t('learnedWords.table.never');
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text={t('common:loading')} />;
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{t('common:error')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Trophy className="h-8 w-8 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('learnedWords.title')}
            </h1>
            <p className="text-gray-600">
              {filteredAndSortedWords.length} {t('learnedWords.stats.totalWords')} • {t('common:language')}: {userLanguage.toUpperCase()}
              {statusFilter !== 'all' && (
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {t('common:filteredBy')}: {statusFilter.replace('_', ' ')}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedWords.length > 0 && (
          <div className="flex items-center space-x-3 bg-blue-50 px-4 py-2 rounded-lg border">
            <span className="text-sm font-medium text-blue-900">
              {t('learnedWords.bulkActions.selectedCount', { count: selectedWords.length })}
            </span>
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">{t('learnedWords.bulkActions.bulkUpdate')}</option>
              <option value="want_to_learn">{t('learnedWords.status.wantToLearn')}</option>
              <option value="learning">{t('learnedWords.status.learning')}</option>
              <option value="learned">{t('learnedWords.status.learned')}</option>
              <option value="mastered">{t('learnedWords.status.mastered')}</option>
              <option value="review">{t('learnedWords.status.review')}</option>
            </select>
            <button
              onClick={handleBulkAction}
              disabled={!bulkAction || bulkUpdateMutation.isPending}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {t('common:apply')}
            </button>
            <button
              onClick={() => setSelectedWords([])}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Search Bar and Filter Controls */}
      <div className="flex items-center justify-between space-x-4">
        <div className="flex items-center space-x-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder={t('learnedWords.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">{t('learnedWords.filters.allStatuses')}</option>
              <option value="want_to_learn">{t('learnedWords.status.wantToLearn')}</option>
              <option value="learning">{t('learnedWords.status.learning')}</option>
              <option value="learned">{t('learnedWords.status.learned')}</option>
              <option value="mastered">{t('learnedWords.status.mastered')}</option>
              <option value="review">{t('learnedWords.status.review')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Floating Toggle Buttons */}
      <div className="fixed top-4 right-4 z-50 flex items-center space-x-2">
        <button
          onClick={() => setShowKazakhWord(!showKazakhWord)}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all shadow-lg backdrop-blur-sm ${
            showKazakhWord 
              ? 'bg-blue-100/90 text-blue-700 hover:bg-blue-200/90 border border-blue-200' 
              : 'bg-gray-100/90 text-gray-500 hover:bg-gray-200/90 border border-gray-200'
          }`}
          title={t('learnedWords.filters.showKazakh')}
        >
          {showKazakhWord ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          <span>{t('common:kazakh')}</span>
        </button>
        
        <button
          onClick={() => setShowTranslation(!showTranslation)}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all shadow-lg backdrop-blur-sm ${
            showTranslation 
              ? 'bg-green-100/90 text-green-700 hover:bg-green-200/90 border border-green-200' 
              : 'bg-gray-100/90 text-gray-500 hover:bg-gray-200/90 border border-gray-200'
          }`}
          title={t('learnedWords.filters.showTranslation')}
        >
          {showTranslation ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          <span>{t('common:translation')}</span>
        </button>
      </div>

      {/* Words Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={filteredAndSortedWords.length > 0 && filteredAndSortedWords.every((word: LearnedWord) => selectedWords.includes(word.id))}
                  onChange={handleSelectAll}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </th>
              {showKazakhWord && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('kazakh_word')}
                    className="flex items-center space-x-1 hover:text-gray-700"
                  >
                    <span>{t('learnedWords.table.kazakhWord')}</span>
                    {getSortIcon('kazakh_word')}
                  </button>
                </th>
              )}
              {showTranslation && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('learnedWords.table.translation')}
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('times_correct')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>{t('learnedWords.table.timesCorrect')}</span>
                  {getSortIcon('times_correct')}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('times_incorrect')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>{t('learnedWords.table.timesIncorrect')}</span>
                  {getSortIcon('times_incorrect')}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('last_practiced')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>{t('learnedWords.table.lastPracticed')}</span>
                  {getSortIcon('last_practiced')}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('status')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>{t('learnedWords.table.status')}</span>
                  {getSortIcon('status')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedWords.length === 0 ? (
              <tr>
                <td 
                  colSpan={
                    1 + // checkbox column
                    (showKazakhWord ? 1 : 0) + 
                    (showTranslation ? 1 : 0) + 
                    4
                  } 
                  className="px-6 py-8 text-center text-gray-500"
                >
                  {searchTerm || statusFilter !== 'all' 
                    ? t('learnedWords.messages.noFilteredWords')
                    : t('learnedWords.messages.noWords')
                  }
                </td>
              </tr>
            ) : (
              filteredAndSortedWords.map((word: LearnedWord) => (
                <tr 
                  key={word.id} 
                  className={`hover:bg-gray-50 ${selectedWords.includes(word.id) ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedWords.includes(word.id)}
                      onChange={() => handleWordSelection(word.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </td>
                  {showKazakhWord && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {word.kazakh_word}
                      </div>
                    </td>
                  )}
                  {showTranslation && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-900">
                        {word.translation}
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-green-600 font-semibold">
                      {word.times_correct}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-red-600 font-semibold">
                      {word.times_incorrect}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-gray-600 text-sm">
                      {formatDate(word.last_practiced_at)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={word.status}
                      onChange={(e) => handleStatusChange(word.id, e.target.value)}
                      disabled={updateStatusMutation.isPending}
                      className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="want_to_learn">{t('learnedWords.status.wantToLearn')}</option>
                      <option value="learning">{t('learnedWords.status.learning')}</option>
                      <option value="learned">{t('learnedWords.status.learned')}</option>
                      <option value="mastered">{t('learnedWords.status.mastered')}</option>
                      <option value="review">{t('learnedWords.status.review')}</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      {filteredAndSortedWords.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t('learnedWords.stats.summaryStatistics')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {filteredAndSortedWords.length}
              </div>
              <div className="text-sm text-gray-600">{t('learnedWords.stats.totalWords')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {filteredAndSortedWords.reduce((sum: number, word: LearnedWord) => sum + word.times_correct, 0)}
              </div>
              <div className="text-sm text-gray-600">{t('learnedWords.stats.totalCorrect')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {filteredAndSortedWords.reduce((sum: number, word: LearnedWord) => sum + word.times_incorrect, 0)}
              </div>
              <div className="text-sm text-gray-600">{t('learnedWords.stats.totalIncorrect')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {filteredAndSortedWords.length > 0 
                  ? Math.round(
                      (filteredAndSortedWords.reduce((sum: number, word: LearnedWord) => sum + word.times_correct, 0) / 
                       filteredAndSortedWords.reduce((sum: number, word: LearnedWord) => sum + (word.times_correct + word.times_incorrect), 0)) * 100
                    ) 
                  : 0}%
              </div>
              <div className="text-sm text-gray-600">{t('learnedWords.stats.averageAccuracy')}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearnedWordsPage;