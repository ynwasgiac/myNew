// Updated QuizPage.tsx with 3-level smart word selection logic
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircleIcon, XCircleIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';

import { quizAPI, wordsAPI } from '../../services/api';
import { learningAPI } from '../../services/learningAPI';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

// Import the correct QuizQuestion type from your API types
import type { QuizQuestion } from '../../types/api';

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

const QuizPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation('quiz');
  const [searchParams] = useSearchParams();

  // URL parameters
  const categoryId = searchParams.get('category') ? parseInt(searchParams.get('category')!) : undefined;
  const difficultyLevelId = searchParams.get('difficulty') ? parseInt(searchParams.get('difficulty')!) : undefined;
  const questionCount = parseInt(searchParams.get('count') || '5');

  // State - using LocalQuizQuestion for internal state
  const [questions, setQuestions] = useState<LocalQuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [isQuizComplete, setIsQuizComplete] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [sessionId, setSessionId] = useState<number | undefined>(undefined);
  const [wordSource, setWordSource] = useState<'review' | 'learning' | 'mixed' | 'random'>('review');

  // Get user's preferred language
  const getUserLanguage = () => {
    return user?.main_language?.language_code || 'en';
  };

  // Get learning stats
  const { data: stats } = useQuery({
    queryKey: ['learning-stats'],
    queryFn: learningAPI.getStats,
  });

  // Smart quiz generation with 3-level logic
  const generateQuizMutation = useMutation({
    mutationFn: async () => {
      console.log('🔍 Starting smart quiz generation...');
      console.log('Stats:', stats);
      
      const wordsNeedReview = stats?.words_due_review || 0;
      const userWordLimit = Math.max(wordsNeedReview, 10);
      const requiredWords = Math.max(questionCount, 15); // Need more words for wrong options

      // Helper function to safely convert word data
      const convertToValidQuizWord = (item: any): QuizWord | null => {
        try {
          // Handle review/learning word format (UserWordProgressWithWord)
          if (item.kazakh_word && typeof item.kazakh_word === 'object') {
            const word = item.kazakh_word;
            // Find translation in user's language, fallback to first available
            let translation = 'No translation';
            if (word.translations && word.translations.length > 0) {
              const userLangTranslation = word.translations.find((t: any) => 
                t.language_code === (user?.main_language?.language_code || 'en')
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
          }
          // Handle random word format
          else if (item.kazakh_word || item.id) {
            return {
              id: item.id,
              kazakh_word: item.kazakh_word,
              kazakh_cyrillic: item.kazakh_cyrillic,
              translation: item.translation,
              pronunciation: item.pronunciation,
              image_url: item.image_url,
              difficulty_level: item.difficulty_level || 1,
            };
          }
          return null;
        } catch (error) {
          console.error('Error converting word:', error, item);
          return null;
        }
      };

      let quizWords: QuizWord[] = [];

      // Level 1: Try review words first
      if (wordsNeedReview > 0) {
        console.log('✅ Level 1: Trying review words');
        setWordSource('review');
        try {
          const reviewWords = await learningAPI.getWordsForReview(Math.min(userWordLimit, wordsNeedReview));
          console.log('Review words response:', reviewWords);
          
          if (reviewWords && reviewWords.length > 0) {
            quizWords = reviewWords
              .map(convertToValidQuizWord)
              .filter((word): word is QuizWord => word !== null);
            
            if (quizWords.length >= questionCount) {
              console.log('✅ Using review words:', quizWords.length);
              return await generateQuizFromWords(quizWords.slice(0, questionCount), 'review');
            }
          }
        } catch (error) {
          console.log('⚠️ Review words failed:', error);
        }
      }

      // Level 2: Try learning status words
      console.log('📚 Level 2: Trying learning status words');
      setWordSource('learning');
      try {
        const learningWords = await learningAPI.getProgress({
          status: 'learning',
          limit: 50,
          offset: 0
        });
        console.log('Learning words response:', learningWords);
        
        if (learningWords && learningWords.length >= questionCount) {
          quizWords = learningWords
            .slice(0, userWordLimit)
            .map(convertToValidQuizWord)
            .filter((word): word is QuizWord => word !== null);
          
          if (quizWords.length >= questionCount) {
            console.log('✅ Using learning words:', quizWords.length);
            return await generateQuizFromWords(quizWords.slice(0, questionCount), 'learning');
          }
        }

        // Level 3: Try mixed learning words
        console.log('🔄 Level 3: Trying mixed learning words');
        setWordSource('mixed');
        const allLearningWords = await learningAPI.getProgress({
          limit: 50,
          offset: 0
        });
        console.log('All learning words response:', allLearningWords);
        
        if (allLearningWords && allLearningWords.length > 0) {
          // Combine and deduplicate
          const combinedWords = [...(learningWords || []), ...allLearningWords];
          const seenIds = new Set<number>();
          const uniqueWords = combinedWords.filter(word => {
            const converted = convertToValidQuizWord(word);
            if (converted && !seenIds.has(converted.id)) {
              seenIds.add(converted.id);
              return true;
            }
            return false;
          });
          
          quizWords = uniqueWords
            .slice(0, userWordLimit)
            .map(convertToValidQuizWord)
            .filter((word): word is QuizWord => word !== null);
          
          if (quizWords.length >= questionCount) {
            console.log('✅ Using mixed learning words:', quizWords.length);
            return await generateQuizFromWords(quizWords.slice(0, questionCount), 'mixed');
          }
        }
      } catch (error) {
        console.log('⚠️ Learning words failed:', error);
      }

      // Fallback: Use random words
      console.log('🎲 Fallback: Using random words');
      setWordSource('random');
      try {
        // Use user's language code from their settings
        const userLanguageCode = user?.main_language?.language_code || 'en';
        console.log('Using user language code:', userLanguageCode);
        
        const randomWords = await wordsAPI.getRandomWords(
          requiredWords, // Get more words for generating wrong options
          undefined, // difficulty
          categoryId,
          userLanguageCode
        );
        console.log('Random words response:', randomWords);
        
        quizWords = randomWords.map(word => ({
          id: word.id,
          kazakh_word: word.kazakh_word,
          kazakh_cyrillic: word.kazakh_cyrillic,
          translation: word.translation,
          pronunciation: word.pronunciation,
          image_url: word.image_url,
          difficulty_level: word.difficulty_level,
        }));
        
        if (quizWords.length >= questionCount) {
          console.log('✅ Using random words:', quizWords.length);
          return await generateQuizFromWords(quizWords.slice(0, questionCount), 'random');
        }
      } catch (error) {
        console.log('⚠️ Random words failed:', error);
      }

      throw new Error('No words available for quiz');
    },
    onSuccess: (data) => {
      console.log('🎯 Quiz generated successfully:', data);
      setQuestions(data.questions);
      setSessionId(data.session_id);
      setStartTime(Date.now());
      
      const messages = {
        review: t('messages.reviewQuizStarted'),
        learning: t('messages.learningQuizStarted'),
        mixed: t('messages.mixedQuizStarted'),
        random: t('messages.randomQuizStarted')
      };
      toast.success(messages[wordSource] || t('messages.quizStarted'));
    },
    onError: (error) => {
      console.error('❌ Quiz generation error:', error);
      toast.error(t('messages.quizGenerationError'));
    },
  });

  // Generate quiz questions from words
  const generateQuizFromWords = async (words: QuizWord[], sourceType: string) => {
    console.log('🎲 Generating quiz from words:', words.length, 'source:', sourceType);
    
    // Generate additional words for wrong options if needed
    let allWords = [...words];
    if (allWords.length < 15) {
      try {
        const additionalWords = await wordsAPI.getRandomWords(
          15 - allWords.length,
          undefined,
          categoryId,
          getUserLanguage()
        );
        const convertedAdditional = additionalWords.map(word => ({
          id: word.id,
          kazakh_word: word.kazakh_word,
          kazakh_cyrillic: word.kazakh_cyrillic,
          translation: word.translation,
          pronunciation: word.pronunciation,
          image_url: word.image_url,
          difficulty_level: word.difficulty_level,
        }));
        allWords = [...allWords, ...convertedAdditional];
      } catch (error) {
        console.log('Could not fetch additional words for options');
      }
    }

    const questions: LocalQuizQuestion[] = words.map((word, index) => {
      // Get wrong options (excluding the correct answer)
      const wrongOptions = allWords
        .filter(w => w.id !== word.id && w.translation !== word.translation)
        .map(w => w.translation)
        .slice(0, 3);

      // Ensure we have 3 wrong options
      while (wrongOptions.length < 3) {
        wrongOptions.push(`Option ${wrongOptions.length + 1}`);
      }

      // Shuffle options
      const correctAnswer = Math.floor(Math.random() * 4);
      const options = [...wrongOptions];
      options.splice(correctAnswer, 0, word.translation);

      return {
        id: word.id,
        word: word.kazakh_word,
        translation: word.translation,
        options: options,
        correctAnswer: correctAnswer,
        type: 'multiple_choice' as const
      };
    });

    return {
      session_id: Math.floor(Math.random() * 10000),
      questions: questions,
      session_type: sourceType,
      total_questions: questions.length
    };
  };

  // Submit quiz results mutation
  const submitQuizMutation = useMutation({
    mutationFn: (results: QuizResult[]) => {
      // Only try backend submission for review words
      if (wordSource === 'review') {
        try {
          return quizAPI.submitQuizResults(sessionId, results, getUserLanguage());
        } catch (error) {
          console.log('Backend submission failed, logging locally');
          return Promise.resolve({ success: true, message: 'Local completion' });
        }
      } else {
        // For other types, just log locally
        console.log('📝 Local quiz results logged:', results);
        return Promise.resolve({ success: true, message: 'Local completion' });
      }
    },
    onSuccess: (data) => {
      console.log('Quiz results submitted:', data);
      toast.success(t('messages.quizSubmitted'));
    },
    onError: (error) => {
      console.error('Failed to submit quiz:', error);
      // Don't show error toast for non-review sessions
    }
  });

  // Initialize quiz when stats are loaded
  useEffect(() => {
    if (!questions.length && !isQuizComplete && stats !== undefined) {
      generateQuizMutation.mutate();
    }
  }, [stats, questions.length, isQuizComplete]);

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const handleAnswerSelect = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
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
    generateQuizMutation.mutate(); // Generate new quiz
  };

  const handleFinishQuiz = () => {
    navigate('/app/learn');
  };

  const getQuizTypeLabel = () => {
    const labels = {
      review: '📝 ' + t('session.types.review'),
      learning: '📚 ' + t('session.types.learning'), 
      mixed: '🔄 ' + t('session.types.mixed'),
      random: '🎲 ' + t('session.types.random')
    };
    return labels[wordSource] || t('session.types.quiz');
  };

  // Show loading state
  if (generateQuizMutation.isPending || stats === undefined || !questions.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600">{t('loading.preparingQuiz')}</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (generateQuizMutation.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t('errors.loadFailed')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('errors.tryAgain')}
          </p>
          <div className="space-x-4">
            <button
              onClick={() => generateQuizMutation.mutate()}
              className="btn-primary"
            >
              {t('actions.retry')}
            </button>
            <button
              onClick={() => navigate('/app/learn')}
              className="btn-secondary"
            >
              {t('actions.backToLearning')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show quiz completion results
  if (isQuizComplete) {
    const score = calculateScore();
    const correctAnswers = results.filter(r => r.isCorrect).length;

    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mb-6">
              {score >= 70 ? (
                <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
              ) : (
                <XCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
              )}
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {t('results.title')}
              </h1>
              <p className="text-xl text-gray-600">
                {t('results.yourScore', { score })}
              </p>
              {/* Show quiz type */}
              <p className="text-sm text-blue-600 mt-2">
                {getQuizTypeLabel()}
              </p>
              {score >= 70 ? (
                <p className="text-green-600 font-medium mt-2">
                  {t('results.excellent')} 🎉
                </p>
              ) : (
                <p className="text-blue-600 font-medium mt-2">
                  {t('results.keepPracticing')} 💪
                </p>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-600">{correctAnswers}</p>
                  <p className="text-sm text-gray-600">{t('results.correct')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">
                    {results.length - correctAnswers}
                  </p>
                  <p className="text-sm text-gray-600">{t('results.incorrect')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{questions.length}</p>
                  <p className="text-sm text-gray-600">{t('results.total')}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {t('results.reviewTitle')}
              </h3>
              {results.map((result, index) => {
                const question = questions.find(q => q.id === result.questionId);
                if (!question) return null;

                return (
                  <div
                    key={result.questionId}
                    className={`p-4 rounded-lg border-2 ${
                      result.isCorrect
                        ? 'border-green-200 bg-green-50'
                        : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <p className="font-medium text-gray-900 mb-1">
                          <span className="text-lg font-bold kazakh-text">{question.word}</span> → {question.translation}
                        </p>
                        <p className="text-sm text-gray-600">
                          {t('results.yourAnswer')}: 
                          <span className={result.isCorrect ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                            {" " + question.options[result.selectedAnswer]}
                          </span>
                        </p>
                        {!result.isCorrect && (
                          <p className="text-sm text-green-600">
                            {t('results.correctAnswer')}: 
                            <span className="font-medium">
                              {" " + question.options[question.correctAnswer]}
                            </span>
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {t('results.timeSpent', { seconds: Math.round(result.timeSpent / 1000) })}
                        </p>
                      </div>
                      {result.isCorrect ? (
                        <CheckCircleIcon className="h-6 w-6 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircleIcon className="h-6 w-6 text-red-500 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={handleRetakeQuiz}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={generateQuizMutation.isPending}
              >
                {generateQuizMutation.isPending ? t('loading.preparing') : t('actions.retakeQuiz')}
              </button>
              <button
                onClick={handleFinishQuiz}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('actions.continueLearning')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show quiz questions
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>{t('progress.question', { current: currentQuestionIndex + 1, total: questions.length })}</span>
            <span>{Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}%</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>{getQuizTypeLabel()}</span>
            <span>{t('progress.correct', { correct: results.filter(r => r.isCorrect).length, total: results.length })}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {t('question.prompt')}
            </h2>
            <div className="text-4xl font-bold text-blue-600 mb-4 kazakh-text">
              {currentQuestion.word}
            </div>
            <p className="text-sm text-gray-500">
              {t('question.selectTranslation')}
            </p>
          </div>

          {/* Answer Options */}
          <div className="space-y-3 mb-8">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(index)}
                className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                  selectedAnswer === index
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <div className="flex items-center">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-current flex items-center justify-center text-sm font-medium mr-3">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="text-lg">{option}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Next Button */}
          <div className="flex justify-end">
            <button
              onClick={handleNextQuestion}
              disabled={selectedAnswer === null}
              className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                selectedAnswer !== null
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isLastQuestion ? t('actions.finishQuiz') : t('actions.nextQuestion')}
              <ArrowRightIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizPage;