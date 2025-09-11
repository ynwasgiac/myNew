// src/pages/DashboardPage.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpenIcon,
  AcademicCapIcon,
  TrophyIcon,
  FireIcon,
  ClockIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { learningAPI } from '../services/learningAPI';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import StatsCard from '../components/ui/StatsCard';
import RecentActivity from '../components/dashboard/RecentActivity';
import LearningGoals from '../components/dashboard/LearningGoals';
import WordsToReview from '../components/dashboard/WordsToReview';
import WordsAvailableBreakdown from '../components/learning/WordsAvailableBreakdown';
import { BookCheckIcon } from 'lucide-react';

const DashboardPage: React.FC = () => {
  const { t } = useTranslation('dashboard');
  const { user } = useAuth();

  // Fetch dashboard data
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['learning-stats'],
    queryFn: learningAPI.getStats,
  });

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: learningAPI.getDashboard,
  });

  const isLoading = statsLoading || dashboardLoading;

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('greetings.morning');
    if (hour < 18) return t('greetings.afternoon');
    return t('greetings.evening');
  };

  const getStatusLabel = (status: string) => {
    const statusKey = status.toLowerCase().replace(' ', '');
    return t(`learningProgress.statuses.${statusKey}`, { defaultValue: status });
  };

  const quickActions = [
    {
      name: t('quickActions.startLearning.name'),
      description: t('quickActions.startLearning.description'),
      href: '/app/learning-module',
      icon: AcademicCapIcon,
      color: 'bg-blue-500',
    },
    {
      name: t('quickActions.takeQuiz.name'),
      description: t('quickActions.takeQuiz.description'),
      href: '/app/quiz',
      icon: TrophyIcon,
      color: 'bg-green-500',
    },
    {
      name: t('quickActions.reviewWords.name'),
      description: t('quickActions.reviewWords.description'),
      href: '/app/practice',
      icon: ClockIcon,
      color: 'bg-orange-500',
    },
    {
      name: t('quickActions.browseWords.name'),
      description: t('quickActions.browseWords.description'),
      href: '/app/words',
      icon: BookOpenIcon,
      color: 'bg-purple-500',
    },
    {
      name: t('quickActions.browseGuides.name'),
      description: t('quickActions.browseGuides.description'),
      href: '/app/guides',
      icon: BookCheckIcon,
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {getGreeting()}, {user?.full_name || user?.username}! 👋
            </h1>
            <p className="text-blue-100 mt-2">
              {t('welcome.subtitle')}
            </p>
            {user?.main_language && (
              <p className="text-blue-200 text-sm mt-1">
                {t('welcome.learningInterface', { language: user.main_language.language_name })}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="flex items-center space-x-2">
              <FireIcon className="h-6 w-6 text-orange-300" />
              <span className="text-xl font-bold">{stats?.current_streak || 0}</span>
            </div>
            <p className="text-blue-100 text-sm">{t('welcome.dayStreak')}</p>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title={t('stats.totalWords')}
          value={stats?.total_words || 0}
          icon={BookOpenIcon}
          color="bg-blue-500"
        />
        <StatsCard
          title={t('stats.wordsDueReview')}
          value={stats?.words_due_review || 0}
          icon={ClockIcon}
          color="bg-orange-500"
          link="/app/practice?type=review"
          helpEndpoint="/api/documentation/review_intervals/description"
        />
        <StatsCard
          title={t('stats.accuracyRate')}
          value={`${stats?.accuracy_rate || 0}%`}
          icon={ChartBarIcon}
          color="bg-green-500"
        />
        <StatsCard
          title={t('stats.sessionsThisWeek')}
          value={stats?.sessions_this_week || 0}
          icon={AcademicCapIcon}
          color="bg-purple-500"
          link="/app/progress"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('quickActions.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.name}
              to={action.href}
              className="group block p-6 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center space-x-3">
                <div className={`${action.color} p-2 rounded-lg`}>
                  <action.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 group-hover:text-blue-600">
                    {action.name}
                  </h3>
                  <p className="text-sm text-gray-500">{action.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <LearningGoals />
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Sidebar Content */}
        <div className="space-y-6">
          {/* <RecentActivity /> */}
        </div>
        {/* Words to Review */}
        <div className="grid-cols-2">
          {/* <div><WordsToReview /></div> */}
        </div>
        <div className="grid-cols-2">
          {/* Words Available Breakdown */}
          {/* <div><WordsAvailableBreakdown /></div> */}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;