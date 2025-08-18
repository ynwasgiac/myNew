// src/components/learning/WeeklyProgress.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';

interface WeeklyProgressData {
  weekly_goal: number;
  sessions_completed_this_week: number;
  progress_percentage: number;
  goal_reached: boolean;
  sessions_remaining: number;
  week_start_date: string;
  week_end_date: string;
  session_analytics?: {
    [key: string]: {
      session_count: number;
      average_accuracy: number;
      average_duration_seconds: number;
      total_questions: number;
    };
  };
}

const WeeklyProgress: React.FC = () => {
  const { t } = useTranslation('learning');

  // Fetch weekly progress from API
  const { 
    data: progressData, 
    isLoading, 
    error 
  } = useQuery<WeeklyProgressData>({
    queryKey: ['weekly-progress'],
    queryFn: async (): Promise<WeeklyProgressData> => {
      try {
        const response = await api.get('/learning-module/user/weekly-progress');
        return response.data;
      } catch (error) {
        console.error('Failed to fetch weekly progress:', error);
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
            <CalendarDaysIcon className="h-6 w-6 mr-2 text-green-500" />
            {t('weeklyProgress.title', { defaultValue: 'Weekly Practice Goal' })}
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
            <CalendarDaysIcon className="h-6 w-6 mr-2 text-green-500" />
            {t('weeklyProgress.title', { defaultValue: 'Weekly Practice Goal' })}
          </h2>
        </div>
        <p className="text-gray-500 text-sm">
          {t('errors.failedToLoadWeeklyProgress', { defaultValue: 'Failed to load weekly progress data' })}
        </p>
      </div>
    );
  }

  const { 
    sessions_completed_this_week, 
    weekly_goal, 
    progress_percentage, 
    goal_reached,
    sessions_remaining,
    week_start_date,
    week_end_date,
    session_analytics
  } = progressData;

  // Format dates for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Calculate total sessions from analytics
  const totalSessionsFromAnalytics = session_analytics 
    ? Object.values(session_analytics).reduce((sum, analytics) => sum + analytics.session_count, 0)
    : 0;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <CalendarDaysIcon className="h-6 w-6 mr-2 text-green-500" />
          {t('weeklyProgress.title', { defaultValue: 'Weekly Practice Goal' })}
        </h2>
        <span className="text-sm text-gray-600">
          {sessions_completed_this_week}/{weekly_goal}
        </span>
      </div>
      
      <div className="space-y-3">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              goal_reached 
                ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                : 'bg-gradient-to-r from-green-400 to-green-600'
            }`}
            style={{ width: `${Math.min(progress_percentage, 100)}%` }}
          />
        </div>
        
        <div className="flex justify-between text-sm text-gray-600">
          <span>
            {goal_reached 
              ? t('weeklyProgress.goalReached', { defaultValue: 'Weekly goal reached! 🎉' }) 
              : t('weeklyProgress.inProgress', { defaultValue: 'In progress' })
            }
          </span>
          <span>{Math.round(progress_percentage)}%</span>
        </div>

        {/* Week Date Range */}
        <div className="text-xs text-gray-500 text-center">
          {t('weeklyProgress.weekRange', { 
            defaultValue: `Week: ${formatDate(week_start_date)} - ${formatDate(week_end_date)}`,
            startDate: formatDate(week_start_date),
            endDate: formatDate(week_end_date)
          })}
        </div>

        {/* Sessions Breakdown */}
        {session_analytics && Object.keys(session_analytics).length > 0 && (
          <div className="mt-3 p-3 bg-green-50 rounded-lg">
            <div className="text-sm font-medium text-green-800 mb-2">
              {t('weeklyProgress.sessionBreakdown', { defaultValue: 'Session Breakdown' })}
            </div>
            <div className="space-y-1">
              {Object.entries(session_analytics).map(([sessionType, analytics]) => (
                <div key={sessionType} className="flex justify-between text-xs text-green-700">
                  <span className="capitalize">
                    {sessionType.replace('_', ' ')}: {analytics.session_count}
                  </span>
                  <span>
                    {Math.round(analytics.average_accuracy)}% avg accuracy
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Goal Status Messages */}
        {goal_reached ? (
          <div className="mt-3 p-3 bg-green-50 rounded-lg">
            <div className="flex items-center text-green-700">
              <div className="text-lg mr-2">🎯</div>
              <span className="text-sm font-medium">
                {t('weeklyProgress.goalComplete', { defaultValue: 'Weekly practice goal completed!' })}
              </span>
            </div>
          </div>
        ) : sessions_remaining > 0 ? (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center text-blue-700">
              <div className="text-lg mr-2">💪</div>
              <span className="text-sm font-medium">
                {t('weeklyProgress.sessionsRemaining', { 
                  defaultValue: `${sessions_remaining} more sessions to reach your weekly goal`,
                  count: sessions_remaining
                })}
              </span>
            </div>
          </div>
        ) : null}

        {/* Encouragement for new week */}
        {sessions_completed_this_week === 0 && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center text-gray-700">
              <div className="text-lg mr-2">🚀</div>
              <span className="text-sm font-medium">
                {t('weeklyProgress.getStarted', { defaultValue: 'Start your week strong! Complete your first session.' })}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeeklyProgress;