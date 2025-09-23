import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpenIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { learningAPI } from '../../services/learningAPI';
import api from '../../services/api';
import LoadingSpinner from '../ui/LoadingSpinner';
import type { LearningStats } from '../../types/api';

interface WordsAvailableBreakdownProps {
  className?: string;
}

const WordsAvailableBreakdown: React.FC<WordsAvailableBreakdownProps> = ({ 
  className = '' 
}) => {
  const { t } = useTranslation('wordsAvailable');
  
  const {
    data: stats,
    isLoading,
    error,
    isError,
    refetch
  } = useQuery<LearningStats>({
    queryKey: ['learning-stats-real'],
    queryFn: async () => {
      console.log('🚀 Используем правильный API клиент');
      // Используем настроенный API клиент из проекта
      const response = await api.get('/learning/stats');
      console.log('📊 Получили правильные данные через api.get:', response.data);
      return response.data;
    },
  });

  // Дебаг: покажем что получили
  React.useEffect(() => {
    console.log('📈 WordsAvailableBreakdown stats:', stats);
    console.log('🔄 isLoading:', isLoading);
    console.log('❌ isError:', isError);
  }, [stats, isLoading, isError]);

  if (isLoading) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 border border-gray-200 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <BookOpenIcon className="h-5 w-5 mr-2 text-green-500" />
          {t('wordsAvailable.title')}
        </h3>
        <div className="flex justify-center items-center py-8">
          <LoadingSpinner size="md" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 border border-gray-200 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <BookOpenIcon className="h-5 w-5 mr-2 text-green-500" />
          {t('wordsAvailable.title')}
        </h3>
        <div className="text-center py-4">
          <p className="text-red-500 mb-2">Ошибка загрузки данных</p>
          <p className="text-gray-500 text-sm">
            {error instanceof Error ? error.message : 'Неизвестная ошибка'}
          </p>
        </div>
      </div>
    );
  }

  const wordsAvailable = stats?.words_by_status;
  const totalWords = stats?.total_words || 0;
  
  // Безопасно получаем статусы из Record<string, number>
  const wantToLearn = wordsAvailable?.['want_to_learn'] || 0;
  const learning = wordsAvailable?.['learning'] || 0;
  const review = wordsAvailable?.['review'] || 0;
  const learned = wordsAvailable?.['learned'] || 0;
  const mastered = wordsAvailable?.['mastered'] || 0;
  
  // Вычисляем общее количество слов доступных для изучения
  const totalAvailable = wantToLearn + learning + review;
    
  // Проверяем, есть ли вообще какие-то слова в системе
  const hasAnyWords = totalWords > 0;
  const hasWordsInProgress = totalAvailable > 0;

  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 border border-gray-200 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
        <div className="flex items-center">
          <BookOpenIcon className="h-5 w-5 mr-2 text-green-500" />
          {t('wordsAvailable.title')}
        </div>
        <button 
          onClick={() => refetch()}
          className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          🔄 Обновить
        </button>
      </h3>
      
      {wordsAvailable && hasAnyWords ? (
        <div className="space-y-4">
          {/* Только показываем секции со словами для изучения, если они есть */}
          {hasWordsInProgress && (
            <>
              {/* Хочу изучать */}
              {wantToLearn > 0 && (
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="text-blue-700 font-medium">
                    {t('wordsAvailable.wantToLearn')}
                  </span>
                  <span className="font-bold text-blue-900">
                    {wantToLearn}
                  </span>
                </div>
              )}
              
              {/* Изучаю */}
              {learning > 0 && (
                <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                  <span className="text-yellow-700 font-medium">
                    {t('wordsAvailable.learning')}
                  </span>
                  <span className="font-bold text-yellow-900">
                    {learning}
                  </span>
                </div>
              )}
              
              {/* На повторение */}
              {review > 0 && (
                <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                  <span className="text-orange-700 font-medium">
                    {t('wordsAvailable.review')}
                  </span>
                  <span className="font-bold text-orange-900">
                    {review}
                  </span>
                </div>
              )}

              {/* Итого доступно для изучения */}
              <div className="flex justify-between items-center p-3 bg-gray-100 rounded-lg border-2 border-gray-300">
                <span className="text-gray-700 font-semibold">
                  {t('wordsAvailable.total')}
                </span>
                <span className="font-bold text-gray-900 text-lg">
                  {totalAvailable}
                </span>
              </div>
            </>
          )}

          {/* Выученные слова - показываем всегда если есть */}
          {learned > 0 && (
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-green-700 font-medium">Выученные</span>
              <span className="font-bold text-green-900">
                {learned}
              </span>
            </div>
          )}

          {/* Освоенные слова - показываем всегда если есть */}
          {mastered > 0 && (
            <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
              <span className="text-purple-700 font-medium">Освоенные</span>
              <span className="font-bold text-purple-900">
                {mastered}
              </span>
            </div>
          )}

          {/* Общее количество слов в системе */}
          <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg border border-indigo-200">
            <span className="text-indigo-700 font-medium">Всего слов</span>
            <span className="font-bold text-indigo-900">
              {totalWords}
            </span>
          </div>

          {/* Если нет слов для изучения, но есть выученные - показываем сообщение */}
          {!hasWordsInProgress && (learned > 0 || mastered > 0) && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-yellow-800 text-sm text-center">
                У вас есть выученные слова, но нет новых для изучения. 
                Добавьте новые слова из каталога!
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="mb-4">
            <BookOpenIcon className="h-12 w-12 text-gray-300 mx-auto" />
          </div>
          {!hasAnyWords ? (
            <>
              <p className="text-gray-500 mb-2">
                В системе пока нет слов
              </p>
              <p className="text-sm text-gray-400">
                Обратитесь к администратору для добавления словаря
              </p>
            </>
          ) : (
            <>
              <p className="text-gray-500 mb-2">
                {t('wordsAvailable.noWordsAvailable')}
              </p>
              <p className="text-sm text-gray-400">
                Начните добавлять слова в изучение!
              </p>
            </>
          )}
        </div>
      )}

      {/* Дополнительная информация из API */}
      {stats && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-gray-900">
                {stats.accuracy_rate ? `${stats.accuracy_rate}%` : 'N/A'}
              </div>
              <div className="text-gray-500">Точность</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">
                {stats.current_streak || 0}
              </div>
              <div className="text-gray-500">Текущая серия</div>
            </div>
          </div>
          
          {/* Дополнительная статистика */}
          {stats.sessions_this_week > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="text-center text-sm">
                <div className="font-semibold text-gray-900">
                  {stats.sessions_this_week}
                </div>
                <div className="text-gray-500">Сессий на этой неделе</div>
              </div>
            </div>
          )}
          
          {/* Статистика правильных ответов */}
          {stats.total_seen > 0 && (
            <div className="mt-3 text-xs text-gray-500 text-center">
              Правильных ответов: {stats.total_correct} из {stats.total_seen}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WordsAvailableBreakdown;