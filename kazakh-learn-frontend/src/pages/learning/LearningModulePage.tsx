// kazakh-learn-frontend/src/pages/learning/LearningModulePage.tsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { learningAPI  } from '../../services/learningAPI';
import { LEARNING_STATUSES, IN_PROGRESS_STATUSES } from '../../types/learning';
import type { UserWordProgressWithWord } from '../../types/api';
import { toast } from 'sonner';
import LearningModule from '../../components/learning/LearningModule';
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
  LightBulbIcon
} from '@heroicons/react/24/outline';

interface DailyProgress {
  words_learned_today: number;
  sessions_completed_today: number;
  daily_goal: number;
  progress_percentage: number;
  goal_reached: boolean;
  words_remaining: number;
}

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

const LearningModulePage: React.FC = () => {
  const { t } = useTranslation(['learning', 'common']);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State for the page
  const [showModule, setShowModule] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [selectedDifficulty, setSelectedDifficulty] = useState<number | undefined>();

  // Get user's daily goal - simplified to use default value
  const dailyGoal = 10; // Default daily goal, can be made configurable later

  // Fetch daily progress
  const { data: dailyProgress, isLoading: progressLoading } = useQuery({
    queryKey: ['daily-progress'],
    queryFn: async (): Promise<DailyProgress> => {
      try {
        // This would be a real API call to get daily progress
        // For now, we'll simulate it based on user data
        const today = new Date().toISOString().split('T')[0];
        
        // Get learning statistics (mock data for now)
        return {
          words_learned_today: 3, // Mock data
          sessions_completed_today: 1, // Mock data
          daily_goal: dailyGoal,
          progress_percentage: (3 / dailyGoal) * 100,
          goal_reached: 3 >= dailyGoal,
          words_remaining: Math.max(0, dailyGoal - 3)
        };
      } catch (error) {
        console.error('Failed to fetch daily progress:', error);
        return {
          words_learned_today: 0,
          sessions_completed_today: 0,
          daily_goal: dailyGoal,
          progress_percentage: 0,
          goal_reached: false,
          words_remaining: dailyGoal
        };
      }
    },
    enabled: !!user,
    refetchInterval: 60000, // Refresh every minute
  });

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

  // Start learning session
  const startLearning = () => {
    if (!wordsAvailable || wordsAvailable.total === 0) {
      toast.error('No words available for learning. Please add some words to your learning list.');
      return;
    }

    if (wordsAvailable.total < 3) {
      toast.warning('You need at least 3 words to start a learning session. Add more words to your learning list.');
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
    
    toast.success('🎉 Great job! Your learning session is complete.');
    
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

  // Calculate progress data
  const calculateProgressData = () => {
    if (!dailyProgress) return null;

    const percentage = Math.min((dailyProgress.words_learned_today / dailyProgress.daily_goal) * 100, 100);
    let message = '';
    let color = '';

    if (dailyProgress.goal_reached) {
      message = "🎉 Daily goal completed! Fantastic work!";
      color = 'text-green-600';
    } else if (percentage >= 75) {
      message = `Almost there! Just ${dailyProgress.words_remaining} more words to go!`;
      color = 'text-blue-600';
    } else if (percentage >= 50) {
      message = `Great progress! ${dailyProgress.words_remaining} words remaining.`;
      color = 'text-yellow-600';
    } else if (percentage >= 25) {
      message = `Good start! ${dailyProgress.words_remaining} words left to reach your goal.`;
      color = 'text-orange-600';
    } else {
      message = `Ready to learn? ${dailyProgress.words_remaining} words to reach your daily goal!`;
      color = 'text-gray-600';
    }

    return { percentage: Math.round(percentage), message, color };
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
        <div className="container mx-auto px-4 py-6">
          <LearningModule onComplete={handleModuleComplete} />
        </div>
      </div>
    );
  }

  if (progressLoading || wordsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your learning dashboard...</p>
        </div>
      </div>
    );
  }

  const progressData = calculateProgressData();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Ready to Learn Kazakh, {user?.full_name?.split(' ')[0] || 'Learner'}?
          </h1>
          <p className="text-xl text-gray-600">
            Master new words through our structured 3-step learning process
          </p>
        </div>

        {/* Daily Progress Card */}
        {dailyProgress && progressData && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
                <TrophyIcon className="h-7 w-7 mr-3 text-yellow-500" />
                Today's Progress
              </h2>
              <div className="flex items-center space-x-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {dailyProgress.words_learned_today}
                  </div>
                  <div className="text-sm text-gray-500 font-medium">Learned</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {dailyProgress.sessions_completed_today}
                  </div>
                  <div className="text-sm text-gray-500 font-medium">Sessions</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {learningStats?.current_streak || 0}
                  </div>
                  <div className="text-sm text-gray-500 font-medium">Day Streak</div>
                </div>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span className="font-medium">Daily Goal Progress</span>
                <span className="font-medium">{dailyProgress.words_learned_today}/{dailyProgress.daily_goal} words</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div 
                  className={`h-4 rounded-full transition-all duration-500 ${
                    progressData.percentage === 100 ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${progressData.percentage}%` }}
                ></div>
              </div>
            </div>
            
            <p className={`text-center font-semibold ${progressData.color}`}>
              {progressData.message}
            </p>
          </div>
        )}

        {/* Learning Process Overview */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8 border border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-900 mb-8 text-center">
            How Our Learning Module Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-xl bg-blue-50 border border-blue-200">
              <div className="bg-blue-100 rounded-full p-4 w-16 h-16 mx-auto mb-4">
                <BookOpenIcon className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-blue-900 mb-3">
                1. Overview
              </h3>
              <p className="text-blue-800">
                Review 3 new words with translations, pronunciation, and images to familiarize yourself
              </p>
            </div>
            <div className="text-center p-6 rounded-xl bg-green-50 border border-green-200">
              <div className="bg-green-100 rounded-full p-4 w-16 h-16 mx-auto mb-4">
                <PencilIcon className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-green-900 mb-3">
                2. Practice
              </h3>
              <p className="text-green-800">
                Write translations for each word to test your understanding and memory
              </p>
            </div>
            <div className="text-center p-6 rounded-xl bg-purple-50 border border-purple-200">
              <div className="bg-purple-100 rounded-full p-4 w-16 h-16 mx-auto mb-4">
                <QuestionMarkCircleIcon className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-purple-900 mb-3">
                3. Quiz
              </h3>
              <p className="text-purple-800">
                Multiple choice quiz to reinforce your learning and test retention
              </p>
            </div>
          </div>
          <div className="text-center mt-8 p-6 bg-yellow-50 rounded-xl border border-yellow-200">
            <StarIcon className="h-10 w-10 text-yellow-600 mx-auto mb-3" />
            <p className="text-yellow-800 font-semibold text-lg">
              Words you get correct in BOTH practice and quiz are marked as learned!
            </p>
          </div>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Words Available */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <BookOpenIcon className="h-6 w-6 mr-2 text-blue-600" />
              Words Available
            </h3>
            {wordsAvailable ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="text-blue-700 font-medium">Want to Learn</span>
                  <span className="font-bold text-blue-900">{wordsAvailable.want_to_learn}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                  <span className="text-yellow-700 font-medium">Learning</span>
                  <span className="font-bold text-yellow-900">{wordsAvailable.learning}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                  <span className="text-orange-700 font-medium">Review</span>
                  <span className="font-bold text-orange-900">{wordsAvailable.review}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-100 rounded-lg border-2 border-gray-300">
                  <span className="text-gray-700 font-semibold">Total Available</span>
                  <span className="font-bold text-gray-900 text-lg">{wordsAvailable.total}</span>
                </div>
                {wordsAvailable.total > 0 && (
                  <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-green-800 text-sm font-medium">
                      Ready for {Math.ceil(Math.min(wordsAvailable.total, dailyGoal) / 3)} learning batches
                    </p>
                    <p className="text-green-600 text-xs mt-1">
                      Estimated time: {estimateSessionTime()}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">No words available for learning</p>
            )}
          </div>

          {/* Learning Statistics */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <ChartBarIcon className="h-6 w-6 mr-2 text-green-600" />
              Learning Stats
            </h3>
            {learningStats ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Words Learning</span>
                  <span className="font-semibold text-gray-900">{learningStats.total_words_learning}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">This Week</span>
                  <span className="font-semibold text-gray-900">{learningStats.words_learned_this_week}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Avg. Accuracy</span>
                  <span className="font-semibold text-gray-900">{learningStats.average_accuracy}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Sessions</span>
                  <span className="font-semibold text-gray-900">{learningStats.total_sessions}</span>
                </div>
                <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center justify-center">
                    <FireIcon className="h-5 w-5 text-orange-500 mr-2" />
                    <span className="text-purple-800 font-medium">
                      {learningStats.current_streak} day streak!
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">
                Start learning to see your statistics!
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <LightBulbIcon className="h-6 w-6 mr-2 text-yellow-600" />
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/app/words')}
                className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center">
                  <BookOpenIcon className="h-5 w-5 text-blue-600 mr-3" />
                  <div>
                    <div className="font-medium text-gray-900">Browse Words</div>
                    <div className="text-sm text-gray-500">Add new words to learn</div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => navigate('/app/categories')}
                className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center">
                  <AcademicCapIcon className="h-5 w-5 text-green-600 mr-3" />
                  <div>
                    <div className="font-medium text-gray-900">Categories</div>
                    <div className="text-sm text-gray-500">Explore by topic</div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => navigate('/app/progress')}
                className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center">
                  <ChartBarIcon className="h-5 w-5 text-purple-600 mr-3" />
                  <div>
                    <div className="font-medium text-gray-900">View Progress</div>
                    <div className="text-sm text-gray-500">See detailed stats</div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => navigate('/app/settings')}
                className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center">
                  <CogIcon className="h-5 w-5 text-gray-600 mr-3" />
                  <div>
                    <div className="font-medium text-gray-900">Settings</div>
                    <div className="text-sm text-gray-500">Adjust learning goals</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Main Action Section */}
        <div className="text-center space-y-6 mb-8">
          {wordsAvailable && wordsAvailable.total >= 3 ? (
            <>
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-8 text-white">
                <h3 className="text-2xl font-bold mb-2">Ready to Start Learning?</h3>
                <p className="text-blue-100 mb-6">
                  You have {wordsAvailable.total} words ready for learning in {Math.ceil(Math.min(wordsAvailable.total, dailyGoal) / 3)} batches
                </p>
                <button
                  onClick={startLearning}
                  className="bg-white text-blue-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 transition-colors flex items-center mx-auto shadow-lg"
                >
                  <PlayIcon className="h-6 w-6 mr-2" />
                  Start Learning Session
                </button>
                <p className="text-blue-200 mt-4 text-sm">
                  Estimated time: {estimateSessionTime()} • 3 words per batch
                </p>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
              <BookOpenIcon className="h-20 w-20 text-gray-400 mx-auto mb-6" />
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                {wordsAvailable?.total === 0 ? 'No Words Available' : 'Need More Words'}
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                {wordsAvailable?.total === 0 
                  ? 'Add some words to your learning list to start practicing!'
                  : `You need at least 3 words to start a learning session. You currently have ${wordsAvailable?.total || 0} words.`
                }
              </p>
              <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                <button 
                  onClick={() => navigate('/app/words')}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  Browse Words
                </button>
                <button 
                  onClick={() => navigate('/app/categories')}
                  className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors font-semibold"
                >
                  Browse Categories
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Filter Options */}
        {wordsAvailable && wordsAvailable.total > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Learning Preferences
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Focus Category (Optional)
                </label>
                <select 
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Categories</option>
                  {categories?.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Difficulty Level (Optional)
                </label>
                <select 
                  value={selectedDifficulty || ''}
                  onChange={(e) => setSelectedDifficulty(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Levels</option>
                  <option value="1">Beginner (Level 1)</option>
                  <option value="2">Elementary (Level 2)</option>
                  <option value="3">Intermediate (Level 3)</option>
                  <option value="4">Advanced (Level 4)</option>
                </select>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              Filters help you focus on specific types of words during your learning session.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LearningModulePage;