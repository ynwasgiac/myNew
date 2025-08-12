// src/pages/learning/PracticePage.tsx - Inline Letter Hints
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
  AcademicCapIcon,
  LightBulbIcon // ДОБАВЛЕНО: иконка для подсказок
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';

import { learningAPI } from '../../services/learningAPI';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import api from '../../services/api';
// ДОБАВЛЕНО: импорт помощника подсказок
import { LetterHintHelper, LetterHintState } from '../../utils/letterHintHelper';

type PracticeMethod = 'kaz_to_translation' | 'translation_to_kaz';

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
  method: PracticeMethod; 
}

interface PracticePreferences {
  practice_word_count: number;
  practice_method?: 'kaz_to_translation' | 'translation_to_kaz'; 
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

  // ДОБАВЛЕНО: состояния для подсказок букв
  const [hintHelper, setHintHelper] = useState<LetterHintHelper | null>(null);
  const [hintState, setHintState] = useState<LetterHintState | null>(null);
  const [isHintMode, setIsHintMode] = useState(false);

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
  const practiceMethod: PracticeMethod = (userPreferences as any)?.practice_method || 'kaz_to_translation';
  const wordCount = userPreferences?.practice_word_count || 9;

  console.log('🎯 Practice method from settings:', practiceMethod);

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

        // Shuffle and select words for practice
        const shuffledWords = [...learnedWordsResponse].sort(() => Math.random() - 0.5);
        const practiceWords = shuffledWords.slice(0, Math.min(wordCount, shuffledWords.length));

        // Create scenario questions
        const questions: ScenarioQuestion[] = practiceWords.map(wordProgress => {
          const word: PracticeWord = {
            id: wordProgress.kazakh_word.id,
            kazakh_word: wordProgress.kazakh_word.kazakh_word,
            kazakh_cyrillic: wordProgress.kazakh_word.kazakh_cyrillic,
            translation: wordProgress.kazakh_word.translations?.[0]?.translation || 'No translation'
          };

          if (practiceMethod === 'kaz_to_translation') {
            return {
              word,
              question: `What does "${word.kazakh_word}" mean?`,
              correctAnswer: word.translation,
              method: 'kaz_to_translation'
            };
          } else {
            return {
              word,
              question: `How do you say "${word.translation}" in Kazakh?`,
              correctAnswer: word.kazakh_word,
              method: 'translation_to_kaz'
            };
          }
        });

        // Create practice session
        const sessionData = await learningAPI.startPracticeSession({
          session_type: 'combined_scenarios',
          word_count: wordCount,
          category_id: categoryId,
          language_code: 'en'
        });

        console.log('✅ Practice session created:', sessionData);

        setSessionId(sessionData.session_id);
        setScenarioQuestions(questions);
        setQuestionStartTime(Date.now());

        return { session: sessionData, questions };

      } catch (error) {
        console.error('❌ Error starting practice session:', error);
        throw error;
      }
    },
    onError: (error: any) => {
      console.error('Failed to start practice session:', error);
      toast.error(error.message || 'Failed to start practice session');
    }
  });

  // Submit answer mutation
  const submitAnswerMutation = useMutation({
    mutationFn: async (params: {
      sessionId: number;
      wordId: number;
      wasCorrect: boolean;
      userAnswer: string;
      correctAnswer: string;
      responseTime: number;
    }) => {
      return await learningAPI.submitPracticeAnswer(params.sessionId, {
        word_id: params.wordId,
        was_correct: params.wasCorrect,
        user_answer: params.userAnswer,
        correct_answer: params.correctAnswer,
        response_time_ms: params.responseTime
      });
    }
  });

  // Initialize session
  useEffect(() => {
    if (stats && !sessionId && userPreferences) {
      startSessionMutation.mutate();
    }
  }, [stats, sessionId, userPreferences]);

  const currentQuestion = scenarioQuestions[currentQuestionIndex];
  // ДОБАВЛЕНО: инициализация помощника подсказок при смене вопроса
  useEffect(() => {
    if (currentQuestion && !showAnswer) {
      const helper = new LetterHintHelper(currentQuestion.correctAnswer);
      setHintHelper(helper);
      setHintState(helper.getState());
      setIsHintMode(false);
    }
  }, [currentQuestion, showAnswer]);

  // ДОБАВЛЕНО: обновление состояния подсказок при вводе пользователя
  useEffect(() => {
    if (hintHelper && isHintMode) {
      const newState = hintHelper.updateUserInput(userAnswer);
      setHintState(newState);
    }
  }, [userAnswer, hintHelper, isHintMode]);

  // ДОБАВЛЕНО: функция получения подсказки (улучшенная)
  const handleGetHint = () => {
    if (!hintHelper) return;
  
    setIsHintMode(true);
    const newState = hintHelper.getNextHint(userAnswer); // << передаём текущий ввод
    setHintState(newState);
    setUserAnswer(newState.hintedPart);                  // << просто перезаписываем инпут тем, что собрал хелпер
  
    setTimeout(() => {
      const input = document.querySelector('input[type="text"]') as HTMLInputElement | null;
      if (input) {
        const len = newState.hintedPart.length;
        input.focus();
        input.setSelectionRange(len, len);
      }
    }, 0);
  };

  // Event handlers (ваши оригинальные функции)
  const handleSubmitAnswer = () => {
    const currentQuestion = scenarioQuestions[currentQuestionIndex];
    if (!currentQuestion || !sessionId) return;

    const finalAnswer = userAnswer.trim();
    
    // ОБНОВЛЕННАЯ ЛОГИКА ПРОВЕРКИ ОТВЕТА
    let isCorrect = false;
    
    if (currentQuestion.method === 'kaz_to_translation') {
      // Для перевода с казахского - более гибкая проверка
      const userLower = finalAnswer.toLowerCase();
      const correctLower = currentQuestion.correctAnswer.toLowerCase();
      
      // Точное совпадение или содержание ключевых слов
      isCorrect = userLower === correctLower || 
                  correctLower.includes(userLower) || 
                  userLower.includes(correctLower);
    } else {
      // Для ввода казахского слова - точное совпадение
      isCorrect = finalAnswer.toLowerCase() === currentQuestion.correctAnswer.toLowerCase();
    }

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
      // ДОБАВЛЕНО: сброс состояния подсказок
      setIsHintMode(false);
      setHintState(null);
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

  // Get current question and progress (ваш оригинальный код)
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
        {/* Header (ваш оригинальный код) */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-blue-600">
                <BookOpenIcon className="w-5 h-5" />
                <span className="font-medium">
                  {practiceMethod === 'kaz_to_translation' ? '🇰🇿 → 🌍' : '🌍 → 🇰🇿'} Practice
                </span>
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
  
          {/* Practice Method Description */}
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded mt-4 flex items-center justify-between">
            <span>
              {practiceMethod === 'kaz_to_translation' 
                ? 'Recognition Mode: See Kazakh words, provide translations' 
                : 'Production Mode: See translations, write Kazakh words'
              }
            </span>
            <button
              onClick={() => navigate('/app/settings')}
              className="text-blue-500 hover:text-blue-600 text-xs underline"
            >
              Change
            </button>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {currentQuestion.question}
            </h2>
            <p className="text-gray-600">Type your answer below</p>
          </div>

          {!showAnswer ? (
            <div className="space-y-6">
              {/* МОДИФИЦИРОВАНО: Поле ввода с встроенными подсказками */}
              <div className="relative">
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && userAnswer.trim()) {
                      handleSubmitAnswer();
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  placeholder="Type your answer here..."
                  disabled={showAnswer}
                  autoFocus
                  style={{
                    // ДОБАВЛЕНО: стилизация для режима подсказок
                    backgroundColor: isHintMode ? '#fefce8' : 'white',
                    borderColor: isHintMode ? '#facc15' : undefined,
                    color: '#1f2937'
                  }}
                />
                {/* ДОБАВЛЕНО: индикатор прогресса подсказок */}
                {isHintMode && hintState && (
                  <div className="absolute -bottom-6 left-0 right-0 flex justify-between items-center text-xs text-gray-500">
                    <span className="flex items-center space-x-1">
                      <span className="text-yellow-600">💡</span>
                      <span>Hints: {hintHelper?.getProgress()}% complete</span>
                    </span>
                    {hintState.errors > 0 && (
                      <span className="text-red-500">Errors: {hintState.errors}</span>
                    )}
                  </div>
                )}
              </div>

              {/* ДОБАВЛЕНО: дополнительное пространство когда активны подсказки */}
              {isHintMode && <div className="h-2"></div>}

              {/* Action Buttons - МОДИФИЦИРОВАНО */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <div className="flex gap-3">
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
                </div>
                
                {/* ДОБАВЛЕНО: Кнопка подсказки */}
                {hintHelper && !hintState?.isCompleted && (
                  <button
                    onClick={handleGetHint}
                    className="flex items-center space-x-2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg hover:bg-yellow-200 transition-colors text-sm font-medium"
                    title={isHintMode ? `Letters revealed: ${hintState?.hintedPart.length || 0}` : 'Get the next letter as a hint'}
                  >
                    <LightBulbIcon className="w-4 h-4" />
                    <span>{isHintMode ? 'Next Letter' : 'Help me'}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center space-y-6">
              {/* Answer Result */}
              <div className={`text-3xl font-bold ${
                sessionResults[currentQuestionIndex]?.correct ? 'text-green-600' : 'text-red-600'
              }`}>
                {sessionResults[currentQuestionIndex]?.correct ? '✅ Correct!' : '❌ Incorrect'}
              </div>

              {/* Correct Answer Display */}
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-lg mb-2">
                  <strong>"{currentQuestion.word.kazakh_word}"</strong> means{' '}
                  <strong className="text-blue-600">"{currentQuestion.correctAnswer}"</strong>
                </p>
                {!sessionResults[currentQuestionIndex]?.correct && (
                  <p className="text-gray-600">
                    Your answer: <span className="font-medium">"{userAnswer}"</span>
                  </p>
                )}
              </div>

              {/* Next Button */}
              <button
                onClick={handleNextQuestion}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto"
              >
                <span>{isLastQuestion ? 'Finish Practice' : 'Next Question'}</span>
                <ArrowRightIcon className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
  
        {/* Session Stats (ваш оригинальный код) */}
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

          {/* Practice Method Info */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-700">Practice Mode:</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  practiceMethod === 'kaz_to_translation' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  {practiceMethod === 'kaz_to_translation' ? '🇰🇿 → 🌍 Recognition' : '🌍 → 🇰🇿 Production'}
                </span>
              </div>
              <button
                onClick={() => navigate('/app/settings')}
                className="text-xs text-blue-500 hover:text-blue-600 underline"
              >
                Change Method
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {practiceMethod === 'kaz_to_translation' 
                ? "Recognition mode: See Kazakh words, type meanings. Good for building vocabulary." 
                : "Production mode: See meanings, type Kazakh words. More challenging, builds active skills."
              }
            </p>

            {/* ДОБАВЛЕНО: компактная информация о функции подсказок */}
            <div className="mt-3 p-2 bg-yellow-50 rounded border-l-2 border-yellow-300">
              <div className="flex items-center space-x-1 text-xs">
                <LightBulbIcon className="w-3 h-3 text-yellow-600" />
                <span className="text-yellow-800 font-medium">Letter Hints:</span>
                <span className="text-yellow-700">Click "Help me" to reveal letters one by one in the input field.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticePage;