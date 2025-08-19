// kazakh-learn-frontend/src/pages/learning/LearningModulePage.tsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { learningAPI } from '../../services/learningAPI';
import api from '../../services/api';
import { LEARNING_STATUSES, IN_PROGRESS_STATUSES, type LearningStatus } from '../../types/learning';
import type { UserWordProgressWithWord } from '../../types/api';
import { toast } from 'sonner';
import LearningModule from '../../components/learning/LearningModule';
import LearningModuleMenu from './LearningModuleMenu';
import { 
  BookOpenIcon, 
  PencilIcon, 
  QuestionMarkCircleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  PlayIcon,
  StarIcon,
  ClockIcon,
  TrophyIcon,
  FireIcon,
  ChartBarIcon,
  CogIcon,
  UserIcon,
  CalendarDaysIcon,
  AcademicCapIcon,
  LightBulbIcon,
  SparklesIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import LearningTips from '../../components/learning/LearningTips';
import DailyProgress from '../../components/learning/DailyProgress';
import QuickActionCards from '../../components/learning/QuickActionCards';
import MotivationalQuote from '../../components/learning/MotivationalQuote';

interface LearningStats {
  total_words_learning: number;
  words_learned_this_week: number;
  current_streak: number;
  average_accuracy: number;
  total_sessions: number;
}

interface WordsAvailable {
  want_to_learn: number;
  learning: number;
  review: number;
  total: number;
}


// User preferences interface
interface UserPreferences {
  daily_goal: number;
}

const getUserPreferences = async (): Promise<UserPreferences> => {
  const response = await api.get('/api/preferences/');
  return response.data;
};


const LearningModulePage: React.FC = () => {
  const { t } = useTranslation(['learning', 'common']);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State for the page
  const [showModule, setShowModule] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [selectedDifficulty, setSelectedDifficulty] = useState<number | undefined>();
  const [isAddingWords, setIsAddingWords] = useState(false);

  // Fetch user preferences using React Query
  const { data: userPreferences, isLoading: preferencesLoading, error: preferencesError } = useQuery({
    queryKey: ['userPreferences'],
    queryFn: async () => {
      console.log('🔍 Fetching user preferences...');
      try {
        const data = await getUserPreferences();
        console.log('✅ Preferences loaded successfully:', data);
        return data;
      } catch (error) {
        console.error('❌ Error fetching preferences:', error);
        throw error;
      }
    },
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get user's daily goal - simplified to use default value
  const dailyGoal = userPreferences?.daily_goal || 12; // Default daily goal, can be made configurable later

  // Fetch words available for learning
  const { data: wordsAvailable, isLoading: wordsLoading } = useQuery({
    queryKey: ['words-available', selectedCategory, selectedDifficulty],
    queryFn: async (): Promise<WordsAvailable> => {
      try {
        const [wantToLearn, learning, review] = await Promise.all([
          learningAPI.getProgress({
            status: LEARNING_STATUSES.WANT_TO_LEARN,
            category_id: selectedCategory,
            difficulty_level_id: selectedDifficulty,
            limit: 100
          }) as Promise<UserWordProgressWithWord[]>,
          learningAPI.getProgress({
            status: LEARNING_STATUSES.LEARNING,
            category_id: selectedCategory,
            difficulty_level_id: selectedDifficulty,
            limit: 100
          }) as Promise<UserWordProgressWithWord[]>,
          learningAPI.getProgress({
            status: LEARNING_STATUSES.REVIEW,
            category_id: selectedCategory,
            difficulty_level_id: selectedDifficulty,
            limit: 100
          }) as Promise<UserWordProgressWithWord[]>
        ]);

        return {
          want_to_learn: wantToLearn.length,
          learning: learning.length,
          review: review.length,
          total: wantToLearn.length + learning.length + review.length
        };
      } catch (error) {
        console.error('Failed to fetch available words:', error);
        return {
          want_to_learn: 0,
          learning: 0,
          review: 0,
          total: 0
        };
      }
    },
    enabled: !!user && !showModule,
  });
  

  // Fetch learning statistics
  const { data: learningStats } = useQuery({
    queryKey: ['learning-stats'],
    queryFn: async (): Promise<LearningStats> => {
      try {
        // This would be a real API call to get learning statistics
        // For now, we'll return mock data
        return {
          total_words_learning: 45,
          words_learned_this_week: 15,
          current_streak: 5,
          average_accuracy: 78,
          total_sessions: 12
        };
      } catch (error) {
        console.error('Failed to fetch learning stats:', error);
        return {
          total_words_learning: 0,
          words_learned_this_week: 0,
          current_streak: 0,
          average_accuracy: 0,
          total_sessions: 0
        };
      }
    },
    enabled: !!user,
  });
  

  // Fetch categories for filter
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      try {
        // This would fetch categories from your API
        return [
          { id: 1, name: 'Basic Vocabulary' },
          { id: 2, name: 'Family' },
          { id: 3, name: 'Food & Drinks' },
          { id: 4, name: 'Animals' },
          { id: 5, name: 'Colors' },
          { id: 6, name: 'Numbers' },
          { id: 7, name: 'Time & Weather' },
          { id: 8, name: 'Travel' }
        ];
      } catch (error) {
        console.error('Failed to fetch categories:', error);
        return [];
      }
    }
  });

  // Mutation to add random words
  const addRandomWordsMutation = useMutation({
    mutationFn: async () => {
      setIsAddingWords(true);
      
      // Use the clean /words/add-random endpoint
      const params = new URLSearchParams();
      
      // Don't specify count - let it use user's daily goal from settings
      // Or you can explicitly pass dailyGoal if you want to override
      if (dailyGoal) {
        params.append('count', dailyGoal.toString());
      }
      if (selectedCategory) {
        params.append('category_id', selectedCategory.toString());
      }
      if (selectedDifficulty) {
        params.append('difficulty_level_id', selectedDifficulty.toString());
      }
      
      const response = await api.post(`/learning-module/words/add-random?${params}`);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      
      // Show additional info if needed
      if (data.words_added !== data.requested_count) {
        toast.info(`Added ${data.words_added} out of ${data.requested_count} requested words.`);
      }
      
      queryClient.invalidateQueries({ queryKey: ['words-available'] });
      queryClient.invalidateQueries({ queryKey: ['learning-progress-all'] });
      setIsAddingWords(false);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.detail || error.message || t('messages.addWordsError');
      toast.error(errorMessage);
      setIsAddingWords(false);
    },
  });

  // Handle adding random words
  const handleAddRandomWords = () => {
    if (!user) {
      toast.error(t('messages.loginRequired'));
      return;
    }
    addRandomWordsMutation.mutate();
  };

  // Start learning session
  const startLearning = () => {
    if (!wordsAvailable || wordsAvailable.total === 0) {
      toast.error(t('messages.noWordsError'));
      return;
    }

    if (wordsAvailable.total < 3) {
      toast.warning(t('messages.needMoreWordsError'));
      return;
    }

    setShowModule(true);
    // Track learning session start
    trackEvent('learning_session_started', {
      words_available: wordsAvailable.total,
      daily_goal: dailyGoal
    });
  };

  // Handle module completion
  const handleModuleComplete = () => {
    setShowModule(false);
    queryClient.invalidateQueries({ queryKey: ['daily-progress'] });
    queryClient.invalidateQueries({ queryKey: ['words-available'] });
    queryClient.invalidateQueries({ queryKey: ['learning-stats'] });
    
    toast.success(t('dailyProgress.sessionComplete'));
    
    // Track completion
    trackEvent('learning_session_completed', {
      daily_goal: dailyGoal
    });
  };

  // Simple event tracking (you can replace with your analytics)
  const trackEvent = (eventName: string, properties: any) => {
    console.log('Analytics Event:', eventName, properties);
    // Replace with your analytics service (Google Analytics, Mixpanel, etc.)
  };

  // Estimate session time
  const estimateSessionTime = () => {
    if (!wordsAvailable) return '0 min';
    const totalWords = Math.min(wordsAvailable.total, dailyGoal);
    const batches = Math.ceil(totalWords / 3);
    const estimatedMinutes = batches * 5; // 5 minutes per batch
    return `${estimatedMinutes} min`;
  };

  if (showModule) {
    return (
      <div className="min-h-screen bg-gray-50">
        <LearningModuleMenu />
        <div className="container mx-auto px-4 py-6">
          <LearningModule onComplete={handleModuleComplete} />
        </div>
      </div>
    );
  }

  if (wordsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('page.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {t('page.title', {
              name: user?.full_name?.split(' ')[0] || 'Learner'
            })}
          </h1>
          <p className="text-gray-600 text-lg">
            {t('page.subtitle')}
          </p>
        </div>

        {/* Learning Module Menu */}
        <div className="mb-8">
          <LearningModuleMenu />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Progress & Stats */}
          <div className="space-y-6">

            {wordsAvailable && wordsAvailable.total >= 3 ? (
                /* User has enough words - show start learning button */
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-8 text-white">
                  <PlayIcon className="h-16 w-16 mx-auto mb-4 text-white" />
                  <h3 className="text-2xl font-bold mb-2">{t('mainAction.readyToStart')}</h3>
                  <p className="text-blue-100 mb-6">
                    {t('mainAction.wordsReady', {
                      total: wordsAvailable.total,
                      batches: Math.ceil(Math.min(wordsAvailable.total, dailyGoal) / 3)
                    })}
                  </p>
                  <button
                    onClick={startLearning}
                    className="bg-white text-blue-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 transition-colors flex items-center mx-auto shadow-lg"
                  >
                    <PlayIcon className="h-6 w-6 mr-2" />
                    {t('mainAction.startLearning')}
                  </button>
                  <p className="text-blue-200 mt-4 text-sm">
                    {t('mainAction.estimatedInfo', {
                      time: estimateSessionTime()
                    })}
                  </p>
                </div>
              ) : (
                /* User doesn't have enough words - show options */
                <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
                  <BookOpenIcon className="h-20 w-20 text-gray-400 mx-auto mb-6" />
                  <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                    {!wordsAvailable || wordsAvailable.total === 0 ? t('mainAction.noWords') : t('mainAction.needMoreWords')}
                  </h3>
                  <p className="text-gray-600 mb-8 max-w-md mx-auto">
                    {!wordsAvailable || wordsAvailable.total === 0 
                      ? t('mainAction.noWordsMessage')
                      : t('mainAction.needMoreMessage', {
                          count: wordsAvailable?.total || 0
                        })
                    }
                  </p>

                  {/* Action buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-2xl mx-auto">
                    {/* Browse Words button */}
                    <button
                      onClick={() => navigate('/app/words')}
                      className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md"
                    >
                      <BookOpenIcon className="h-5 w-5 mr-2" />
                      {t('recommendations.learn.action')}
                    </button>

                    {/* Visit Categories button */}
                    <button
                      onClick={() => navigate('/app/categories')}
                      className="flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-md"
                    >
                      <PencilIcon className="h-5 w-5 mr-2" />
                      {t('quickActions.visitCategories')}
                    </button>

                    {/* NEW: Add Random Words button */}
                    <button
                      onClick={handleAddRandomWords}
                      disabled={isAddingWords || addRandomWordsMutation.isPending}
                      className="flex items-center justify-center px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAddingWords ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          {t('mainAction.addingWords')}
                        </>
                      ) : (
                        <>
                          <SparklesIcon className="h-5 w-5 mr-2" />
                          {t('mainAction.addRandomWords')}
                        </>
                      )}
                    </button>
                  </div>

                  {/* Help text for random words button */}
                  <p className="text-sm text-gray-500 mt-4 max-w-lg mx-auto">
                    {t('mainAction.randomWordsHelp')}
                  </p>
                </div>
              )}

              {/* Quick Action Cards */}
              <QuickActionCards />
          </div>

          {/* Center Column: Main Action */}
          <div className="space-y-6">

            
            {/* Motivational Quote */}
            <MotivationalQuote />
            {/* Learning Tips */}
            <LearningTips />
            {/* Daily Progress */}
            <DailyProgress />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearningModulePage;