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

import { learningAPI } from '../../services/learningAPI';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
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

  console.log('🎯 Practice method from settings:', practiceMethod);

  // Start session mutation - using getLearnedWords
  const startSessionMutation = useMutation({
    mutationFn: async () => {
      console.log('🔍 Starting practice with LEARNED words only...');
      console.log('Practice type from URL:', practiceType);
      console.log('Category filter:', categoryId);
      console.log('Word count from settings:', wordCount);
      
      try {
        // Get learned words using learningAPI.getLearnedWords method
        console.log('📚 Fetching learned words...');
        
        const userLanguage = user?.main_language?.language_code || 'en';
        const learnedWordsResponse = await learningAPI.getLearnedWords({
          category_id: categoryId,
          limit: 100, // Get all learned words
          include_mastered: false,
          language_code: userLanguage
        });
        
        console.log('📊 Learned words response:', learnedWordsResponse);
        console.log(`📈 Total learned words found: ${learnedWordsResponse.length}`);
        
        if (learnedWordsResponse.length === 0) {
          throw new Error('No learned words available for practice. Please complete some learning modules first to unlock practice mode.');
        }

        // Shuffle and select words for practice
        const shuffledWords = [...learnedWordsResponse].sort(() => Math.random() - 0.5);
        const practiceWords = shuffledWords.slice(0, Math.min(wordCount, shuffledWords.length));

        // Create scenario questions using the actual API response structure
        const questions: ScenarioQuestion[] = practiceWords
          .map((wordData: any) => {
            console.log('🔍 Processing word for practice:', {
              wordData: wordData,
              structure: Object.keys(wordData)
            });

            // Handle both possible response structures
            let word: PracticeWord;
            
            // Check if it's the flattened structure (actual API response)
            if (wordData.translation && wordData.kazakh_word && typeof wordData.kazakh_word === 'string') {
              word = {
                id: wordData.id,
                kazakh_word: wordData.kazakh_word,
                kazakh_cyrillic: wordData.kazakh_cyrillic,
                translation: wordData.translation,
              };
            }
            // Handle nested structure (TypeScript type)
            else if (wordData.kazakh_word && typeof wordData.kazakh_word === 'object') {
              // Get translation in user's language
              let translation = 'No translation';
              const userLanguage = user?.main_language?.language_code || 'en';
              
              if (wordData.kazakh_word.translations) {
                const userLangTranslation = wordData.kazakh_word.translations.find(
                  (t: any) => t.language_code === userLanguage
                );
                
                if (userLangTranslation) {
                  translation = userLangTranslation.translation;
                } else if (wordData.kazakh_word.translations.length > 0) {
                  translation = wordData.kazakh_word.translations[0].translation;
                }
              }

              word = {
                id: wordData.kazakh_word.id,
                kazakh_word: wordData.kazakh_word.kazakh_word,
                kazakh_cyrillic: wordData.kazakh_word.kazakh_cyrillic,
                translation: translation,
              };
            }
            else {
              console.warn('Unknown word data structure:', wordData);
              return null;
            }

            // Skip words without valid translation or kazakh word
            if (!word.translation || !word.kazakh_word || word.translation === 'No translation') {
              return null;
            }

            const method = practiceMethod;
            
            if (method === 'kaz_to_translation') {
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
          })
          .filter(q => q !== null) as ScenarioQuestion[];

        console.log('✨ Generated scenario questions:', questions);
        console.log('📊 Valid questions created:', questions.length, 'out of', practiceWords.length, 'words');

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
    },
    onSuccess: (data) => {
      console.log('✅ Session started successfully:', data);
      toast.success('Practice session started!');
    },
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
          <span className="text-sm font-medium text-blue-700">Hint</span>
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
          {hintState.hintedPart.length} of {hintState.target.length} letters revealed
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

  // Get current question and progress
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
        <button
          onClick={() => navigate('/app/learning')}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Learning Modules
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
          <h1 className="text-2xl font-bold text-gray-900">Translation Practice</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            Progress: {currentQuestionIndex + 1} / {scenarioQuestions.length}
          </div>
          {sessionResults.length > 0 && (
            <div className="text-sm text-gray-600">
              Accuracy: {Math.round((sessionResults.filter(r => r.correct).length / sessionResults.length) * 100)}%
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
            {practiceMethod === 'kaz_to_translation' ? 'Translate to English:' : 'Translate to Kazakh:'}
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
                placeholder="Type your answer..."
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
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Check Answer
              </button>
              
              {/* Hint button */}
              {hintHelper && !hintState?.isCompleted && (
                <button
                  onClick={handleGetHint}
                  className="bg-yellow-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-yellow-600 transition-colors"
                  title="Get a hint"
                >
                  <LightBulbIcon className="w-5 h-5" />
                </button>
              )}
              
              <button
                onClick={handleSkip}
                className="bg-gray-500 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-600 transition-colors"
              >
                Skip
              </button>
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

          {/* Hint system info */}
          <div className="mt-3 p-2 bg-yellow-50 rounded border-l-2 border-yellow-300">
            <div className="flex items-center space-x-1 text-xs">
              <LightBulbIcon className="w-3 h-3 text-yellow-600" />
              <span className="text-yellow-800 font-medium">Letter Hints:</span>
              <span className="text-yellow-700">Click the hint button to reveal letters one by one.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticePage;