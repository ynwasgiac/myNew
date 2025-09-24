// src/pages/learning/QuizPage.tsx - Updated to create session on first answer
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
  // NEW: Track if session has been created
  const [sessionCreated, setSessionCreated] = useState(false);

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

  // 🎯 UPDATED: Generate quiz questions without creating session
  const generateQuizMutation = useMutation({
    mutationFn: async () => {
      if (!userPreferences) {
        throw new Error('User preferences not loaded yet');
      }
      
      const questionCount = userPreferences.quiz_word_count || 9;
      
      try {
        const learnedWordsResponse = await learningAPI.getLearnedWords({
          limit: 100,
          include_mastered: false,
          language_code: getUserLanguage(),
          category_id: categoryId,
          difficulty_level_id: difficultyLevelId,
          offset: 0
        });
        
        if (learnedWordsResponse.length === 0) {
          throw new Error('No learned words available for quiz. Please complete some learning modules first to unlock quiz mode.');
        }
        
        // Convert to quiz word format
        const quizWords: QuizWord[] = learnedWordsResponse.map((wordData: any) => {
          return {
            id: wordData.id,
            kazakh_word: wordData.kazakh_word,
            kazakh_cyrillic: wordData.kazakh_cyrillic,
            translation: wordData.translation,
            pronunciation: wordData.pronunciation,
            image_url: wordData.image_url,
            difficulty_level: 1,
          };
        });
        
        if (quizWords.length < 4) {
          throw new Error('Need at least 4 learned words to create a proper quiz. Please learn more words first.');
        }
        
        const maxQuestions = Math.min(questionCount, quizWords.length);
        const selectedWords = quizWords
          .sort(() => Math.random() - 0.5)
          .slice(0, maxQuestions);
        
        // Generate quiz questions
        const questions: LocalQuizQuestion[] = selectedWords.map((word, index) => {
          const otherWords = quizWords.filter(w => w.id !== word.id);
          const wrongAnswers = otherWords
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .map(w => w.translation);
          
          while (wrongAnswers.length < 3) {
            wrongAnswers.push(`Sample translation ${wrongAnswers.length + 1}`);
          }
          
          const allOptions = [word.translation, ...wrongAnswers];
          const correctAnswer = Math.floor(Math.random() * 4);
          
          const finalOptions = [...allOptions];
          if (correctAnswer !== 0) {
            [finalOptions[0], finalOptions[correctAnswer]] = [finalOptions[correctAnswer], finalOptions[0]];
          }
          
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
        
        // =============================================
        // UPDATED: Don't create session yet, just return questions
        // =============================================
        
        return {
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
      setQuestions(data.questions);
      setStartTime(Date.now());
      
      toast.success(t('toasts.quizStarted', { count: data.questions.length }));
    },
    onError: (error) => {
      console.error('❌ Quiz generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate quiz';
      toast.error(errorMessage);
    }
  });

  // NEW: Create session mutation (called on first answer)
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      try {
        // Try to create session through backend endpoint
        const sessionResponse = await api.post('/learning/quiz/start', {
          category_id: categoryId,
          difficulty_level_id: difficultyLevelId,
          question_count: questions.length,
          language_code: getUserLanguage()
        });
        
        // console.log('✅ Quiz session created in database:', sessionResponse.data.session_id);
        return sessionResponse.data.session_id;
        
      } catch (error) {
        // If backend endpoint doesn't work, use random ID for local tracking
        console.warn('Could not create backend session, using local ID:', error);
        const localId = Math.floor(Math.random() * 10000);
        return localId;
      }
    },
    onSuccess: (sessionIdFromServer) => {
      setSessionId(sessionIdFromServer);
      setSessionCreated(true);
      console.log('✅ Session created with ID:', sessionIdFromServer);
    },
    onError: (error) => {
      console.error('❌ Session creation error:', error);
      // Even if session creation fails, continue with local ID
      const fallbackId = Math.floor(Math.random() * 10000);
      setSessionId(fallbackId);
      setSessionCreated(true);
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

  // Event handlers
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const handleAnswerSelect = (answerIndex: number) => {
    if (selectedAnswer !== null) return; // Prevent multiple selections
    
    setSelectedAnswer(answerIndex);
    
    // =============================================
    // NEW: Create session on first answer only
    // =============================================
    if (!sessionCreated && currentQuestionIndex === 0) {
      // console.log('🎯 First answer selected - creating session...');
      createSessionMutation.mutate();
    }
    
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

    // Create session on first answer if not already created
    if (!sessionCreated && currentQuestionIndex === 0) {
      console.log('🎯 First answer submitted - creating session...');
      createSessionMutation.mutate();
    }

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
    setSessionId(undefined);
    setSessionCreated(false); // Reset session creation flag
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
    return <LoadingSpinner fullScreen text={t('loading.generating')} />;
  }

  // Error state - specifically for no learned words
  if (generateQuizMutation.error || (!questions.length && !isQuizComplete)) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🧠</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('errors.noLearnedWordsTitle')}</h2>
        <p className="text-gray-600 mb-6">{t('errors.noLearnedWordsDesc')}</p>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => navigate('/app/learning')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            <BookOpenIcon className="w-5 h-5 inline mr-2" />
            {t('buttons.startLearning')}
          </button>
          <button
            onClick={() => navigate('/app/words')}
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            {t('buttons.browseWords')}
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('results.completeTitle')}</h1>
          <p className="text-xl text-gray-600">
            {t('results.scoreLine', { correct: correctAnswers, total: results.length, score })}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">{t('results.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{correctAnswers}</div>
              <div className="text-sm text-gray-600">{t('results.cards.correctAnswers')}</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{score}%</div>
              <div className="text-sm text-gray-600">{t('results.cards.score')}</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(totalTime / 1000)}s
              </div>
              <div className="text-sm text-gray-600">{t('results.cards.totalTime')}</div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">{t('results.questionReview')}</h3>
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
            {t('buttons.retakeQuiz')}
          </button>
          <button
            onClick={handleFinishQuiz}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center"
          >
            <TrophyIcon className="w-5 h-5 mr-2" />
            {t('buttons.viewProgress')}
          </button>
        </div>
      </div>
    );
  }

  // Quiz in progress
  if (!currentQuestion) {
    return <LoadingSpinner fullScreen text={t('loading.question')} />;
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
                <span className="font-medium">{t('header.session')}</span>
                {/* Show session status indicator */}
                {sessionCreated && sessionId && (
                  <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                    Session #{sessionId}
                  </span>
                )}
              </div>
              <span className="text-gray-400">•</span>
              <span className="text-sm text-gray-600">
                {t('header.questionOf', { current: currentQuestionIndex + 1, total: questions.length })}
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <ClockIcon className="w-4 h-4 inline mr-1" />
                {t('header.inProgress')}
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
              {t('questions.whatMeans', { word: currentQuestion.word })}
            </h2>
            <p className="text-gray-600">{t('questions.chooseTranslation')}</p>
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
                {t('feedback.answerSelected')}
              </div>
              {/* Show session creation status on first question */}
              {currentQuestionIndex === 0 && createSessionMutation.isPending && (
                <div className="text-sm text-gray-500 mt-2">
                  Creating session...
                </div>
              )}
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
                {t('buttons.selectToContinue')}
              </button>
            </div>
          )}
        </div>

        {/* Session Progress */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('progress.session')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {results.filter(r => r.isCorrect).length}
              </div>
              <div className="text-sm text-gray-600">{t('progress.correct')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {results.filter(r => !r.isCorrect).length}
              </div>
              <div className="text-sm text-gray-600">{t('progress.incorrect')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {results.length > 0 
                  ? Math.round((results.filter(r => r.isCorrect).length / results.length) * 100)
                  : 0
                }%
              </div>
              <div className="text-sm text-gray-600">{t('progress.accuracy')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {questions.length}
              </div>
              <div className="text-sm text-gray-600">{t('progress.total')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizPage;