// src/components/learning/WordProgress.tsx
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpenIcon, CheckCircleIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { learningAPI } from '../../services/learningAPI';
import type { UserWordProgressWithWord } from '../../types/api';

interface WordProgressData {
  total_words_learned: number;
  target_goal: number;
  progress_percentage: number;
  goal_reached: boolean;
  words_remaining: number;
  breakdown: {
    learned: number;
    mastered: number;
    learning: number;
    want_to_learn: number;
  };
}

const WordProgress: React.FC = () => {
  const { t } = useTranslation('wordProgress');
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Fetch user's learning progress
  const { data: userWords, isLoading, error } = useQuery({
    queryKey: ['learning-progress'],
    queryFn: () => learningAPI.getProgress(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Process the data to calculate progress
  const processProgressData = (words: UserWordProgressWithWord[]): WordProgressData => {
    const breakdown = {
      learned: 0,
      mastered: 0,
      learning: 0,
      want_to_learn: 0,
    };

    words.forEach(word => {
      switch (word.status) {
        case 'learned':
          breakdown.learned++;
          break;
        case 'mastered':
          breakdown.mastered++;
          break;
        case 'learning':
          breakdown.learning++;
          break;
        case 'want_to_learn':
          breakdown.want_to_learn++;
          break;
      }
    });

    // Both learned and mastered count as "learned" words
    const total_words_learned = breakdown.learned + breakdown.mastered;
    
    // Dynamic target: every 50 words completed adds another 50 to the goal
    const completed_fifties = Math.floor(total_words_learned / 50);
    const target_goal = (completed_fifties + 1) * 50;
    
    const progress_percentage = (total_words_learned / target_goal) * 100;
    const goal_reached = total_words_learned >= target_goal;
    const words_remaining = Math.max(target_goal - total_words_learned, 0);

    return {
      total_words_learned,
      target_goal,
      progress_percentage,
      goal_reached,
      words_remaining,
      breakdown,
    };
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <BookOpenIcon className="h-6 w-6 mr-2 text-purple-500" />
            {t('wordProgress.title', { defaultValue: 'Word Mastery Progress' })}
          </h2>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="w-full bg-gray-200 rounded-full h-3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error || !userWords) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <BookOpenIcon className="h-6 w-6 mr-2 text-purple-500" />
            {t('wordProgress.title', { defaultValue: 'Word Mastery Progress' })}
          </h2>
        </div>
        <p className="text-gray-500 text-sm">
          {t('errors.failedToLoadProgress', { defaultValue: 'Failed to load progress data' })}
        </p>
      </div>
    );
  }

  const progressData = processProgressData(userWords);
  const { 
    total_words_learned, 
    target_goal, 
    progress_percentage, 
    goal_reached, 
    words_remaining,
    breakdown 
  } = progressData;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <BookOpenIcon className="h-6 w-6 mr-2 text-purple-500" />
          {t('wordProgress.title', { defaultValue: 'Word Mastery Progress' })}
        </h2>
        <span className="text-sm text-gray-600">
          {total_words_learned}/{target_goal}
        </span>
      </div>
      
      <div className="space-y-4">
        {/* Main Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all duration-500 ${
              goal_reached 
                ? 'bg-gradient-to-r from-purple-500 to-pink-500' 
                : 'bg-gradient-to-r from-purple-400 to-purple-600'
            }`}
            style={{ width: `${Math.min(progress_percentage, 100)}%` }}
          />
        </div>
        
        <div className="flex justify-between text-sm text-gray-600">
          <span>
            {goal_reached 
              ? t('wordProgress.goalReached', { defaultValue: 'Mastery goal reached! 🎉' }) 
              : t('wordProgress.inProgress', { defaultValue: 'In progress' })
            }
          </span>
          <span>{Math.round(progress_percentage)}%</span>
        </div>

        {/* Words Breakdown - Collapsible */}
        <div className="mt-4">
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-between"
          >
            <h3 className="text-sm font-semibold text-gray-700">
              {t('wordProgress.breakdown', { defaultValue: 'Learning Breakdown' })}
            </h3>
            {showBreakdown ? (
              <ChevronUpIcon className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDownIcon className="h-4 w-4 text-gray-500" />
            )}
          </button>
          
          {showBreakdown && (
            <div className="mt-3 p-4 bg-gray-50 rounded-lg border-t border-gray-200">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {/* Learned + Mastered (Combined as "Learned") */}
                <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                  <span className="flex items-center text-green-700">
                    <CheckCircleIcon className="h-4 w-4 mr-1" />
                    {t('wordProgress.learned', { defaultValue: 'Learned' })}
                  </span>
                  <span className="font-semibold text-green-800">
                    {total_words_learned}
                  </span>
                </div>

                {/* Currently Learning */}
                <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                  <span className="flex items-center text-blue-700">
                    <BookOpenIcon className="h-4 w-4 mr-1" />
                    {t('wordProgress.learning', { defaultValue: 'Learning' })}
                  </span>
                  <span className="font-semibold text-blue-800">
                    {breakdown.learning}
                  </span>
                </div>

                {/* Want to Learn */}
                <div className="flex items-center justify-between p-2 bg-gray-100 rounded">
                  <span className="text-gray-700">
                    {t('wordProgress.wantToLearn', { defaultValue: 'To Learn' })}
                  </span>
                  <span className="font-semibold text-gray-800">
                    {breakdown.want_to_learn}
                  </span>
                </div>

                {/* Remaining to Goal */}
                <div className="flex items-center justify-between p-2 bg-purple-50 rounded">
                  <span className="text-purple-700">
                    {t('wordProgress.remaining', { defaultValue: 'Remaining' })}
                  </span>
                  <span className="font-semibold text-purple-800">
                    {words_remaining}
                  </span>
                </div>
              </div>

              {/* Detailed Status Breakdown (Optional - more granular) */}
              {(breakdown.learned > 0 || breakdown.mastered > 0) && (
                <div className="mt-3 p-3 bg-purple-50 rounded-lg">
                  <div className="text-sm font-medium text-purple-800 mb-2">
                    {t('wordProgress.detailedBreakdown', { defaultValue: 'Detailed Status' })}
                  </div>
                  <div className="flex justify-between text-xs text-purple-700">
                    <span>
                      {t('wordProgress.statusLearned', { defaultValue: 'Learned' })}: {breakdown.learned}
                    </span>
                    <span>
                      {t('wordProgress.statusMastered', { defaultValue: 'Mastered' })}: {breakdown.mastered}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Goal Status Messages */}
        {goal_reached ? (
          <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
            <div className="flex items-center text-purple-700">
              <div className="text-lg mr-2">🎯</div>
              <div>
                <div className="text-sm font-medium">
                  {t('wordProgress.congratulations', { defaultValue: 'Congratulations!' })}
                </div>
                <div className="text-xs">
                  {target_goal === 50 
                    ? t('wordProgress.firstGoalReached', { 
                        defaultValue: 'You\'ve learned your first 50 words! Now aim for 100!',
                        count: target_goal 
                      })
                    : t('wordProgress.nextGoalReached', { 
                        defaultValue: 'Amazing! You\'ve learned {{count}} words! Your next goal: {{next}} words.',
                        count: target_goal,
                        next: target_goal + 50
                      })
                  }
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center text-blue-700">
              <div className="text-lg mr-2">💪</div>
              <div>
                <div className="text-sm font-medium">
                  {words_remaining <= 5 
                    ? t('wordProgress.almostThere', { defaultValue: 'Almost there!', remaining: words_remaining })
                    : t('wordProgress.keepGoing', { defaultValue: 'Keep going!', remaining: words_remaining })
                  }
                </div>
                <div className="text-xs">
                  {target_goal === 50
                    ? t('wordProgress.firstGoalMessage', { 
                        defaultValue: 'Your goal: learn your first {{target}} words! {{remaining}} to go.',
                        remaining: words_remaining,
                        target: target_goal
                      })
                    : t('wordProgress.nextGoalMessage', { 
                        defaultValue: 'Your current goal: {{target}} words! {{remaining}} more to reach this milestone.',
                        remaining: words_remaining,
                        target: target_goal
                      })
                  }
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WordProgress;