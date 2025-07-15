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
    }
  });

  const handleStatusChange = (wordId: number, newStatus: LearningStatus) => {
    updateStatusMutation.mutate({ wordId, status: newStatus });
  };

  const handleToggleFavorite = (wordId: number, currentlyFavorite: boolean) => {
    toggleFavoriteMutation.mutate({ 
      wordId, 
      isFavorite: !currentlyFavorite 
    });
  };

  const handleResetToLearning = (wordId: number) => {
    handleStatusChange(wordId, LEARNING_STATUSES.LEARNING);
  };

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

  const stats = {
    total: learnedWords?.length || 0,
    learned: learnedWords?.filter(w => w.status === LEARNING_STATUSES.LEARNED).length || 0,
    mastered: learnedWords?.filter(w => w.status === LEARNING_STATUSES.MASTERED).length || 0,
    favorites: learnedWords?.filter(w => w.user_notes?.includes('favorite')).length || 0
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text={t('loading.learnedWords')} />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">😕</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t('errors.loadingFailed')}
        </h2>
        <p className="text-gray-600">{t('errors.tryAgain')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Заголовок */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="w-8 h-8 text-yellow-500" />
          <h1 className="text-3xl font-bold text-gray-900">
            {t('learnedWords.title')}
          </h1>
        </div>
        <p className="text-gray-600">
          {t('learnedWords.description')}
        </p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-sm text-blue-600">{t('stats.totalLearned')}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{stats.learned}</div>
          <div className="text-sm text-green-600">{t('stats.learned')}</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">{stats.mastered}</div>
          <div className="text-sm text-purple-600">{t('stats.mastered')}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">{stats.favorites}</div>
          <div className="text-sm text-yellow-600">{t('stats.favorites')}</div>
        </div>
      </div>

      {/* Фильтры */}
      <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Поиск */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={t('search.placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Фильтр статуса */}
          <select
            value={selectedStatus || ''}
            onChange={(e) => setSelectedStatus((e.target.value as LearningStatus) || undefined)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('filters.allStatuses')}</option>
            <option value="learned">{t('status.learned')}</option>
            <option value="mastered">{t('status.mastered')}</option>
          </select>

          {/* Показать только избранные */}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              showFavoritesOnly
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
            }`}
          >
            <Star className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
            {t('filters.favoritesOnly')}
          </button>
        </div>
      </div>

      {/* Список слов */}
      {filteredWords.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {showFavoritesOnly 
              ? t('learnedWords.noFavorites')
              : t('learnedWords.noWords')
            }
          </h3>
          <p className="text-gray-600">
            {showFavoritesOnly
              ? t('learnedWords.addFavoritesHint')
              : t('learnedWords.startLearningHint')
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWords.map((wordProgress) => {
            const word = wordProgress.kazakh_word;
            const isFavorite = wordProgress.user_notes?.includes('favorite') || false;
            
            return (
              <div key={wordProgress.id} className="bg-white rounded-lg shadow-sm border p-6">
                {/* Заголовок слова */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      {word?.kazakh_word}
                    </h3>
                    {word?.kazakh_cyrillic && (
                      <p className="text-gray-600 mb-2">{word.kazakh_cyrillic}</p>
                    )}
                    <p className="text-blue-600 font-medium">
                      {word?.translations?.[0]?.translation}
                    </p>
                  </div>
                  
                  {/* Кнопка избранного */}
                  <button
                    onClick={() => handleToggleFavorite(wordProgress.kazakh_word_id, isFavorite)}
                    className={`p-2 rounded-full transition-colors ${
                      isFavorite
                        ? 'text-yellow-500 hover:text-yellow-600'
                        : 'text-gray-400 hover:text-yellow-500'
                    }`}
                    disabled={toggleFavoriteMutation.isPending}
                  >
                    {isFavorite ? (
                      <Star className="w-5 h-5 fill-current" />
                    ) : (
                      <StarOff className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {/* Статистика */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm text-gray-600">{t('stats.timesSeen')}</div>
                    <div className="text-lg font-semibold">{wordProgress.times_seen}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm text-gray-600">{t('stats.accuracy')}</div>
                    <div className="text-lg font-semibold">
                      {wordProgress.times_seen > 0 
                        ? Math.round((wordProgress.times_correct / wordProgress.times_seen) * 100)
                        : 0}%
                    </div>
                  </div>
                </div>

                {/* Статус */}
                <div className="mb-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(wordProgress.status)}`}>
                    {wordProgress.status === LEARNING_STATUSES.MASTERED
                      ? t('status.mastered') 
                      : t('status.learned')
                    }
                  </span>
                </div>

                {/* Действия */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResetToLearning(wordProgress.kazakh_word_id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
                    disabled={updateStatusMutation.isPending}
                  >
                    <RotateCcw className="w-4 h-4" />
                    {t('actions.reviewAgain')}
                  </button>
                  
                  {wordProgress.status === LEARNING_STATUSES.LEARNED && (
                    <button
                      onClick={() => handleStatusChange(wordProgress.kazakh_word_id, LEARNING_STATUSES.MASTERED)}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-50 text-purple-600 rounded-md hover:bg-purple-100 transition-colors"
                      disabled={updateStatusMutation.isPending}
                    >
                      <Trophy className="w-4 h-4" />
                      {t('actions.markMastered')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


export default LearnedWordsPage;