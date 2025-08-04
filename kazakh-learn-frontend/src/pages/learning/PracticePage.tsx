// src/pages/learning/PracticePage.tsx - Modified for learned words only
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
  BookOpenIcon
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';

import { learningAPI } from '../../services/learningAPI';
import { wordsAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface PracticeWord {
  id: number;
  kazakh_word: string;
  kazakh_cyrillic?: string;
  translation: string;
  pronunciation?: string;
  image_url?: string;
  difficulty_level: number;
}

const PracticePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation('practice');
  const [searchParams] = useSearchParams();
  
  // Session state
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [sessionWords, setSessionWords] = useState<PracticeWord[]>([]);
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
  const practiceType = searchParams.get('type') || 'practice';
  const categoryId = searchParams.get('category') ? parseInt(searchParams.get('category')!) : undefined;
  const wordCount = parseInt(searchParams.get('count') || '10');

  // Get learning stats
  const { data: stats } = useQuery({
    queryKey: ['learning-stats'],
    queryFn: learningAPI.getStats,
  });

  // 🎯 MODIFIED: Only get learned words for practice
  const startSessionMutation = useMutation({
    mutationFn: async () => {
      console.log('🔍 Starting practice session with LEARNED words only...');
      console.log('Practice type from URL:', practiceType);
      console.log('Category filter:', categoryId);
      console.log('Word count from URL:', wordCount);
      
      try {
        // Get learned words directly using the learning API
        console.log('📚 Fetching learned words directly...');
        
        const learnedWordsResponse = await learningAPI.getProgress({
          status: 'learned', // Just use string, no type assertion needed
          category_id: categoryId,
          limit: 100, // Get all learned words, ignore the URL count parameter
          offset: 0
        });
        
        console.log('📊 Learned words response:', learnedWordsResponse);
        console.log(`📈 Total learned words found: ${learnedWordsResponse.length}`);
        
        if (learnedWordsResponse.length === 0) {
          throw new Error('No learned words available for practice. Please complete some learning modules first to unlock practice mode.');
        }
        
        // Convert to practice word format
        const practiceWords: PracticeWord[] = learnedWordsResponse.map(progress => {
          const word = progress.kazakh_word;
          
          // Get translation in user's preferred language
          const userLanguageCode = user?.main_language?.language_code || 'en';
          let translation = 'No translation';
          
          if (word.translations && word.translations.length > 0) {
            const userLangTranslation = word.translations.find((t: any) => 
              t.language_code === userLanguageCode
            );
            translation = userLangTranslation?.translation || word.translations[0].translation;
          }
          
          return {
            id: word.id,
            kazakh_word: word.kazakh_word,
            kazakh_cyrillic: word.kazakh_cyrillic,
            translation: translation,
            pronunciation: undefined,
            image_url: undefined,
            difficulty_level: word.difficulty_level || 1,
          };
        });
        
        console.log(`✅ Successfully converted ${practiceWords.length} learned words for practice`);
        
        // Shuffle for variety but keep all words
        const shuffledWords = [...practiceWords];
        for (let i = shuffledWords.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledWords[i], shuffledWords[j]] = [shuffledWords[j], shuffledWords[i]];
        }
        
        // If user specified a count in URL, limit to that number, otherwise use all
        const finalWords = wordCount && wordCount < shuffledWords.length 
          ? shuffledWords.slice(0, wordCount)
          : shuffledWords;
        
        console.log(`🎯 Final practice session: ${finalWords.length} words (requested: ${wordCount || 'all'})`);
        
        return {
          session_id: Math.floor(Math.random() * 10000), // Generate local session ID
          words: finalWords,
          session_type: 'learned_practice',
          total_words: finalWords.length
        };
  
      } catch (error) {
        console.error('❌ Failed to get learned words:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('🎯 Practice session started successfully:', data);
      setSessionId(data.session_id);
      setSessionWords(data.words);
      setStartTime(Date.now());
      setQuestionStartTime(Date.now());
      
      toast.success(`Practice session started with ${data.words.length} learned words!`);
    },
    onError: (error) => {
      console.error('❌ Session start error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start practice session';
      toast.error(errorMessage);
    },
  });

  // Submit answer
  const submitAnswerMutation = useMutation({
    mutationFn: async (data: {
      sessionId: number;
      wordId: number;
      wasCorrect: boolean;
      userAnswer: string;
      correctAnswer: string;
      responseTime: number;
    }) => {
      console.log('📝 Submitting answer:', data);
      
      try {
        return await learningAPI.submitPracticeAnswer2(
          data.sessionId,
          data.wordId,
          data.wasCorrect,
          data.userAnswer,
          data.correctAnswer,
          data.responseTime
        );
      } catch (error) {
        console.log('⚠️ Backend submission failed, logging locally:', error);
        // Don't throw error, just log locally
        return { success: true, message: 'Logged locally' };
      }
    },
    onSuccess: () => {
      console.log('✅ Answer submitted successfully');
    },
    onError: (error) => {
      console.log('⚠️ Submit answer error (non-critical):', error);
      // Don't show error toast for practice sessions
    },
  });

  // Finish session
  const finishSessionMutation = useMutation({
    mutationFn: async (data: { sessionId: number; duration: number }) => {
      console.log('🏁 Finishing practice session:', data);
      
      try {
        return await learningAPI.finishPracticeSession(data.sessionId, data.duration);
      } catch (error) {
        console.log('⚠️ Backend session finish failed, continuing locally:', error);
        return { success: true, message: 'Session completed locally' };
      }
    },
    onSuccess: () => {
      console.log('🎉 Practice session finished successfully');
    },
  });

  // Initialize session when component mounts
  useEffect(() => {
    if (!sessionId && stats !== undefined) {
      console.log('🚀 Auto-starting practice session...');
      startSessionMutation.mutate();
    }
  }, [stats, sessionId]);

  // Event handlers
  const handleSubmitAnswer = () => {
    if (!currentWord || !sessionId) return;

    const isCorrect = userAnswer.toLowerCase().trim() === currentWord.translation.toLowerCase().trim();
    const responseTime = Date.now() - questionStartTime;

    // Submit to backend
    submitAnswerMutation.mutate({
      sessionId,
      wordId: currentWord.id,
      wasCorrect: isCorrect,
      userAnswer: userAnswer.trim(),
      correctAnswer: currentWord.translation,
      responseTime,
    });

    // Store result locally
    setSessionResults(prev => [...prev, {
      word_id: currentWord.id,
      correct: isCorrect,
      user_answer: userAnswer.trim(),
      response_time: responseTime,
    }]);

    setShowAnswer(true);
  };

  const handleNextWord = () => {
    if (isLastWord) {
      handleFinishSession();
    } else {
      setCurrentWordIndex(prev => prev + 1);
      setUserAnswer('');
      setShowAnswer(false);
      setQuestionStartTime(Date.now());
    }
  };

  const handleFinishSession = () => {
    if (!sessionId) return;

    const duration = Math.floor((Date.now() - startTime) / 1000);
    
    finishSessionMutation.mutate({
      sessionId,
      duration,
    });

    // Navigate to progress page with results
    const correct = sessionResults.filter(r => r.correct).length;
    const total = sessionResults.length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    navigate('/app/progress', {
      state: {
        sessionCompleted: true,
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

  const handlePlayAudio = () => {
    if (currentWord?.pronunciation) {
      toast.info(t('messages.audioComingSoon'));
    }
  };

  const handleSkip = () => {
    if (currentWord && sessionId) {
      submitAnswerMutation.mutate({
        sessionId,
        wordId: currentWord.id,
        wasCorrect: false,
        userAnswer: 'skipped',
        correctAnswer: currentWord.translation,
        responseTime: Date.now() - questionStartTime,
      });

      setSessionResults(prev => [...prev, {
        word_id: currentWord.id,
        correct: false,
        user_answer: 'skipped',
        response_time: Date.now() - questionStartTime,
      }]);
    }

    handleNextWord();
  };

  // Get current word and progress
  const currentWord = sessionWords[currentWordIndex];
  const isLastWord = currentWordIndex === sessionWords.length - 1;
  const progress = sessionWords.length > 0 ? ((currentWordIndex + 1) / sessionWords.length) * 100 : 0;

  // Loading state
  if (startSessionMutation.isPending || stats === undefined) {
    return <LoadingSpinner fullScreen text={t('loading.startingSession')} />;
  }

  // Error state - specifically for no learned words
  if (startSessionMutation.error || !currentWord) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📚</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          No Learned Words Available
        </h2>
        <p className="text-gray-600 mb-6">
          Practice mode is only available for words you have already learned. 
          Complete some learning modules first to unlock practice sessions!
        </p>
        <div className="space-y-3">
          <button
            onClick={() => navigate('/app/learning-module')}
            className="btn-primary flex items-center justify-center space-x-2 mx-auto"
          >
            <BookOpenIcon className="h-5 w-5" />
            <span>Start Learning Module</span>
          </button>
          <button
            onClick={() => navigate('/app/learning')}
            className="btn-secondary mx-auto block"
          >
            Back to Learning
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Session Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              🏆 Learned Words Practice
            </h1>
            <p className="text-gray-600">
              Question {currentWordIndex + 1} of {sessionWords.length}
            </p>
            <p className="text-sm text-blue-600 mt-1">
              📚 Practicing your learned vocabulary
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              Correct: {sessionResults.filter(r => r.correct).length} / {sessionResults.length}
            </div>
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="p-2 text-gray-400 hover:text-gray-600"
              title={isPaused ? 'Resume session' : 'Pause session'}
            >
              {isPaused ? <PlayIcon className="h-5 w-5" /> : <PauseIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-green-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Main Practice Area */}
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        {!showAnswer ? (
          /* Question Mode */
          <div className="text-center space-y-6">
            {/* Word Display */}
            <div className="space-y-4">
              <div className="text-4xl font-bold text-gray-900">
                {currentWord.kazakh_word}
              </div>
              {currentWord.kazakh_cyrillic && (
                <div className="text-2xl text-gray-600">
                  {currentWord.kazakh_cyrillic}
                </div>
              )}
              <div className="text-sm text-gray-500">
                Level {currentWord.difficulty_level}
              </div>
            </div>

            {/* Audio Button */}
            {currentWord.pronunciation && (
              <button
                onClick={handlePlayAudio}
                className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700"
              >
                <SpeakerWaveIcon className="h-5 w-5" />
                <span>Play Audio</span>
              </button>
            )}

            {/* Question */}
            <div className="space-y-4">
              <p className="text-lg text-gray-700">
                What does this word mean in English?
              </p>
              
              <input
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && userAnswer.trim() && handleSubmitAnswer()}
                placeholder="Type your answer..."
                className="w-full max-w-md mx-auto px-4 py-3 border border-gray-300 rounded-lg text-center text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isPaused}
                autoFocus
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={handleSkip}
                className="px-6 py-2 text-gray-600 hover:text-gray-800"
                disabled={isPaused}
              >
                Skip
              </button>
              <button
                onClick={handleSubmitAnswer}
                disabled={!userAnswer.trim() || isPaused}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit Answer
              </button>
            </div>
          </div>
        ) : (
          /* Answer Mode */
          <div className="text-center space-y-6">
            {/* Result Display */}
            <div className="space-y-4">
              {sessionResults[sessionResults.length - 1]?.correct ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center space-x-2 text-green-600">
                    <CheckCircleIcon className="h-8 w-8" />
                    <span className="text-2xl font-bold">Correct! 🎉</span>
                  </div>
                  <p className="text-lg text-gray-700">
                    <strong>{currentWord.kazakh_word}</strong> means <strong>{currentWord.translation}</strong>
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-center space-x-2 text-red-600">
                    <XCircleIcon className="h-8 w-8" />
                    <span className="text-2xl font-bold">Not quite right</span>
                  </div>
                  <div className="text-lg text-gray-700">
                    <p>Your answer: <span className="text-red-600">{userAnswer}</span></p>
                    <p>Correct answer: <span className="text-green-600 font-semibold">{currentWord.translation}</span></p>
                  </div>
                </div>
              )}
            </div>

            {/* Next Button */}
            <div className="text-center">
              <button
                onClick={handleNextWord}
                className="btn-primary flex items-center space-x-2 mx-auto"
              >
                {isLastWord ? (
                  <>
                    <TrophyIcon className="h-5 w-5" />
                    <span>Finish Practice</span>
                  </>
                ) : (
                  <>
                    <span>Next Word</span>
                    <ArrowRightIcon className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Session Stats */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Progress</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{currentWordIndex + 1}</div>
            <div className="text-sm text-gray-600">Current</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {sessionResults.filter(r => r.correct).length}
            </div>
            <div className="text-sm text-gray-600">Correct</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">
              {sessionResults.filter(r => !r.correct).length}
            </div>
            <div className="text-sm text-gray-600">Incorrect</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticePage;