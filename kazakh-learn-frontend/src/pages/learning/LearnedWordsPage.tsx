// src/pages/learning/LearnedWordsPage.tsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Star, StarOff, RotateCcw, BookOpen, Trophy, Search, Filter } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { learningAPI } from '../../services/learningAPI';
import type { UserWordProgressWithWord } from '../../types/api';
import type { LearningStatus } from '../../types/learning';
import { LEARNING_STATUSES, LEARNED_STATUSES } from '../../types/learning';
import { getStatusColor } from '../../utils/statusUtils';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const LearnedWordsPage: React.FC = () => {
  const { t } = useTranslation(['learning', 'common']);
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<LearningStatus | undefined>(undefined);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Получаем изученные и освоенные слова
  const { data: learnedWords, isLoading, error } = useQuery({
    queryKey: ['learned-words', searchTerm, selectedCategory, selectedStatus],
    queryFn: () => learningAPI.getProgress({
      status: selectedStatus,
      category_id: selectedCategory,
      limit: 100,
      offset: 0
    }),
    select: (data) => data?.filter(word => 
      LEARNED_STATUSES.includes(word.status as LearningStatus)
    ) || []
  });

  // Мутация для изменения статуса слова
  const updateStatusMutation = useMutation({
    mutationFn: ({ wordId, status }: { wordId: number; status: LearningStatus }) =>
      learningAPI.updateWordProgress(wordId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learned-words'] });
      queryClient.invalidateQueries({ queryKey: ['learning-stats'] });
      toast.success(t('messages.statusUpdated'));
    },
    onError: () => {
      toast.error(t('errors.statusUpdateFailed'));
    }
  });

  // Мутация для добавления в избранное (можно использовать заметки)
  const toggleFavoriteMutation = useMutation({
    mutationFn: ({ wordId, isFavorite }: { wordId: number; isFavorite: boolean }) =>
      learningAPI.updateWordProgress(wordId, { 
        user_notes: isFavorite ? 'favorite' : '' 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learned-words'] });
      toast.success(t('messages.favoriteUpdated'));
    },
    onError: () => {
      toast.error(t('errors.favoriteUpdateFailed'));
    }
  });

  // Фильтруем слова по поиску и избранному
  const filteredWords = learnedWords?.filter(word => {
    const matchesSearch = !searchTerm || 
      word.kazakh_word?.kazakh_word?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      word.kazakh_word?.translations?.some(t => 
        t.translation.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    const matchesFavorites = !showFavoritesOnly || 
      word.user_notes?.includes('favorite');
    
    return matchesSearch && matchesFavorites;
  }) || [];

  // Статистика по изученным словам
  const stats = {
    total: filteredWords.length,
    learned: filteredWords.filter(w => w.status === LEARNING_STATUSES.LEARNED).length,
    mastered: filteredWords.filter(w => w.status === LEARNING_STATUSES.MASTERED).length,
    favorites: filteredWords.filter(w => w.user_notes?.includes('favorite')).length,
  };

  const handleStatusChange = (wordId: number, newStatus: LearningStatus) => {
    updateStatusMutation.mutate({ wordId, status: newStatus });
  };

  const handleToggleFavorite = (wordId: number, isFavorite: boolean) => {
    toggleFavoriteMutation.mutate({ wordId, isFavorite: !isFavorite });
  };

  const handleResetToLearning = (wordId: number) => {
    updateStatusMutation.mutate({ wordId, status: LEARNING_STATUSES.LEARNING });
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text={t('loading.learnedWords')} />;
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{t('errors.loadingFailed')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-6 rounded-lg">
        <h1 className="text-2xl font-bold mb-2 flex items-center">
          <Trophy className="h-8 w-8 mr-3" />
          {t('learnedWords.title')}
        </h1>
        <p className="text-green-100">{t('learnedWords.subtitle')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('stats.total')}</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <BookOpen className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('stats.learned')}</p>
              <p className="text-2xl font-bold text-green-600">{stats.learned}</p>
            </div>
            <Trophy className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('stats.mastered')}</p>
              <p className="text-2xl font-bold text-purple-600">{stats.mastered}</p>
            </div>
            <Star className="h-8 w-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('stats.favorites')}</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.favorites}</p>
            </div>
            <Star className="h-8 w-8 text-yellow-500 fill-current" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('search.placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-48">
            <select
              value={selectedStatus || ''}
              onChange={(e) => setSelectedStatus(e.target.value as LearningStatus || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">{t('filters.allStatuses')}</option>
              <option value={LEARNING_STATUSES.LEARNED}>{t('status.learned')}</option>
              <option value={LEARNING_STATUSES.MASTERED}>{t('status.mastered')}</option>
            </select>
          </div>

          {/* Favorites Toggle */}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
              showFavoritesOnly
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
            }`}
          >
            <Star className={`h-4 w-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
            <span>{t('filters.favorites')}</span>
          </button>
        </div>
      </div>

      {/* Words List */}
      <div className="bg-white rounded-lg shadow-sm border">
        {filteredWords.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg text-gray-600 mb-2">{t('learnedWords.noWords')}</p>
            <p className="text-gray-500">{t('learnedWords.noWordsDescription')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredWords.map((wordProgress) => {
              const word = wordProgress.kazakh_word;
              const isFavorite = wordProgress.user_notes?.includes('favorite') || false;
              
              return (
                <div key={wordProgress.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {word?.kazakh_word || 'Unknown'}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(wordProgress.status)}`}>
                          {t(`status.${wordProgress.status}`)}
                        </span>
                        <button
                          onClick={() => handleToggleFavorite(wordProgress.id, isFavorite)}
                          className={`p-1 rounded-full transition-colors ${
                            isFavorite
                              ? 'text-yellow-500 hover:text-yellow-600'
                              : 'text-gray-400 hover:text-yellow-500'
                          }`}
                        >
                          <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-gray-600">
                          <span className="font-medium">{t('common.translation')}:</span>{' '}
                          {word?.translations?.map(t => t.translation).join(', ') || 'No translation'}
                        </p>
                        {word?.kazakh_cyrillic && (
                          <p className="text-gray-600">
                            <span className="font-medium">{t('common.cyrillic')}:</span>{' '}
                            {word.kazakh_cyrillic}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                        <span>{t('stats.correctAnswers')}: {wordProgress.times_correct || 0}</span>
                        <span>{t('stats.totalAttempts')}: {wordProgress.times_seen || 0}</span>
                        <span>{t('stats.incorrectAnswers')}: {wordProgress.times_incorrect || 0}</span>
                        {wordProgress.last_practiced_at && (
                          <span>{t('stats.lastPracticed')}: {new Date(wordProgress.last_practiced_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      {/* Reset to Learning */}
                      <button
                        onClick={() => handleResetToLearning(wordProgress.id)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title={t('actions.resetToLearning')}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>

                      {/* Status Change Dropdown */}
                      <select
                        value={wordProgress.status}
                        onChange={(e) => handleStatusChange(wordProgress.id, e.target.value as LearningStatus)}
                        className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value={LEARNING_STATUSES.LEARNED}>{t('status.learned')}</option>
                        <option value={LEARNING_STATUSES.MASTERED}>{t('status.mastered')}</option>
                        <option value={LEARNING_STATUSES.LEARNING}>{t('status.learning')}</option>
                        <option value={LEARNING_STATUSES.REVIEW}>{t('status.review')}</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LearnedWordsPage;