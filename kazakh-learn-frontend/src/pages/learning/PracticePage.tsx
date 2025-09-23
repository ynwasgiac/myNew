// src/pages/learning/PracticePage.tsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { 
  ArrowRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  TrophyIcon,
  BookOpenIcon,
  LightBulbIcon
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { learningAPI } from '../../services/learningAPI';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import api from '../../services/api';
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

const PracticePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation(['practice', 'common']);
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

  // Hint system state
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

  // console.log('🎯 Practice method from settings:', practiceMethod);

  // Start session mutation - using getLearnedWords
  const startSessionMutation = useMutation({
    mutationFn: async () => {
      // console.log('🔍 Starting practice with practiceType:', practiceType);
      // console.log('Category filter:', categoryId);
      // console.log('Word count from settings:', wordCount);
      
      try {
        const userLanguage = user?.main_language?.language_code || 'en';

        // ТОЛЬКО ДЛЯ type=review используем новую логику
        if (practiceType === 'review') {
          console.log('📚 Fetching words for REVIEW...');
          
          const reviewWords = await learningAPI.getWordsForReview(wordCount, userLanguage);
          console.log('📊 Review words response:', reviewWords);
          
          if (reviewWords.length === 0) {
            throw new Error(t('practice.errors.noWordsAvailable'));
          }
          
          // Create scenario questions for review words
          const questions: ScenarioQuestion[] = reviewWords
            .slice(0, wordCount)
            .map(wordData => {
              // Данные от /due-for-review имеют структуру: { kazakh_word: { translations: [...] } }
              const kazakhWord = (wordData as any).kazakh_word;
              
              if (!kazakhWord) {
                console.log('⚠️ No kazakh_word data found');
                return null;
              }
              
              // Ищем перевод на нужном языке
              let translation = '';
              if (kazakhWord.translations && Array.isArray(kazakhWord.translations)) {
                // Ищем перевод на языке пользователя (ru)
                const userLangTranslation = kazakhWord.translations.find(
                  (t: any) => t.language_code === userLanguage
                );
                
                if (userLangTranslation) {
                  translation = userLangTranslation.translation;
                } else {
                  // Fallback: ищем английский перевод
                  const enTranslation = kazakhWord.translations.find(
                    (t: any) => t.language_code === 'en'
                  );
                  if (enTranslation) {
                    translation = enTranslation.translation;
                  } else if (kazakhWord.translations.length > 0) {
                    // Последний fallback: используем первый доступный перевод
                    translation = kazakhWord.translations[0].translation;
                  }
                }
              }

              const word = {
                id: kazakhWord.id,
                kazakh_word: kazakhWord.kazakh_word,
                kazakh_cyrillic: kazakhWord.kazakh_cyrillic,
                translation: translation
              };

              console.log('🔍 Processing review word:', word.kazakh_word, '→', word.translation, `(${userLanguage})`);

              if (!word.translation || !word.kazakh_word || word.translation === 'No translation') {
                console.log('⚠️ Skipping word - no valid translation');
                return null;
              }

              const method = practiceMethod;
              
              if (method === 'kaz_to_translation') {
                return {
                  word,
                  question: t('practice.questions.whatMeans', { word: word.kazakh_word }),
                  correctAnswer: word.translation,
                  method: 'kaz_to_translation'
                };
              } else {
                return {
                  word,
                  question: t('practice.questions.howToSay', { translation: word.translation }),
                  correctAnswer: word.kazakh_word,
                  method: 'translation_to_kaz'
                };
              }
            })
            .filter(q => q !== null) as ScenarioQuestion[];

          if (questions.length === 0) {
            throw new Error('No words with valid translations found for review');
          }

          console.log('✅ Review session ready with', questions.length, 'questions');
          
          // Create practice session
          const sessionData = await learningAPI.startPracticeSession({
            session_type: 'review',
            word_count: wordCount,
            category_id: categoryId,
            language_code: userLanguage
          });

          setSessionId(sessionData.session_id);
          setScenarioQuestions(questions);
          setQuestionStartTime(Date.now());

          return { session: sessionData, questions };
        }

        // ДЛЯ ОБЫЧНОЙ ПРАКТИКИ - ТОЧНО ОРИГИНАЛЬНАЯ ЛОГИКА
        console.log('📚 Fetching learned words...');
        
        const learnedWordsResponse = await learningAPI.getLearnedWords({
          category_id: categoryId,
          limit: 100, // Get all learned words
          include_mastered: false,
          language_code: userLanguage
        });
        
        // console.log('📊 Learned words response:', learnedWordsResponse);
        console.log(`📈 Total learned words found: ${learnedWordsResponse.length}`);
        
        if (learnedWordsResponse.length === 0) {
          throw new Error(t('practice.errors.noWordsAvailable'));
        }

        // Shuffle for variety and limit to requested word count
        const shuffledWords = [...learnedWordsResponse].sort(() => Math.random() - 0.5);
        
        console.log(`🎲 Shuffled ${shuffledWords.length} words`);
        
        // Take up to wordCount words
        const selectedWords = shuffledWords.slice(0, Math.min(wordCount, shuffledWords.length));
        console.log(`✂️ Selected ${selectedWords.length} words for practice`);

        // Create scenario questions from words
        const questions: ScenarioQuestion[] = selectedWords
          .map(wordData => {
            // ИСПРАВЛЕНИЕ: правильная обработка структуры данных из getLearnedWords
            const word = {
              id: (wordData as any).id,
              kazakh_word: (wordData as any).kazakh_word,
              kazakh_cyrillic: (wordData as any).kazakh_cyrillic,
              translation: (wordData as any).translation
            };

            // Skip words without valid translation or kazakh word
            if (!word.translation || !word.kazakh_word || word.translation === 'No translation') {
              console.log(`⚠️ Skipping word ${word.id}: invalid translation or kazakh word`);
              return null;
            }

            const method = practiceMethod;
            
            if (method === 'kaz_to_translation') {
              return {
                word,
                question: t('practice.questions.whatMeans', { word: word.kazakh_word }),
                correctAnswer: word.translation,
                method: 'kaz_to_translation'
              };
            } else {
              return {
                word,
                question: t('practice.questions.howToSay', { translation: word.translation }),
                correctAnswer: word.kazakh_word,
                method: 'translation_to_kaz'
              };
            }
          })
          .filter(q => q !== null) as ScenarioQuestion[];

        // console.log('✨ Generated scenario questions:', questions);
        console.log('📊 Valid questions created:', questions.length, 'out of', selectedWords.length, 'words');

        if (questions.length === 0) {
          throw new Error('No valid words with translations found for practice. Please check if learned words have proper translations.');
        }

        // Create practice session
        const sessionData = await learningAPI.startPracticeSession({
          session_type: 'combined_scenarios',
          word_count: wordCount,
          category_id: categoryId,
          language_code: userLanguage
        });

        // console.log('✅ Practice session created:', sessionData);

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
      toast.error(error.message || t('practice.errors.sessionFailed'));
    },
    onSuccess: (data) => {
      // console.log('✅ Session started successfully:', data);
      const message = practiceType === 'review' ? t('practice.messages.reviewStarted') : t('practice.status.starting');
      toast.success(message);
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

  // Initialize hint helper when question changes
  useEffect(() => {
    if (currentQuestion && !showAnswer && currentQuestion.correctAnswer) {
      const helper = new LetterHintHelper(currentQuestion.correctAnswer);
      setHintHelper(helper);
      setHintState(helper.getState());
      setIsHintMode(false);
    }
  }, [currentQuestion, showAnswer]);

  // Update hint state when user types
  useEffect(() => {
    if (hintHelper && isHintMode) {
      const newState = hintHelper.updateUserInput(userAnswer);
      setHintState(newState);
    }
  }, [userAnswer, hintHelper, isHintMode]);

  // Get hint function
  const handleGetHint = () => {
    if (!hintHelper) return;

    setIsHintMode(true);
    const newState = hintHelper.getNextHint(userAnswer);
    setHintState(newState);
    setUserAnswer(newState.hintedPart);

    setTimeout(() => {
      const input = document.querySelector('input[type="text"]') as HTMLInputElement | null;
      if (input) {
        const len = newState.hintedPart.length;
        input.focus();
        input.setSelectionRange(len, len);
      }
    }, 0);
  };

  // Render hint display
  const renderHintDisplay = () => {
    if (!isHintMode || !hintState) return null;

    return (
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-2 mb-2">
          <LightBulbIcon className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-700">{t('practice.session.hint')}</span>
        </div>
        <div className="font-mono text-lg tracking-wider">
          {hintState.hintedPart.split('').map((char: string, index: number) => (
            <span
              key={index}
              className="inline-block w-6 text-center text-blue-600 font-bold"
            >
              {char}
            </span>
          ))}
          {hintState.remainingPart.split('').map((char: string, index: number) => (
            <span
              key={hintState.hintedPart.length + index}
              className="inline-block w-6 text-center border-b-2 border-gray-400"
            >
            </span>
          ))}
        </div>
        <div className="text-xs text-blue-600 mt-1">
          {t('practice.hints.lettersRevealed', {
            revealed: hintState.hintedPart.length,
            total: hintState.target.length
          })}
        </div>
      </div>
    );
  };

  const handleSubmitAnswer = () => {
    const currentQuestion = scenarioQuestions[currentQuestionIndex];
    if (!currentQuestion || !sessionId) return;

    const finalAnswer = userAnswer.trim();
    
    // Improved answer checking logic
    let isCorrect = false;
    
    if (currentQuestion.method === 'kaz_to_translation') {
      // For translation from Kazakh - more flexible checking
      const userLower = finalAnswer.toLowerCase();
      const correctLower = currentQuestion.correctAnswer.toLowerCase();
      
      // Exact match or contains key words
      isCorrect = userLower === correctLower || 
                  correctLower.includes(userLower) || 
                  userLower.includes(correctLower);
    } else {
      // For Kazakh input - normalize and compare
      const normalizeKazakh = (text: string) => {
        return text.toLowerCase()
          .trim()
          .replace(/\s+/g, ' '); // normalize whitespace
      };
      
      const userNormalized = normalizeKazakh(finalAnswer);
      const correctNormalized = normalizeKazakh(currentQuestion.correctAnswer);
      
      console.log('🔍 Comparing answers:', {
        user: userNormalized,
        correct: correctNormalized,
        match: userNormalized === correctNormalized
      });
      
      isCorrect = userNormalized === correctNormalized;
    }

    const responseTime = Date.now() - questionStartTime;

    console.log('✅ Answer check result:', {
      isCorrect,
      userAnswer: finalAnswer,
      correctAnswer: currentQuestion.correctAnswer,
      method: currentQuestion.method
    });

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
      // Reset hint state
      setIsHintMode(false);
      setHintState(null);
    }
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Игнорируем если пользователь печатает в input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        
        if (showAnswer) {
          // Если показан ответ, активируем кнопку "Next Question"
          handleNextQuestion();
        } else if (userAnswer.trim()) {
          // Если ответ не показан, но есть введенный текст, проверяем ответ
          handleSubmitAnswer();
        }
      }
      
      // Дополнительно: Escape для пропуска вопроса
      if (e.key === 'Escape' && !showAnswer) {
        e.preventDefault();
        handleSkip();
      }
    };

    // Добавляем обработчик события
    window.addEventListener('keydown', handleKeyDown);

    // Очищаем обработчик при размонтировании компонента
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAnswer, userAnswer, handleNextQuestion, handleSubmitAnswer, handleSkip]);

  // Get current question and progress
  const isLastQuestion = currentQuestionIndex === scenarioQuestions.length - 1;
  const progress = scenarioQuestions.length > 0 ? ((currentQuestionIndex + 1) / scenarioQuestions.length) * 100 : 0;

  // Loading state
  if (startSessionMutation.isPending || stats === undefined || userPreferences === undefined) {
    return <LoadingSpinner fullScreen text={t('practice.status.loading')} />;
  }

  // Error state - specifically for no learned words
  if (startSessionMutation.error || !currentQuestion) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📚</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t('practice.status.noWords')}
        </h2>
        <p className="text-gray-600 mb-6">
          {t('practice.errors.noWordsAvailable')}
        </p>
        <button
          onClick={() => navigate('/app/learning')}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {t('practice.navigation.goToLearning')}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpenIcon className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">{t('practice.title')}</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            {t('practice.session.question', { 
              current: currentQuestionIndex + 1, 
              total: scenarioQuestions.length 
            })}
          </div>
          {sessionResults.length > 0 && (
            <div className="text-sm text-gray-600">
              {t('practice.session.score')}: {Math.round((sessionResults.filter(r => r.correct).length / sessionResults.length) * 100)}%
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 mb-6">
        <div className="text-center mb-6">
          <h2 className="text-lg font-medium text-gray-600 mb-2">
            {practiceMethod === 'kaz_to_translation' 
              ? t('practice.session.translateToEnglish', 'Translate to English:')
              : t('practice.session.translateToKazakh', 'Translate to Kazakh:')
            }
          </h2>
          <div className="text-3xl font-bold text-gray-900 mb-4">
            {currentQuestion.question}
          </div>
          
          {/* Hint display */}
          {renderHintDisplay()}
        </div>

        {!showAnswer ? (
          <div className="space-y-4">
            <div>
              <input
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && userAnswer.trim()) {
                    handleSubmitAnswer();
                  }
                }}
                placeholder={t('practice.session.type')}
                className="w-full p-4 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
                style={{
                  backgroundColor: isHintMode ? '#fefce8' : 'white',
                  borderColor: isHintMode ? '#facc15' : undefined,
                }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSubmitAnswer}
                disabled={!userAnswer.trim()}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2 group"
                title="Press Enter to check answer"
              >
                <span>{t('practice.session.checkAnswer')}</span>
                {userAnswer.trim() && (
                  <span className="text-xs bg-blue-500 px-2 py-1 rounded border border-blue-400 opacity-75 group-hover:opacity-100 transition-opacity">
                    {t('practice.hints.enterKey')}
                  </span>
                )}
              </button>
              
              {/* Hint button */}
              {hintHelper && !hintState?.isCompleted && (
                <button
                  onClick={handleGetHint}
                  className="bg-yellow-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-yellow-600 transition-colors"
                  title={t('practice.session.showHint')}
                >
                  <LightBulbIcon className="w-5 h-5" />
                </button>
              )}
              
              <button
                onClick={handleSkip}
                className="bg-gray-500 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-600 transition-colors"
              >
                {t('practice.session.skip')}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-6">
            {/* Answer Result */}
            <div className={`text-3xl font-bold ${
              sessionResults[currentQuestionIndex]?.correct ? 'text-green-600' : 'text-red-600'
            }`}>
              {sessionResults[currentQuestionIndex]?.correct 
                ? `✅ ${t('practice.status.correct')}`
                : `❌ ${t('practice.status.incorrect')}`
              }
            </div>

            {/* Correct Answer Display */}
            <div className="bg-gray-50 rounded-lg p-6">
              <p className="text-lg mb-2">
                <strong>"{currentQuestion.word.kazakh_word}"</strong> {t('practice.session.means', 'means')}{' '}
                <strong className="text-blue-600">"{currentQuestion.correctAnswer}"</strong>
              </p>
              {!sessionResults[currentQuestionIndex]?.correct && (
                <p className="text-gray-600">
                  {t('practice.session.yourAnswer')}: <span className="font-medium">"{userAnswer}"</span>
                </p>
              )}
            </div>

            {/* Next Button */}
            <button
              onClick={handleNextQuestion}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 mx-auto group"
              title="Press Enter to continue"
            >
              <span>
                {isLastQuestion 
                  ? t('practice.results.completed')
                  : t('practice.session.nextQuestion')
                }
              </span>
              <span className="text-xs bg-blue-500 px-2 py-1 rounded border border-blue-400 opacity-75 group-hover:opacity-100 transition-opacity">
                {t('practice.hints.enterKey')}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Session Stats */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('practice.session.progress')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {sessionResults.filter(r => r.correct).length}
            </div>
            <div className="text-sm text-gray-600">{t('practice.stats.correct', 'Correct')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {sessionResults.filter(r => !r.correct).length}
            </div>
            <div className="text-sm text-gray-600">{t('practice.stats.incorrect', 'Incorrect')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {sessionResults.length > 0 
                ? Math.round((sessionResults.filter(r => r.correct).length / sessionResults.length) * 100)
                : 0
              }%
            </div>
            <div className="text-sm text-gray-600">{t('practice.stats.accuracy', 'Accuracy')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {scenarioQuestions.length}
            </div>
            <div className="text-sm text-gray-600">{t('practice.stats.totalQuestions', 'Total Questions')}</div>
          </div>
        </div>

        {/* Practice Method Info */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700">{t('practice.session.practiceMode', 'Practice Mode:')}</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                practiceMethod === 'kaz_to_translation' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-purple-100 text-purple-800'
              }`}>
                {practiceMethod === 'kaz_to_translation' 
                  ? t('practice.methods.recognition')
                  : t('practice.methods.production')
                }
              </span>
            </div>
            <button
              onClick={() => navigate('/app/settings')}
              className="text-xs text-blue-500 hover:text-blue-600 underline"
            >
              {t('practice.navigation.changeMethod')}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {practiceMethod === 'kaz_to_translation' 
              ? t('practice.methods.recognitionDescription')
              : t('practice.methods.productionDescription')
            }
          </p>

          {/* Hint system info */}
          <div className="mt-3 p-2 bg-yellow-50 rounded border-l-2 border-yellow-300">
            <div className="flex items-center space-x-1 text-xs">
              <LightBulbIcon className="w-3 h-3 text-yellow-600" />
              <span className="text-yellow-800 font-medium">{t('practice.hints.title')}</span>
              <span className="text-yellow-700">{t('practice.hints.description')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticePage;