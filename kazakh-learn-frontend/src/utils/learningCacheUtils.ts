// src/utils/learningCacheUtils.ts - Утилиты для инвалидации кэша learning-module

import { QueryClient } from '@tanstack/react-query';

/**
 * Инвалидация всех кэшей связанных с learning module после добавления слов из Guide
 */
export const invalidateLearningModuleCaches = async (queryClient: QueryClient) => {
  // Основные кэши learning-module
  const cachesToInvalidate = [
    ['learning-guides'],
    ['learning-words'], 
    ['learning-progress-all'],
    ['words-not-learned'],
    ['learning-module-data'],
    ['userPreferences'], // Для LearningModulePage
    ['learning-stats'],
    ['words-available'], // Если используется в LearningModulePage
    ['learning-progress'], // Базовый прогресс
  ];

  // Инвалидируем все кэши параллельно
  await Promise.all(
    cachesToInvalidate.map(queryKey => 
      queryClient.invalidateQueries({ queryKey })
    )
  );

  // Также принудительно refetch некоторые критические query
  const criticalQueries = [
    ['words-not-learned'],
    ['learning-progress-all'],
  ];

  await Promise.all(
    criticalQueries.map(queryKey => 
      queryClient.refetchQueries({ queryKey })
    )
  );
};

/**
 * Хук для использования в компонентах
 */
export const useLearningCacheInvalidation = () => {
  const invalidateAllLearningCaches = (queryClient: QueryClient) => {
    return invalidateLearningModuleCaches(queryClient);
  };

  return { invalidateAllLearningCaches };
};