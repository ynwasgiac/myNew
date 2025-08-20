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
import WordProgress from '../learning/WordProgress';

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
    {
      id: 4,
      goal_type: 'weekly_practice',
      target_value: 7,
      current_value: 3,
      is_completed: false,
      target_date: null,
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 5,
      goal_type: 'streak_maintenance',
      target_value: 30,
      current_value: 12,
      is_completed: false,
      target_date: null,
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    }
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
      toast.error(t('messages.goalError'));
    },
  });

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    createGoalMutation.mutate(newGoal);
  };

  const getGoalIcon = (goalType: string) => {
    const iconProps = { className: "h-5 w-5" };
    
    switch (goalType) {
      case 'weekly_practice':
        return <ClockIcon {...iconProps} className="h-5 w-5 text-blue-600" />;
      case 'category_mastery':
        return <BookOpenIcon {...iconProps} className="h-5 w-5 text-purple-600" />;
      case 'streak_maintenance':
        return <TrophyIcon {...iconProps} className="h-5 w-5 text-yellow-600" />;
      default:
        return <AcademicCapIcon {...iconProps} className="h-5 w-5 text-gray-600" />;
    }
  };

  const getGoalTitle = (goalType: string) => {
    switch (goalType) {
      case 'weekly_practice':
        return t('goalTypes.weeklyPractice', { defaultValue: 'Weekly Practice' });
      case 'category_mastery':
        return t('goalTypes.categoryMastery', { defaultValue: 'Category Mastery' });
      case 'streak_maintenance':
        return t('goalTypes.streakMaintenance', { defaultValue: 'Streak Maintenance' });
      default:
        return t('goalTypes.unknown', { defaultValue: 'Unknown Goal' });
    }
  };

  const getGoalUnit = (goalType: string) => {
    switch (goalType) {
      case 'weekly_practice':
        return t('units.sessions', { defaultValue: 'sessions' });
      case 'category_mastery':
        return t('units.words', { defaultValue: 'words' });
      case 'streak_maintenance':
        return t('units.days', { defaultValue: 'days' });
      default:
        return '';
    }
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {t('title', { defaultValue: 'Learning Goals' })}
        </h3>
        {!showAddGoal && (
          <button
            onClick={() => setShowAddGoal(true)}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            <span className="text-sm font-medium">{t('addGoal', { defaultValue: 'Add Goal' })}</span>
          </button>
        )}
      </div>

      {/* Progress Components - Horizontal Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <DailyProgress />
        <WeeklyProgress />
        <WordProgress />
      </div>

      {/* Other Goals - Horizontal Layout */}
      {mockGoals.length > 0 ? (
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-800 border-b border-gray-200 pb-2">
            {t('otherGoals', { defaultValue: 'Additional Goals' })}
          </h4>
          
          {/* Horizontal container for goals */}
          <div className="flex gap-4 overflow-x-auto pb-4">
            {mockGoals.map((goal) => {
              const progressPercentage = getProgressPercentage(goal.current_value, goal.target_value);
              
              return (
                <div
                  key={goal.id}
                  className={`flex-shrink-0 w-64 p-4 rounded-lg border-2 transition-all ${
                    goal.is_completed 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getGoalIcon(goal.goal_type)}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-gray-900 truncate">
                          {getGoalTitle(goal.goal_type)}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {goal.current_value}/{goal.target_value} {getGoalUnit(goal.goal_type)}
                        </p>
                      </div>
                    </div>
                    {goal.is_completed && (
                      <CheckCircleIcon className="h-6 w-6 text-green-600 flex-shrink-0" />
                    )}
                  </div>

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

                  <div className="space-y-1 text-xs text-gray-500">
                    <div>{t('progress.created')} {formatDate(goal.created_at)}</div>
                    {goal.target_date && (
                      <div>{t('progress.due')} {formatDate(goal.target_date)}</div>
                    )}
                    {goal.is_completed && (
                      <div className="text-green-600 font-medium">
                        {t('progress.completed')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* Add Goal Card */}
            {!showAddGoal && (
              <div
                onClick={() => setShowAddGoal(true)}
                className="flex-shrink-0 w-64 p-4 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group"
              >
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <PlusIcon className="h-8 w-8 text-gray-400 group-hover:text-blue-500 mb-2" />
                  <h4 className="font-medium text-gray-600 group-hover:text-blue-600 mb-1">
                    {t('addGoal', { defaultValue: 'Add Goal' })}
                  </h4>
                  <p className="text-xs text-gray-500 group-hover:text-blue-500">
                    {t('addGoalDescription', { defaultValue: 'Set a new learning goal' })}
                  </p>
                </div>
              </div>
            )}
          </div>
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

      {/* Add Goal Form */}
      {showAddGoal && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
          <form onSubmit={handleCreateGoal} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('createGoal.type')}
              </label>
              <select
                value={newGoal.goal_type}
                onChange={(e) => setNewGoal({ ...newGoal, goal_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="weekly_practice">{t('goalTypes.weeklyPractice')}</option>
                <option value="category_mastery">{t('goalTypes.categoryMastery')}</option>
                <option value="streak_maintenance">{t('goalTypes.streakMaintenance')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('createGoal.target')}
              </label>
              <input
                type="number"
                min="1"
                value={newGoal.target_value}
                onChange={(e) => setNewGoal({ ...newGoal, target_value: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="submit"
                disabled={createGoalMutation.isPending}
                className="btn-primary text-sm flex-1"
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
    </div>
  );
};

export default LearningGoals;