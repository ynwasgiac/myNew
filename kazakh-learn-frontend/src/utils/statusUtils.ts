// src/utils/statusUtils.ts - Утилиты для работы со статусами

import { LEARNING_STATUSES, type LearningStatus } from '../types/learning';

// Маппинг между фронтендом и бэкендом
export const STATUS_MAPPING = {
  // Фронтенд -> Бэкенд
  toBackend: {
    [LEARNING_STATUSES.WANT_TO_LEARN]: 'want_to_learn',
    [LEARNING_STATUSES.LEARNING]: 'learning', 
    [LEARNING_STATUSES.LEARNED]: 'learned',
    [LEARNING_STATUSES.MASTERED]: 'mastered',
    [LEARNING_STATUSES.REVIEW]: 'review',
  } as const,
  
  // Бэкенд -> Фронтенд
  fromBackend: {
    'want_to_learn': LEARNING_STATUSES.WANT_TO_LEARN,
    'learning': LEARNING_STATUSES.LEARNING,
    'learned': LEARNING_STATUSES.LEARNED,
    'mastered': LEARNING_STATUSES.MASTERED,
    'review': LEARNING_STATUSES.REVIEW,
  } as const
};

// Функции-утилиты
export const mapStatusToBackend = (status: LearningStatus): string => {
  return STATUS_MAPPING.toBackend[status] || status;
};

export const mapStatusFromBackend = (status: string): LearningStatus => {
  return STATUS_MAPPING.fromBackend[status as keyof typeof STATUS_MAPPING.fromBackend] || status as LearningStatus;
};

// Проверки статусов
export const isLearnedStatus = (status: LearningStatus): boolean => {
  return status === LEARNING_STATUSES.LEARNED || status === LEARNING_STATUSES.MASTERED;
};

export const getStatusDisplayName = (status: LearningStatus, t: (key: string) => string): string => {
  const statusKeys = {
    [LEARNING_STATUSES.WANT_TO_LEARN]: 'status.wantToLearn',
    [LEARNING_STATUSES.LEARNING]: 'status.learning',
    [LEARNING_STATUSES.LEARNED]: 'status.learned',
    [LEARNING_STATUSES.MASTERED]: 'status.mastered',
    [LEARNING_STATUSES.REVIEW]: 'status.review',
  };
  
  return t(statusKeys[status]) || status;
};

export const getStatusColor = (status: LearningStatus): string => {
  const statusColors = {
    [LEARNING_STATUSES.WANT_TO_LEARN]: 'bg-blue-100 text-blue-800',
    [LEARNING_STATUSES.LEARNING]: 'bg-yellow-100 text-yellow-800',
    [LEARNING_STATUSES.LEARNED]: 'bg-green-100 text-green-800',
    [LEARNING_STATUSES.MASTERED]: 'bg-purple-100 text-purple-800',
    [LEARNING_STATUSES.REVIEW]: 'bg-orange-100 text-orange-800',
  };
  
  return statusColors[status] || 'bg-gray-100 text-gray-800';
};

// Константы для валидации
export const VALID_STATUSES: LearningStatus[] = [
  LEARNING_STATUSES.WANT_TO_LEARN,
  LEARNING_STATUSES.LEARNING,
  LEARNING_STATUSES.LEARNED,
  LEARNING_STATUSES.MASTERED,
  LEARNING_STATUSES.REVIEW,
];

export const LEARNED_STATUSES: LearningStatus[] = [
  LEARNING_STATUSES.LEARNED,
  LEARNING_STATUSES.MASTERED,
];

export const IN_PROGRESS_STATUSES: LearningStatus[] = [
  LEARNING_STATUSES.WANT_TO_LEARN,
  LEARNING_STATUSES.LEARNING,
  LEARNING_STATUSES.REVIEW,
];