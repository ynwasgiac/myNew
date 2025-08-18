// src/components/dashboard/LearningGoals.tsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { 
  TrophyIcon, 
  PlusIcon,
  CheckCircleIcon,
  ClockIcon,
  BookOpenIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { learningAPI } from '../../services/learningAPI';
import LoadingSpinner from '../ui/LoadingSpinner';
import DailyProgress from '../learning/DailyProgress';
import WeeklyProgress from '../goals/WeeklyProgress';

interface NewGoal {
  goal_type: string;
  target_value: number;
  target_date?: string;
  category_id?: number;
  difficulty_level_id?: number;
}

const LearningGoals: React.FC = () => {
  const { t } = useTranslation('learningGoals');
  const queryClient = useQueryClient();
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoal, setNewGoal] = useState<NewGoal>({
    goal_type: 'weekly_practice',
    target_value: 5,
  });

  // Fetch user's learning goals
  const { data: goals, isLoading } = useQuery({
    queryKey: ['learning-goals'],
    queryFn: () => learningAPI.getProgress(), // You'll need to add a getGoals method
  });

  // Mock goals for demonstration (excluding daily_words since we're using DailyProgress component)
  const mockGoals = [
    {
      id: 3,
      goal_type: 'category_mastery',
      target_value: 50,
      current_value: 50,
      is_completed: true,
      target_date: null,
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const createGoalMutation = useMutation({
    mutationFn: (goalData: NewGoal) => {
      // This would be a real API call
      return Promise.resolve({ ...goalData, id: Date.now(), current_value: 0, is_completed: false });
    },
    onSuccess: () => {
      toast.success(t('messages.goalCreated'));
      queryClient.invalidateQueries({ queryKey: ['learning-goals'] });
      setShowAddGoal(false);
      setNewGoal({ goal_type: 'weekly_practice', target_value: 5 });
    },
    onError: () => {
      toast.error(t('messages.goalCreateFailed'));
    },
  });

  const getGoalIcon = (goalType: string) => {
    switch (goalType) {
      case 'category_mastery':
        return <TrophyIcon className="h-5 w-5 text-purple-600" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const getGoalTitle = (goalType: string) => {
    return t(`goalTypes.${goalType}`, { defaultValue: goalType.replace('_', ' ') });
  };

  const getGoalUnit = (goalType: string) => {
    if (goalType === 'daily_words' || goalType === 'category_mastery') {
      return t('goalUnits.words');
    }
    if (goalType === 'weekly_practice') {
      return t('goalUnits.sessions');
    }
    return '';
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min(100, Math.round((current / target) * 100));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    createGoalMutation.mutate(newGoal);
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
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{t('title')}</h3>
        <button
          onClick={() => setShowAddGoal(!showAddGoal)}
          className="btn-primary text-sm flex items-center space-x-2"
        >
          <PlusIcon className="h-4 w-4" />
          <span>{t('addNewGoal')}</span>
        </button>
      </div>

      {/* Daily Progress Section - Always shown first */}
      <div className="mb-6">
        <DailyProgress />
      </div>

      {/* Weekly Progress Section */}
      <div className="mb-6">
        <WeeklyProgress />
      </div>

      {/* Other Goals */}
      {mockGoals.length > 0 ? (
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-800 border-b border-gray-200 pb-2">
            {t('otherGoals', { defaultValue: 'Additional Goals' })}
          </h4>
          {mockGoals.map((goal) => {
            const progressPercentage = getProgressPercentage(goal.current_value, goal.target_value);
            
            return (
              <div
                key={goal.id}
                className={`p-4 rounded-lg border-2 transition-all ${
                  goal.is_completed 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    {getGoalIcon(goal.goal_type)}
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {getGoalTitle(goal.goal_type)}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {goal.current_value}/{goal.target_value} {getGoalUnit(goal.goal_type)}
                      </p>
                    </div>
                  </div>
                  {goal.is_completed && (
                    <CheckCircleIcon className="h-6 w-6 text-green-600" />
                  )}
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      goal.is_completed 
                        ? 'bg-green-500' 
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>

                {/* Goal Meta Info */}
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{t('progress.created')} {formatDate(goal.created_at)}</span>
                  {goal.target_date && (
                    <span>{t('progress.due')} {formatDate(goal.target_date)}</span>
                  )}
                  {goal.is_completed && (
                    <span className="text-green-600 font-medium">
                      {t('progress.completed')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6">
          <TrophyIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">{t('noGoals.title')}</h4>
          <p className="text-gray-600 mb-4">{t('noGoals.description')}</p>
          <button
            onClick={() => setShowAddGoal(true)}
            className="btn-primary"
          >
            {t('noGoals.createFirst')}
          </button>
        </div>
      )}

      {/* Create Goal Form */}
      {showAddGoal && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-3">{t('createGoal.title')}</h4>
          <form onSubmit={handleCreateGoal} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-800 mb-1">
                {t('createGoal.goalType')}
              </label>
              <select
                value={newGoal.goal_type}
                onChange={(e) => setNewGoal({ ...newGoal, goal_type: e.target.value })}
                className="w-full p-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="weekly_practice">{t('goalTypeOptions.weekly_practice')}</option>
                <option value="category_mastery">{t('goalTypeOptions.category_mastery')}</option>
                <option value="monthly_streak">{t('goalTypeOptions.monthly_streak')}</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-blue-800 mb-1">
                {t('createGoal.targetValue')}
              </label>
              <input
                type="number"
                value={newGoal.target_value}
                onChange={(e) => setNewGoal({ ...newGoal, target_value: parseInt(e.target.value) || 0 })}
                placeholder={t('createGoal.targetPlaceholder')}
                className="w-full p-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-800 mb-1">
                {t('createGoal.targetDate')}
              </label>
              <input
                type="date"
                value={newGoal.target_date || ''}
                onChange={(e) => setNewGoal({ ...newGoal, target_date: e.target.value || undefined })}
                className="w-full p-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={createGoalMutation.isPending}
                className="btn-primary text-sm flex-1 disabled:opacity-50"
              >
                {createGoalMutation.isPending ? t('createGoal.creating') : t('createGoal.create')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddGoal(false);
                  setNewGoal({ goal_type: 'weekly_practice', target_value: 5 });
                }}
                className="btn-secondary text-sm flex-1"
              >
                {t('createGoal.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Goal Templates */}
      {!showAddGoal && mockGoals.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">{t('quickGoals.title')}</h4>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setNewGoal({ goal_type: 'weekly_practice', target_value: 3 });
                setShowAddGoal(true);
              }}
              className="text-left p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <div className="text-sm font-medium text-green-900">{t('quickGoals.relaxedPace.title', { defaultValue: '3 sessions/week' })}</div>
              <div className="text-xs text-green-600">{t('quickGoals.relaxedPace.description', { defaultValue: 'Relaxed pace' })}</div>
            </button>
            <button
              onClick={() => {
                setNewGoal({ goal_type: 'category_mastery', target_value: 100 });
                setShowAddGoal(true);
              }}
              className="text-left p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <div className="text-sm font-medium text-purple-900">{t('quickGoals.categoryMastery.title', { defaultValue: 'Master 100 words' })}</div>
              <div className="text-xs text-purple-600">{t('quickGoals.categoryMastery.description', { defaultValue: 'Category challenge' })}</div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningGoals;