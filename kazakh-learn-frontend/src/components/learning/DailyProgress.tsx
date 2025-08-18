import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';

interface DailyProgressData {
  daily_goal: number;
  words_learned_today: number;
  sessions_completed_today: number;
  progress_percentage: number;
  goal_reached: boolean;
  words_remaining: number;
}

const DailyProgress: React.FC = () => {
  const { t } = useTranslation('learning');

  // Fetch daily progress from API
  const { 
    data: progressData, 
    isLoading, 
    error 
  } = useQuery<DailyProgressData>({
    queryKey: ['daily-progress'],
    queryFn: async (): Promise<DailyProgressData> => {
      try {
        const response = await api.get('/learning-module/user/daily-progress');
        return response.data;
      } catch (error) {
        console.error('Failed to fetch daily progress:', error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <TrophyIcon className="h-6 w-6 mr-2 text-yellow-500" />
            {t('dailyProgress.title')}
          </h2>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="w-full bg-gray-200 rounded-full h-3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error || !progressData) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <TrophyIcon className="h-6 w-6 mr-2 text-yellow-500" />
            {t('dailyProgress.title')}
          </h2>
        </div>
        <p className="text-gray-500 text-sm">
          {t('errors.failedToLoadProgress', { defaultValue: 'Failed to load progress data' })}
        </p>
      </div>
    );
  }

  const { 
    words_learned_today, 
    daily_goal, 
    progress_percentage, 
    goal_reached,
    sessions_completed_today 
  } = progressData;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <TrophyIcon className="h-6 w-6 mr-2 text-yellow-500" />
          {t('dailyProgress.title')}
        </h2>
        <span className="text-sm text-gray-600">
          {words_learned_today}/{daily_goal}
        </span>
      </div>
      
      <div className="space-y-3">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              goal_reached 
                ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                : 'bg-gradient-to-r from-blue-500 to-blue-600'
            }`}
            style={{ width: `${Math.min(progress_percentage, 100)}%` }}
          />
        </div>
        
        <div className="flex justify-between text-sm text-gray-600">
          <span>
            {goal_reached 
              ? t('dailyProgress.goalReached', { defaultValue: 'Goal reached! 🎉' }) 
              : t('dailyProgress.inProgress', { defaultValue: 'In progress' })
            }
          </span>
          <span>{Math.round(progress_percentage)}%</span>
        </div>

        {sessions_completed_today > 0 && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center text-blue-700">
              <div className="text-lg mr-2">📚</div>
              <span className="text-sm font-medium">
                {sessions_completed_today} {t('dailyProgress.sessionsCompleted', { 
                  defaultValue: 'sessions completed today',
                  count: sessions_completed_today 
                })}
              </span>
            </div>
          </div>
        )}

        {goal_reached && (
          <div className="mt-3 p-3 bg-green-50 rounded-lg">
            <div className="flex items-center text-green-700">
              <div className="text-lg mr-2">🎯</div>
              <span className="text-sm font-medium">
                {t('dailyProgress.goalComplete', { defaultValue: 'Daily goal completed!' })}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyProgress;