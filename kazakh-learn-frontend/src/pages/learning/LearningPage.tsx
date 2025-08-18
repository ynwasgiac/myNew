// src/pages/learning/LearningPage.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  AcademicCapIcon,
  BookOpenIcon,
  TrophyIcon,
  ClockIcon,
  ChartBarIcon,
  FireIcon,
  PlayIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

import { learningAPI } from '../../services/learningAPI';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import StatsCard from '../../components/ui/StatsCard';
import WordsToReview from '../../components/dashboard/WordsToReview';
import { ReviewWidget } from '../../components/dashboard/ReviewWidget';
import { useReviewNotifications } from '../../hooks/useReviewNotifications';

const LearningPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation('learning');
  const { notifications, hasOverdue, totalDue } = useReviewNotifications(30);

  // Fetch learning stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['learning-stats'],
    queryFn: learningAPI.getStats,
  });

  // Fetch dashboard data
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: learningAPI.getDashboard,
  });

  const isLoading = statsLoading || dashboardLoading;

  const learningOptions = [
    {
      id: 'new-words',
      title: t('options.newWords.title'),
      description: t('options.newWords.description'),
      icon: BookOpenIcon,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700',
      href: '/app/words',
      action: t('options.newWords.action'),
      info: t('options.newWords.info')
    },
    {
      id: 'practice',
      title: t('options.practice.title'),
      description: t('options.practice.description'),
      icon: AcademicCapIcon,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700',
      href: '/app/practice',
      action: t('options.practice.action'),
      info: t('options.practice.info')
    },
    {
      id: 'review',
      title: t('options.review.title'),
      description: t('options.review.description'),
      icon: ClockIcon,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      textColor: 'text-orange-700',
      href: '/app/practice?type=review',
      action: t('options.review.action'),
      badge: stats?.words_due_review || 0,
      info: stats?.words_due_review && stats.words_due_review > 0 
        ? t('options.review.wordsNeedReview', { count: stats.words_due_review })
        : undefined
    },
    {
      id: 'quiz',
      title: t('options.quiz.title'),
      description: t('options.quiz.description'),
      icon: TrophyIcon,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      textColor: 'text-purple-700',
      href: '/app/quiz',
      action: t('options.quiz.action'),
      info: t('options.quiz.info')
    }
  ];

  const quickStats = [
    {
      title: t('stats.currentStreak'),
      value: stats?.current_streak || 0,
      icon: FireIcon,
      color: 'bg-orange-500',
      suffix: stats?.current_streak === 1 ? t('stats.day') : t('stats.days')
    },
    {
      title: t('stats.wordsLearning'),
      value: stats?.total_words || 0,
      icon: BookOpenIcon,
      color: 'bg-blue-500'
    },
    {
      title: t('stats.accuracyRate'),
      value: `${stats?.accuracy_rate || 0}%`,
      icon: ChartBarIcon,
      color: 'bg-green-500'
    },
    {
      title: t('stats.thisWeek'),
      value: stats?.sessions_this_week || 0,
      icon: AcademicCapIcon,
      color: 'bg-purple-500',
      suffix: t('stats.sessions')
    }
  ];

  // Helper function to get status labels
  const getStatusLabel = (status: string) => {
    const statusLabels: Record<string, string> = {
      'want_to_learn': t('status.wantToLearn'),
      'learning': t('status.learning'),
      'learned': t('status.learned'),
      'mastered': t('status.mastered'),
      'review': t('status.review')
    };
    return statusLabels[status] || status.replace('_', ' ');
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text={t('loading.dashboard')} />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t('header.title', { name: user?.full_name || user?.username })} 🚀
        </h1>
        <p className="text-lg text-gray-600">
          {t('header.subtitle')}
        </p>
      </div>

      {/* Review notification banner */}
      {hasOverdue && (
        <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <span className="font-medium text-orange-800">
              You have {notifications?.overdue} overdue reviews!
            </span>
            <Button 
              size="sm" 
              onClick={() => navigate('/learning/practice?mode=review')}
              className="ml-auto"
            >
              Review Now
            </Button>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div className={`${stat.color} p-2 rounded-lg w-10 h-10 mx-auto mb-2 flex items-center justify-center`}>
              <stat.icon className="h-5 w-5 text-white" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-sm text-gray-600">
              {stat.title}
              {stat.suffix && ` ${stat.suffix}`}
            </div>
          </div>
        ))}
      </div>

      {/* Learning Options */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {learningOptions.map((option) => (
          <div
            key={option.id}
            className={`${option.bgColor} ${option.borderColor} border rounded-xl p-6 hover:shadow-md transition-all duration-200`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`${option.color} p-3 rounded-lg`}>
                  <option.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${option.textColor}`}>
                    {option.title}
                  </h3>
                  <p className="text-gray-600 text-sm mt-1">
                    {option.description}
                  </p>
                </div>
              </div>
              
              {option.badge && option.badge > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {option.badge}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {option.info && (
                  <span className={option.id === 'review' && option.badge && option.badge > 0 ? 'text-orange-600 font-medium' : ''}>
                    {option.info}
                  </span>
                )}
              </div>

              <Link
                to={option.href}
                className={`${option.color} hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2`}
              >
                <PlayIcon className="h-4 w-4" />
                <span>{option.action}</span>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Today's Recommendations */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <AcademicCapIcon className="h-6 w-6 text-blue-600 mr-2" />
          {t('recommendations.title')}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h3 className="font-medium text-gray-900 mb-2">📚 {t('recommendations.learn.title')}</h3>
            <p className="text-sm text-gray-600 mb-3">
              {t('recommendations.learn.description')}
            </p>
            <Link
              to="/app/words"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
            >
              {t('recommendations.learn.action')} <ArrowRightIcon className="h-4 w-4 ml-1" />
            </Link>
          </div>

          <div className="bg-white rounded-lg p-4 border border-green-200">
            <h3 className="font-medium text-gray-900 mb-2">🎯 {t('recommendations.practice.title')}</h3>
            <p className="text-sm text-gray-600 mb-3">
              {t('recommendations.practice.description')}
            </p>
            <Link
              to="/app/practice"
              className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center"
            >
              {t('recommendations.practice.action')} <ArrowRightIcon className="h-4 w-4 ml-1" />
            </Link>
          </div>

          <div className="bg-white rounded-lg p-4 border border-purple-200">
            <h3 className="font-medium text-gray-900 mb-2">🏆 {t('recommendations.test.title')}</h3>
            <p className="text-sm text-gray-600 mb-3">
              {t('recommendations.test.description')}
            </p>
            <Link
              to="/app/quiz"
              className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center"
            >
              {t('recommendations.test.action')} <ArrowRightIcon className="h-4 w-4 ml-1" />
            </Link>
          </div>
        </div>
      </div>

      {/* Learning Progress Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Words to Review */}
        <div className="lg:col-span-2">
          <WordsToReview />
        </div>
        <div className="lg:col-span-2">
          <ReviewWidget />
        </div>

        {/* Learning Status Breakdown */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('statusBreakdown.title')}</h3>
          {stats?.words_by_status ? (
            <div className="space-y-3">
              {Object.entries(stats.words_by_status).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
                    <span className="text-sm text-gray-700">
                      {getStatusLabel(status)}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm">{t('statusBreakdown.noData')}</p>
              <Link
                to="/app/words"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-2 inline-block"
              >
                {t('statusBreakdown.startLearning')}
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('quickActions.title')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/app/categories"
            className="text-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <BookOpenIcon className="h-8 w-8 text-gray-600 mx-auto mb-2" />
            <span className="text-sm font-medium text-gray-900">{t('quickActions.browseCategories')}</span>
          </Link>
          
          <Link
            to="/app/progress"
            className="text-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChartBarIcon className="h-8 w-8 text-gray-600 mx-auto mb-2" />
            <span className="text-sm font-medium text-gray-900">{t('quickActions.viewProgress')}</span>
          </Link>
          
          <Link
            to="/app/practice?type=random"
            className="text-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <PlayIcon className="h-8 w-8 text-gray-600 mx-auto mb-2" />
            <span className="text-sm font-medium text-gray-900">{t('quickActions.randomPractice')}</span>
          </Link>
          
          <Link
            to="/app/settings"
            className="text-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <AcademicCapIcon className="h-8 w-8 text-gray-600 mx-auto mb-2" />
            <span className="text-sm font-medium text-gray-900">{t('quickActions.learningSettings')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

// Helper function to get status colors
const getStatusColor = (status: string) => {
  const colors = {
    'want_to_learn': 'bg-gray-400',
    'learning': 'bg-blue-400',
    'learned': 'bg-green-400',
    'mastered': 'bg-purple-400',
    'review': 'bg-orange-400'
  };
  return colors[status as keyof typeof colors] || 'bg-gray-400';
};

export default LearningPage;