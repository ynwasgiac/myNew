// src/pages/learning/QuizPage.tsx - Updated to use getLearnedWords function
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ArrowRightIcon, 
  TrophyIcon,
  BookOpenIcon,
  ClockIcon 
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';

import { quizAPI, wordsAPI } from '../../services/api';
import { learningAPI } from '../../services/learningAPI';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import api from '../../services/api';

// Define local interfaces for quiz-specific data
interface QuizResult {
  questionId: number;
  selectedAnswer: number;
  isCorrect: boolean;
  timeSpent: number;
}

interface LocalQuizQuestion {
  id: number;
  word: string;
  translation: string;
  options: string[];
  correctAnswer: number;
  type: 'multiple_choice' | 'translation';
}

interface QuizWord {
  id: number;
  kazakh_word: string;
  kazakh_cyrillic?: string;
  translation: string;
  pronunciation?: string;
  image_url?: string;
  difficulty_level: number;
}

// User preferences interface
interface UserPreferences {
  id: number;
  user_id: number;
  quiz_word_count: number;
  daily_goal: number;
  session_length: number;
  notification_settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

const getUserPreferences = async (): Promise<UserPreferences> => {
  const response = await api.get('/api/preferences/');
  return response.data;
};

const QuizPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation('quiz');
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  
  // URL parameters
  const categoryId = searchParams.get('category') ? parseInt(searchParams.get('category')!) : undefined;
  const difficultyLevelId = searchParams.get('difficulty') ? parseInt(searchParams.get('difficulty')!) : undefined;

  // State - using LocalQuizQuestion for internal state
  const [questions, setQuestions] = useState<LocalQuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [isQuizComplete, setIsQuizComplete] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [sessionId, setSessionId] = useState<number | undefined>(undefined);

  // Fetch user preferences using React Query
  const { data: userPreferences, isLoading: preferencesLoading, error: preferencesError } = useQuery({
    queryKey: ['userPreferences'],
    queryFn: async () => {
      // console.log('🔍 Fetching user preferences...');
      try {
        const data = await getUserPreferences();
        // console.log('✅ Preferences loaded successfully:', data);
        return data;
      } catch (error) {
        // console.error('❌ Error fetching preferences:', error);
        throw error;
      }
    },
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get user's preferred language
  const getUserLanguage = () => {
    return user?.main_language?.language_code || 'en';
  };

  // Get learning stats
  const { data: stats } = useQuery({
    queryKey: ['learning-stats'],
    queryFn: learningAPI.getStats,
  });

  // 🎯 UPDATED: Use the new getLearnedWords function
  const generateQuizMutation = useMutation({
    mutationFn: async () => {
      if (!userPreferences) {
        throw new Error('User preferences not loaded yet');
      }
      
      const questionCount = userPreferences.quiz_word_count || 9;
      
      // console.log('🔍 QUIZ DEBUG:');
      // console.log('  userPreferences:', userPreferences);
      // console.log('  quiz_word_count from settings:', userPreferences.quiz_word_count);
      // console.log('  questionCount (final):', questionCount);
      
      // console.log('🧠 Starting quiz generation with LEARNED words only...');
      // console.log('Quiz parameters:', { 
      //   questionCount, 
      //   'userPreferences.quiz_word_count': userPreferences.quiz_word_count,
      //   categoryId, 
      //   difficultyLevelId 
      // });

      // console.log('🧠 Starting quiz generation with LEARNED words only...');
      // console.log('Quiz parameters:', { questionCount, categoryId, difficultyLevelId });
      
      try {
        // 🆕 Use the new getLearnedWords function with correct parameters
        // console.log('📚 Fetching learned words using new getLearnedWords function...');
        
        const learnedWordsResponse = await learningAPI.getLearnedWords({
          limit: 100, // Get all learned words
          include_mastered: false, // Include mastered words for quiz
          language_code: getUserLanguage(), // User's preferred language
          category_id: categoryId,
          difficulty_level_id: difficultyLevelId,
          offset: 0
        });
        
        // console.log('📊 Learned words response for quiz:', learnedWordsResponse);
        // console.log(`📈 Total learned words found: ${learnedWordsResponse.length}`);
        
        if (learnedWordsResponse.length === 0) {
          throw new Error('No learned words available for quiz. Please complete some learning modules first to unlock quiz mode.');
        }
        
        // Convert to quiz word format
        const quizWords: QuizWord[] = learnedWordsResponse.map((wordData: any) => {
          // The backend response is already in the correct format - no nested structure!
          // console.log('🔍 Processing word data:', wordData);
          
          return {
            id: wordData.id,
            kazakh_word: wordData.kazakh_word,
            kazakh_cyrillic: wordData.kazakh_cyrillic,
            translation: wordData.translation, // Already in user's preferred language from backend
            pronunciation: wordData.pronunciation,
            image_url: wordData.image_url,
            difficulty_level: 1, // Backend returns string, we need number
          };
        });
        
        // console.log(`✅ Successfully converted ${quizWords.length} learned words for quiz`);
        
        // Check if we have enough words for quiz (need at least 4 for proper quiz)
        if (quizWords.length < 4) {
          throw new Error('Need at least 4 learned words to create a proper quiz. Please learn more words first.');
        }
        
        // Limit the number of questions based on user preferences and available words
        const maxQuestions = Math.min(questionCount, quizWords.length);
        const selectedWords = quizWords
          .sort(() => Math.random() - 0.5) // Shuffle array
          .slice(0, maxQuestions);
        
        // console.log(`🎲 Selected ${selectedWords.length} words for quiz out of ${quizWords.length} available`);
        
        // Generate quiz questions
        const questions: LocalQuizQuestion[] = selectedWords.map((word, index) => {
          // console.log(`\n🔤 Generating question ${index + 1} for word: "${word.kazakh_word}"`);
          
          // Create wrong answers from other words
          const otherWords = quizWords.filter(w => w.id !== word.id);
          const wrongAnswers = otherWords
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .map(w => w.translation);
          
          // Ensure we have exactly 3 wrong answers
          while (wrongAnswers.length < 3) {
            wrongAnswers.push(`Sample translation ${wrongAnswers.length + 1}`);
          }
          
          // Create all options and shuffle
          const allOptions = [word.translation, ...wrongAnswers];
          const correctAnswer = Math.floor(Math.random() * 4);
          
          // Place correct answer at the random position
          const finalOptions = [...allOptions];
          if (correctAnswer !== 0) {
            [finalOptions[0], finalOptions[correctAnswer]] = [finalOptions[correctAnswer], finalOptions[0]];
          }
          
          // console.log(`   ✅ Correct answer: "${word.translation}"`);
          // console.log(`   ❌ Wrong answers: ${wrongAnswers.join(', ')}`);
          // console.log(`   🎲 All options: ${finalOptions.join(', ')}`);
          // console.log(`   📍 Correct index: ${correctAnswer}`);
          
          // Verify we have exactly 4 options
          if (finalOptions.length !== 4) {
            console.error(`❌ ERROR: Expected 4 options, got ${finalOptions.length}`);
            throw new Error(`Quiz generation error: Expected 4 options, got ${finalOptions.length}`);
          }
          
          return {
            id: word.id,
            word: word.kazakh_word,
            translation: word.translation,
            options: finalOptions,
            correctAnswer: correctAnswer,
            type: 'multiple_choice' as const
          };
        });
        
        // console.log(`🎯 Generated ${questions.length} quiz questions from learned words`);
        
        return {
          session_id: Math.floor(Math.random() * 10000),
          questions: questions,
          session_type: 'learned_quiz',
          total_questions: questions.length
        };
  
      } catch (error) {
        console.error('❌ Failed to generate quiz:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // console.log('🧠 Quiz generated successfully:', data);
      setSessionId(data.session_id);
      setQuestions(data.questions);
      setStartTime(Date.now());
      
      toast.success(`Quiz started with ${data.questions.length} learned words!`);
    },
    onError: (error) => {
      console.error('❌ Quiz generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate quiz';
      toast.error(errorMessage);
    }
  });

  // Submit quiz results mutation
  const submitQuizMutation = useMutation({
    mutationFn: async (results: QuizResult[]) => {
      // console.log('📊 Submitting quiz results:', results);
      
      try {
        // Try to submit to backend, but don't fail if it doesn't work
        return await quizAPI.submitQuizResults(sessionId, results, getUserLanguage());
      } catch (error) {
        // console.log('⚠️ Backend submission failed, logging locally:', error);
        return { success: true, message: 'Quiz completed locally' };
      }
    },
    onSuccess: (data) => {
      // console.log('✅ Quiz results submitted:', data);
      toast.success(t('results.title'));
    },
    onError: (error) => {
      console.log('⚠️ Quiz submission error (non-critical):', error);
    }
  });

  // Initialize quiz when component mounts
  useEffect(() => {
    if (!questions.length && !isQuizComplete && stats !== undefined) {
      // console.log('🚀 Auto-starting quiz generation...');
      generateQuizMutation.mutate();
    }
  }, [stats, questions.length, isQuizComplete, userPreferences]);

  // useEffect(() => {
  //   console.log('QuizPage: userPreferences updated:', userPreferences);
  //   console.log('QuizPage: quiz_word_count:', userPreferences?.quiz_word_count);
  // }, [userPreferences]);

  // Event handlers
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const handleAnswerSelect = (answerIndex: number) => {
    if (selectedAnswer !== null) return; // Prevent multiple selections
    
    setSelectedAnswer(answerIndex);
    
    // Auto-advance to next question after a brief delay
    setTimeout(() => {
      // Process the answer immediately without needing the separate handleNextQuestion
      if (!currentQuestion) return;

      const timeSpent = Date.now() - startTime;
      const isCorrect = answerIndex === currentQuestion.correctAnswer;

      const result: QuizResult = {
        questionId: currentQuestion.id,
        selectedAnswer: answerIndex,
        isCorrect,
        timeSpent
      };

      const newResults = [...results, result];
      setResults(newResults);

      if (currentQuestionIndex === questions.length - 1) {
        // Last question - finish quiz
        setIsQuizComplete(true);
        submitQuizMutation.mutate(newResults);
      } else {
        // Move to next question
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer(null);
        setStartTime(Date.now());
      }
    }, 1500); // 1.5 second delay to show the selected answer
  };

  const handleNextQuestion = () => {
    if (selectedAnswer === null || !currentQuestion) return;

    const timeSpent = Date.now() - startTime;
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

    const result: QuizResult = {
      questionId: currentQuestion.id,
      selectedAnswer,
      isCorrect,
      timeSpent
    };

    const newResults = [...results, result];
    setResults(newResults);

    if (isLastQuestion) {
      setIsQuizComplete(true);
      // Submit results to backend
      submitQuizMutation.mutate(newResults);
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setStartTime(Date.now());
    }
  };

  const calculateScore = () => {
    const correct = results.filter(r => r.isCorrect).length;
    return Math.round((correct / results.length) * 100);
  };

  const handleRetakeQuiz = () => {
    setIsQuizComplete(false);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setResults([]);
    setStartTime(Date.now());
    generateQuizMutation.mutate();
  };

  const handleFinishQuiz = () => {
    navigate('/app/progress', {
      state: {
        quizCompleted: true,
        results: {
          correct: results.filter(r => r.isCorrect).length,
          total: results.length,
          score: calculateScore(),
          timeSpent: results.reduce((sum, r) => sum + r.timeSpent, 0),
        }
      }
    });
  };

  // Loading state
  if (generateQuizMutation.isPending || stats === undefined) {
    return <LoadingSpinner fullScreen text="Generating quiz from your learned words..." />;
  }

  // Error state - specifically for no learned words
  if (generateQuizMutation.error || (!questions.length && !isQuizComplete)) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🧠</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          No Learned Words Available for Quiz
        </h2>
        <p className="text-gray-600 mb-6">
          Quiz mode is only available for words you have already learned. 
          Complete some learning modules first to unlock quiz sessions!
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => navigate('/app/learning')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            <BookOpenIcon className="w-5 h-5 inline mr-2" />
            Start Learning
          </button>
          <button
            onClick={() => navigate('/app/words')}
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Browse Words
          </button>
        </div>
      </div>
    );
  }

  // Quiz completion state
  if (isQuizComplete) {
    const score = calculateScore();
    const correctAnswers = results.filter(r => r.isCorrect).length;
    const totalTime = results.reduce((sum, r) => sum + r.timeSpent, 0);

    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">
            {score >= 80 ? '🏆' : score >= 60 ? '👏' : '📚'}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Quiz Complete!
          </h1>
          <p className="text-xl text-gray-600">
            You scored {correctAnswers} out of {results.length} ({score}%)
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Quiz Results</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{correctAnswers}</div>
              <div className="text-sm text-gray-600">Correct Answers</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{score}%</div>
              <div className="text-sm text-gray-600">Score</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(totalTime / 1000)}s
              </div>
              <div className="text-sm text-gray-600">Total Time</div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Question Review:</h3>
            {results.map((result, index) => {
              const question = questions[index];
              return (
                <div 
                  key={index}
                  className={`p-3 rounded-lg flex items-center justify-between ${
                    result.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  } border`}
                >
                  <div>
                    <span className="font-medium">{question.word}</span>
                    <span className="text-gray-600 ml-2">→ {question.translation}</span>
                  </div>
                  <div className="flex items-center">
                    {result.isCorrect ? (
                      <CheckCircleIcon className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircleIcon className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={handleRetakeQuiz}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center"
          >
            <ArrowRightIcon className="w-5 h-5 mr-2" />
            Retake Quiz
          </button>
          <button
            onClick={handleFinishQuiz}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center"
          >
            <TrophyIcon className="w-5 h-5 mr-2" />
            View Progress
          </button>
        </div>
      </div>
    );
  }

  // Quiz in progress
  if (!currentQuestion) {
    return <LoadingSpinner fullScreen text="Loading quiz question..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-blue-600">
                <BookOpenIcon className="w-5 h-5" />
                <span className="font-medium">Quiz Session</span>
              </div>
              <span className="text-gray-400">•</span>
              <span className="text-sm text-gray-600">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <ClockIcon className="w-4 h-4 inline mr-1" />
                Quiz in Progress
              </div>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              What does "{currentQuestion.word}" mean?
            </h2>
            <p className="text-gray-600">
              Choose the correct translation
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(index)}
                disabled={selectedAnswer !== null} // Disable after selection
                className={`p-4 text-left rounded-lg border-2 transition-all ${
                  selectedAnswer === index
                    ? 'border-blue-500 bg-blue-50'
                    : selectedAnswer !== null
                    ? 'border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="font-medium">{option}</span>
              </button>
            ))}
          </div>

          {/* Show selected answer feedback */}
          {selectedAnswer !== null && (
            <div className="text-center mt-6">
              <div className="text-lg font-medium text-blue-600">
                Answer selected! Moving to next question...
              </div>
            </div>
          )}

          {/* Next Button - Hidden during auto-advance */}
          {selectedAnswer === null && (
            <div className="text-center mt-8">
              <button
                onClick={handleNextQuestion}
                disabled={selectedAnswer === null}
                className="bg-gray-300 text-gray-500 cursor-not-allowed px-8 py-3 rounded-lg font-semibold"
              >
                Select an answer to continue
              </button>
            </div>
          )}
        </div>

        {/* Session Progress */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Progress</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {results.filter(r => r.isCorrect).length}
              </div>
              <div className="text-sm text-gray-600">Correct</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {results.filter(r => !r.isCorrect).length}
              </div>
              <div className="text-sm text-gray-600">Incorrect</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {results.length > 0 
                  ? Math.round((results.filter(r => r.isCorrect).length / results.length) * 100)
                  : 0
                }%
              </div>
              <div className="text-sm text-gray-600">Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {questions.length}
              </div>
              <div className="text-sm text-gray-600">Total Questions</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizPage;