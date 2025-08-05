// src/pages/learning/PracticePage.tsx - Enhanced with Combined Scenarios
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { 
  PlayIcon, 
  PauseIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  SpeakerWaveIcon,
  ClockIcon,
  TrophyIcon,
  BookOpenIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';

import { learningAPI } from '../../services/learningAPI';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import api from '../../services/api';

interface PracticeWord {
  id: number;
  kazakh_word: string;
  kazakh_cyrillic?: string;
  translation: string;
}

interface ScenarioQuestion {
  word: PracticeWord;
  question: string;
  correctAnswer: string;
  userAnswer?: string;
}

const PracticePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation('practice');
  const [searchParams] = useSearchParams();
  
  // Session state
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [scenarioQuestions, setScenarioQuestions] = useState<ScenarioQuestion[]>([]);
  const [userAnswer, setUserAnswer] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionResults, setSessionResults] = useState<{
    word_id: number;
    correct: boolean;
    user_answer: string;
    response_time: number;
  }[]>([]);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [isPaused, setIsPaused] = useState(false);

  // URL parameters
  const practiceType = searchParams.get('type') || 'combined';
  const categoryId = searchParams.get('category') ? parseInt(searchParams.get('category')!) : undefined;

  // Get learning stats
  const { data: stats } = useQuery({
    queryKey: ['learning-stats'],
    queryFn: learningAPI.getStats,
  });

  // Fetch user preferences to get practice_word_count
  const { data: userPreferences } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      const response = await api.get('/api/preferences/');
      return response.data;
    },
  });

  // Get word count from user's preferences, fallback to 9
  const wordCount = userPreferences?.practice_word_count || 9;

  // 🎯 MODIFIED: Get learned words using existing learningAPI.getProgress
  const startSessionMutation = useMutation({
    mutationFn: async () => {
      console.log('🔍 Starting COMBINED SCENARIOS practice with LEARNED words only...');
      console.log('Practice type from URL:', practiceType);
      console.log('Category filter:', categoryId);
      console.log('Word count from URL:', wordCount);
      
      try {
        // Get learned words using existing learningAPI.getProgress method
        console.log('📚 Fetching learned words...');
        
        const learnedWordsResponse = await learningAPI.getProgress({
          status: 'learned', // Only learned words
          category_id: categoryId,
          limit: 100, // Get all learned words
          offset: 0
        });
        
        console.log('📊 Learned words response:', learnedWordsResponse);
        console.log(`📈 Total learned words found: ${learnedWordsResponse.length}`);
        
        if (learnedWordsResponse.length === 0) {
          throw new Error('No learned words available for practice. Please complete some learning modules first to unlock practice mode.');
        }

        // Convert progress objects to practice words with correct language handling
        const practiceWords: PracticeWord[] = learnedWordsResponse
          .filter(progress => progress.kazakh_word)
          .map(progress => {
            const word = progress.kazakh_word;
            
            // Get translation in user's main language
            let translation = 'No translation';
            if (word.translations && word.translations.length > 0) {
              // Try to find translation in user's main language
              const userLangTranslation = word.translations.find(t => 
                t.language_code === user?.main_language?.language_code
              );
              
              if (userLangTranslation) {
                translation = userLangTranslation.translation;
              } else {
                // Fallback to first available translation (likely English)
                translation = word.translations[0].translation;
              }
            }
            
            return {
              id: word.id,
              kazakh_word: word.kazakh_word,
              kazakh_cyrillic: word.kazakh_cyrillic,
              translation: translation
            };
          });

        console.log(`🔄 Converted ${practiceWords.length} learned words to practice format`);

        // Shuffle and limit words
        const shuffledWords = [...practiceWords].sort(() => Math.random() - 0.5);
        const selectedWords = shuffledWords.slice(0, Math.min(wordCount, shuffledWords.length));

        // Generate simple translation questions
        const questions = generateTranslationQuestions(selectedWords);
        setScenarioQuestions(questions);

        // Create a mock session (since we're working with learned words directly)
        const mockSessionId = Date.now();
        setSessionId(mockSessionId);
        setStartTime(Date.now());
        setQuestionStartTime(Date.now());

        console.log(`🎯 Generated ${questions.length} translation questions`);
        return {
          session_id: mockSessionId,
          words: selectedWords,
          questions: questions.length,
          total_questions: questions.length
        };
        
      } catch (error) {
        console.error('❌ Error starting practice session:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('✅ Translation practice session started:', data);
      toast.success(`Practice started with ${data.questions} translation questions!`);
    },
    onError: (error: any) => {
      console.error('❌ Failed to start practice session:', error);
      const errorMessage = error?.message || 'Failed to start practice session';
      toast.error(errorMessage);
    },
  });

  // Generate simple translation questions from words
  const generateTranslationQuestions = (words: PracticeWord[]): ScenarioQuestion[] => {
    return words.map(word => ({
      word,
      question: `What does "${word.kazakh_word}" mean?`,
      correctAnswer: word.translation,
    }));
  };

  // Submit answer mutation
  const submitAnswerMutation = useMutation({
    mutationFn: async (data: {
      sessionId: number;
      wordId: number;
      wasCorrect: boolean;
      userAnswer: string;
      correctAnswer: string;
      responseTime: number;
    }) => {
      console.log('📝 Submitting translation answer:', data);
      
      // For learned words practice, we'll log locally since we're not using the traditional session system
      return { success: true, message: 'Answer logged for translation practice' };
    },
    onSuccess: () => {
      console.log('✅ Translation answer submitted successfully');
    },
  });

  // Initialize session when component mounts
  useEffect(() => {
    if (!sessionId && stats !== undefined && userPreferences !== undefined) {
      console.log('🚀 Auto-starting translation practice session...');
      startSessionMutation.mutate();
    }
  }, [stats, sessionId, userPreferences]);

  // Event handlers
  const handleSubmitAnswer = () => {
    const currentQuestion = scenarioQuestions[currentQuestionIndex];
    if (!currentQuestion || !sessionId) return;

    const finalAnswer = userAnswer.trim();
    const isCorrect = finalAnswer.toLowerCase() === currentQuestion.correctAnswer.toLowerCase();
    const responseTime = Date.now() - questionStartTime;

    // Submit to backend
    submitAnswerMutation.mutate({
      sessionId,
      wordId: currentQuestion.word.id,
      wasCorrect: isCorrect,
      userAnswer: finalAnswer,
      correctAnswer: currentQuestion.correctAnswer,
      responseTime,
    });

    // Store result locally
    setSessionResults(prev => [...prev, {
      word_id: currentQuestion.word.id,
      correct: isCorrect,
      user_answer: finalAnswer,
      response_time: responseTime,
    }]);

    // Update question with user answer
    setScenarioQuestions(prev => prev.map((q, index) => 
      index === currentQuestionIndex 
        ? { ...q, userAnswer: finalAnswer }
        : q
    ));

    setShowAnswer(true);
  };

  const handleNextQuestion = () => {
    if (isLastQuestion) {
      handleFinishSession();
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
      setUserAnswer('');
      setShowAnswer(false);
      setQuestionStartTime(Date.now());
    }
  };

  const handleFinishSession = () => {
    if (!sessionId) return;

    const duration = Math.floor((Date.now() - startTime) / 1000);
    
    // Navigate to progress page with results
    const correct = sessionResults.filter(r => r.correct).length;
    const total = sessionResults.length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    navigate('/app/progress', {
      state: {
        sessionCompleted: true,
        sessionType: 'translation_practice',
        wordSource: 'learned',
        results: {
          correct,
          total,
          accuracy,
          duration,
        }
      }
    });
  };

  const handleSkip = () => {
    const currentQuestion = scenarioQuestions[currentQuestionIndex];
    if (currentQuestion && sessionId) {
      submitAnswerMutation.mutate({
        sessionId,
        wordId: currentQuestion.word.id,
        wasCorrect: false,
        userAnswer: 'skipped',
        correctAnswer: currentQuestion.correctAnswer,
        responseTime: Date.now() - questionStartTime,
      });

      setSessionResults(prev => [...prev, {
        word_id: currentQuestion.word.id,
        correct: false,
        user_answer: 'skipped',
        response_time: Date.now() - questionStartTime,
      }]);
    }

    handleNextQuestion();
  };

  // Get current question and progress
  const currentQuestion = scenarioQuestions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === scenarioQuestions.length - 1;
  const progress = scenarioQuestions.length > 0 ? ((currentQuestionIndex + 1) / scenarioQuestions.length) * 100 : 0;

  // Loading state
  if (startSessionMutation.isPending || stats === undefined || userPreferences === undefined) {
    return <LoadingSpinner fullScreen text="Starting translation practice..." />;
  }

  // Error state - specifically for no learned words
  if (startSessionMutation.error || !currentQuestion) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📚</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          No Learned Words Available
        </h2>
        <p className="text-gray-600 mb-6">
          Translation practice is only available for words you have already learned.
          Complete some learning modules first to unlock this practice mode.
        </p>
        <div className="space-x-4">
          <button
            onClick={() => navigate('/app/learning-module')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start Learning
          </button>
          <button
            onClick={() => navigate('/app/dashboard')}
            className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
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
                <span className="font-medium">Translation Practice</span>
              </div>
              <span className="text-gray-400">•</span>
              <span className="text-sm text-gray-600">
                Question {currentQuestionIndex + 1} of {scenarioQuestions.length}
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <ClockIcon className="w-4 h-4 inline mr-1" />
                {Math.floor((Date.now() - startTime) / 1000 / 60)}:{String(Math.floor(((Date.now() - startTime) / 1000) % 60)).padStart(2, '0')}
              </div>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
          {/* Current word display */}
          <div className="text-center mb-8">
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">
                {currentQuestion.word.kazakh_word}
              </h2>
              {currentQuestion.word.kazakh_cyrillic && (
                <p className="text-lg text-gray-600">{currentQuestion.word.kazakh_cyrillic}</p>
              )}
            </div>
          </div>

          {/* Question */}
          <div className="text-center mb-8">
            <p className="text-xl font-medium text-gray-800 mb-6">
              {currentQuestion.question}
            </p>

            {/* Answer Input */}
            {!showAnswer && (
              <div className="max-w-md mx-auto">
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Type your answer..."
                  className="w-full p-4 border-2 border-gray-200 rounded-lg text-center text-lg focus:border-blue-500 focus:outline-none"
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmitAnswer()}
                  autoFocus
                />
              </div>
            )}

            {/* Answer Result */}
            {showAnswer && (
              <div className="max-w-md mx-auto">
                <div className={`p-4 rounded-lg border-2 ${
                  currentQuestion.userAnswer?.toLowerCase() === currentQuestion.correctAnswer.toLowerCase()
                    ? 'border-green-500 bg-green-50'
                    : 'border-red-500 bg-red-50'
                }`}>
                  <div className="flex items-center justify-center mb-2">
                    {currentQuestion.userAnswer?.toLowerCase() === currentQuestion.correctAnswer.toLowerCase() ? (
                      <CheckCircleIcon className="w-6 h-6 text-green-600 mr-2" />
                    ) : (
                      <XCircleIcon className="w-6 h-6 text-red-600 mr-2" />
                    )}
                    <span className={`font-medium ${
                      currentQuestion.userAnswer?.toLowerCase() === currentQuestion.correctAnswer.toLowerCase()
                        ? 'text-green-800'
                        : 'text-red-800'
                    }`}>
                      {currentQuestion.userAnswer?.toLowerCase() === currentQuestion.correctAnswer.toLowerCase()
                        ? 'Correct!'
                        : 'Incorrect'
                      }
                    </span>
                  </div>
                  
                  {currentQuestion.userAnswer?.toLowerCase() !== currentQuestion.correctAnswer.toLowerCase() && (
                    <div className="text-sm text-gray-700">
                      <p><strong>Your answer:</strong> {currentQuestion.userAnswer}</p>
                      <p><strong>Correct answer:</strong> {currentQuestion.correctAnswer}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center space-x-4">
            {!showAnswer ? (
              <>
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!userAnswer.trim()}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Submit Answer
                </button>
                <button
                  onClick={handleSkip}
                  className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                >
                  Skip
                </button>
              </>
            ) : (
              <button
                onClick={handleNextQuestion}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <span>{isLastQuestion ? 'Finish Practice' : 'Next Question'}</span>
                <ArrowRightIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Session Stats */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Progress</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {sessionResults.filter(r => r.correct).length}
              </div>
              <div className="text-sm text-gray-600">Correct</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {sessionResults.filter(r => !r.correct).length}
              </div>
              <div className="text-sm text-gray-600">Incorrect</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {sessionResults.length > 0 
                  ? Math.round((sessionResults.filter(r => r.correct).length / sessionResults.length) * 100)
                  : 0
                }%
              </div>
              <div className="text-sm text-gray-600">Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {scenarioQuestions.length}
              </div>
              <div className="text-sm text-gray-600">Total Questions</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticePage;