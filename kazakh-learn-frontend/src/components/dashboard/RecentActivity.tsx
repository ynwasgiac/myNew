// src/components/dashboard/RecentActivity.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { 
  ClockIcon, 
  AcademicCapIcon,
  TrophyIcon,
  BookOpenIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { learningAPI } from '../../services/api';
import LoadingSpinner from '../ui/LoadingSpinner';

const RecentActivity: React.FC = () => {
  const { t } = useTranslation('recentActivity');

  // Fetch recent learning sessions
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['recent-sessions'],
    queryFn: () => learningAPI.getSessions(10, 0),
  });

  const getActivityIcon = (sessionType: string) => {
    switch (sessionType.toLowerCase()) {
      case 'practice':
        return <AcademicCapIcon className="h-5 w-5 text-blue-600" />;
      case 'quiz':
        return <TrophyIcon className="h-5 w-5 text-purple-600" />;
      case 'review':
        return <ClockIcon className="h-5 w-5 text-orange-600" />;
      default:
        return <BookOpenIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const getActivityColor = (sessionType: string) => {
    switch (sessionType.toLowerCase()) {
      case 'practice':
        return 'bg-blue-50 border-blue-200';
      case 'quiz':
        return 'bg-purple-50 border-purple-200';
      case 'review':
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getSessionTypeLabel = (sessionType: string) => {
    const type = sessionType.toLowerCase();
    return t(`sessionTypes.${type}`, { defaultValue: sessionType });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return t('sessionInfo.duration.unknown');
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return t('sessionInfo.duration.minutesSeconds', { 
        minutes, 
        seconds: remainingSeconds 
      });
    }
    return t('sessionInfo.duration.seconds', { seconds: remainingSeconds });
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      if (diffInMinutes < 1) {
        return t('timeAgo.justNow');
      }
      return t('timeAgo.minutesAgo', { count: diffInMinutes, minutes: diffInMinutes });
    } else if (diffInHours < 24) {
      return t('timeAgo.hoursAgo', { count: diffInHours, hours: diffInHours });
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return t('timeAgo.daysAgo', { count: diffInDays, days: diffInDays });
    }
  };

  const formatWordsCount = (count: number) => {
    return t('sessionInfo.words', { count });
  };

  const formatAccuracy = (rate: number) => {
    return t('sessionInfo.accuracy', { rate: Math.round(rate) });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('title')}</h3>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{t('title')}</h3>
        <ClockIcon className="h-5 w-5 text-gray-400" />
      </div>

      {/* Activity List */}
      {sessions && sessions.length > 0 ? (
        <div className="space-y-4">
          {sessions.slice(0, 5).map((session) => (
            <div
              key={session.id}
              className={`p-4 rounded-lg border ${getActivityColor(session.session_type)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {getActivityIcon(session.session_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900">
                      {getSessionTypeLabel(session.session_type)} {t('sessionTypes.session')}
                    </h4>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="text-xs text-gray-600">
                        {formatWordsCount(session.words_studied)}
                      </span>
                      <span className="text-xs text-gray-600">
                        {formatDuration(session.duration_seconds)}
                      </span>
                      {session.accuracy_rate !== undefined && (
                        <span className="text-xs text-gray-600">
                          {formatAccuracy(session.accuracy_rate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end space-y-1">
                  <span className="text-xs text-gray-500">
                    {getTimeAgo(session.started_at)}
                  </span>
                  
                  {/* Score indicators */}
                  {session.correct_answers > 0 && session.incorrect_answers > 0 && (
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        <CheckCircleIcon className="h-3 w-3 text-green-500" />
                        <span className="text-xs text-green-600">{session.correct_answers}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <XCircleIcon className="h-3 w-3 text-red-500" />
                        <span className="text-xs text-red-600">{session.incorrect_answers}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Session completed indicator */}
              {session.finished_at && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{t('sessionStatus.completed')}</span>
                    <span>{new Date(session.finished_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Show more sessions link */}
          {sessions.length > 5 && (
            <div className="text-center pt-2">
              <button className="text-sm text-blue-600 hover:text-blue-700">
                {t('actions.viewAll')}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="bg-gray-100 p-3 rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center">
            <AcademicCapIcon className="h-6 w-6 text-gray-400" />
          </div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">{t('noActivity.title')}</h4>
          <p className="text-gray-600 mb-4">
            {t('noActivity.description')}
          </p>
          <button className="btn-primary text-sm">
            {t('actions.startLearning')}
          </button>
        </div>
      )}

      {/* Activity Summary */}
      {sessions && sessions.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {sessions.reduce((total, session) => total + session.words_studied, 0)}
              </div>
              <div className="text-xs text-gray-600">{t('summary.wordsStudied')}</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-green-600">
                {sessions.reduce((total, session) => total + session.correct_answers, 0)}
              </div>
              <div className="text-xs text-gray-600">{t('summary.correct')}</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-blue-600">
                {sessions.length}
              </div>
              <div className="text-xs text-gray-600">{t('summary.sessions')}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecentActivity;