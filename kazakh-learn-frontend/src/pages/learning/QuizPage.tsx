// src/pages/learning/QuizPage.tsx - With proper translations
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
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

  // Get user's preferred language
  const getUserLanguage = () => {
    return user?.main_language?.language_code || 'en';
  };

  // Get learning stats
  const { data: stats } = useQuery({
    queryKey: ['learning-stats'],
    queryFn: learningAPI.getStats,
  });

  // 🎯 MODIFIED: Only get learned words for quiz
  const generateQuizMutation = useMutation({
    mutationFn: async () => {
      console.log('🧠 Starting quiz generation with LEARNED words only...');
      console.log('Quiz parameters:', { questionCount, categoryId, difficultyLevelId });
      
      try {
        // Get learned words directly using the learning API
        console.log('📚 Fetching learned words for quiz...');
        
        const learnedWordsResponse = await learningAPI.getProgress({
          status: 'learned', // Only learned words
          category_id: categoryId,
          limit: 100, // Get all learned words
          offset: 0
        });
        
        console.log('📊 Learned words response for quiz:', learnedWordsResponse);
        console.log(`📈 Total learned words found: ${learnedWordsResponse.length}`);
        
        if (learnedWordsResponse.length === 0) {
          throw new Error('No learned words available for quiz. Please complete some learning modules first to unlock quiz mode.');
        }
        
        // Convert to quiz word format
        const quizWords: QuizWord[] = learnedWordsResponse.map(progress => {
          const word = progress.kazakh_word;
          
          // Get translation in user's preferred language
          const userLanguageCode = getUserLanguage();
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
        
        console.log(`✅ Successfully converted ${quizWords.length} learned words for quiz`);
        
        // Check if we have enough words for quiz (need at least 4 for proper quiz)
        if (quizWords.length < 4) {
          throw new Error('Need at least 4 learned words to create a proper quiz. Please learn more words first.');
        }
        
        // Shuffle words and select for questions
        const shuffledWords = [...quizWords];
        for (let i = shuffledWords.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledWords[i], shuffledWords[j]] = [shuffledWords[j], shuffledWords[i]];
        }
        
        // Limit to requested question count or available words
        const wordsForQuestions = shuffledWords.slice(0, Math.min(questionCount, shuffledWords.length));
        
        console.log(`🎯 Creating ${wordsForQuestions.length} quiz questions`);
        
        // 🔥 FIX: Generate quiz questions with proper 4 options from learned words only
        const questions: LocalQuizQuestion[] = wordsForQuestions.map((word, index) => {
          console.log(`\n📝 Creating question ${index + 1} for word: ${word.kazakh_word}`);
          
          // Get all other words as potential wrong options
          const otherWords = shuffledWords.filter(w => 
            w.id !== word.id && 
            w.translation !== word.translation &&
            w.translation !== 'No translation'
          );
          
          console.log(`   Available other words: ${otherWords.length}`);
          
          // Select exactly 3 wrong options randomly
          const wrongOptions: string[] = [];
          const availableWrongOptions = otherWords.map(w => w.translation);
          
          // Randomly select 3 unique wrong options
          while (wrongOptions.length < 3 && availableWrongOptions.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableWrongOptions.length);
            const wrongOption = availableWrongOptions[randomIndex];
            
            if (!wrongOptions.includes(wrongOption)) {
              wrongOptions.push(wrongOption);
            }
            
            // Remove used option to avoid duplicates
            availableWrongOptions.splice(randomIndex, 1);
          }
          
          // If we don't have enough wrong options from learned words, 
          // this means the user doesn't have enough learned words
          if (wrongOptions.length < 3) {
            console.warn(`⚠️ Only ${wrongOptions.length} wrong options available for word ${word.kazakh_word}`);
            // Pad with placeholder options as last resort
            while (wrongOptions.length < 3) {
              wrongOptions.push(`Вариант ${wrongOptions.length + 1}`);
            }
          }
          
          // Create final 4 options: 1 correct + 3 wrong
          const allOptions = [word.translation, ...wrongOptions];
          
          // Shuffle all 4 options
          for (let i = allOptions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
          }
          
          // Find where the correct answer ended up after shuffling
          const correctAnswer = allOptions.indexOf(word.translation);
          
          console.log(`   ✅ Correct answer: ${word.translation}`);
          console.log(`   ❌ Wrong options: ${wrongOptions.join(', ')}`);
          console.log(`   🎲 All options: ${allOptions.join(', ')}`);
          console.log(`   📍 Correct index: ${correctAnswer}`);
          
          // Verify we have exactly 4 options
          if (allOptions.length !== 4) {
            console.error(`❌ ERROR: Expected 4 options, got ${allOptions.length}`);
            throw new Error(`Quiz generation error: Expected 4 options, got ${allOptions.length}`);
          }
          
          return {
            id: word.id,
            word: word.kazakh_word,
            translation: word.translation,
            options: allOptions,
            correctAnswer: correctAnswer,
            type: 'multiple_choice' as const
          };
        });
        
        console.log(`🎯 Generated ${questions.length} quiz questions from learned words`);
        
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
      console.log('🧠 Quiz generated successfully:', data);
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
      console.log('📊 Submitting quiz results:', results);
      
      try {
        // Try to submit to backend, but don't fail if it doesn't work
        return await quizAPI.submitQuizResults(sessionId, results, getUserLanguage());
      } catch (error) {
        console.log('⚠️ Backend submission failed, logging locally:', error);
        return { success: true, message: 'Quiz completed locally' };
      }
    },
    onSuccess: (data) => {
      console.log('✅ Quiz results submitted:', data);
      toast.success(t('results.title'));
    },
    onError: (error) => {
      console.log('⚠️ Quiz submission error (non-critical):', error);
    }
  });

  // Initialize quiz when component mounts
  useEffect(() => {
    if (!questions.length && !isQuizComplete && stats !== undefined) {
      console.log('🚀 Auto-starting quiz generation...');
      generateQuizMutation.mutate();
    }
  }, [stats, questions.length, isQuizComplete]);

  // Event handlers
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
            {t('actions.continueLearning')}
          </button>
        </div>
      </div>
    );
  }

  // Quiz completed state
  if (isQuizComplete) {
    const score = calculateScore();
    const correct = results.filter(r => r.isCorrect).length;
    const total = results.length;

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('results.title')}</h1>
          <p className="text-gray-600 mb-6">{t('results.yourScore', { score })}</p>
          
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{score}%</div>
              <div className="text-sm text-gray-600">Score</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{correct}</div>
              <div className="text-sm text-gray-600">{t('results.correct')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-600">{total}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleRetakeQuiz}
              className="btn-secondary w-full"
            >
              {t('actions.retakeQuiz')}
            </button>
            <button
              onClick={handleFinishQuiz}
              className="btn-primary w-full flex items-center justify-center space-x-2"
            >
              <TrophyIcon className="h-5 w-5" />
              <span>View Progress</span>
            </button>
          </div>
        </div>

        {/* Question Review */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('results.reviewTitle')}</h3>
          <div className="space-y-3">
            {results.map((result, index) => {
              const question = questions[index];
              const isCorrect = result.isCorrect;
              
              return (
                <div key={question.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div className="flex items-center space-x-3">
                    {isCorrect ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-medium">{question.word}</span>
                    <span className="text-gray-600">→</span>
                    <span className="text-gray-700">{question.translation}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {Math.round(result.timeSpent / 1000)}s
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Quiz in progress
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Debug Info - Remove after testing */}
      {/* {process.env.NODE_ENV === 'development' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-800 mb-2">🔍 Quiz Debug Info:</h4>
          <div className="text-sm text-yellow-700 space-y-1">
            <p><strong>URL:</strong> {window.location.href}</p>
            <p><strong>Question Count:</strong> {questionCount}</p>
            <p><strong>Category ID:</strong> {categoryId || 'all categories'}</p>
            <p><strong>Quiz Questions:</strong> {questions.length}</p>
            <p><strong>Stats Total Words:</strong> {stats?.total_words || 0}</p>
            <p><strong>Learned Words:</strong> {stats?.words_by_status?.learned || 0}</p>
          </div>
        </div>
      )} */}

      {/* Quiz Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              🧠 {t('headers.learnedWordsQuiz')}
            </h1>
            <p className="text-gray-600">
              {t('progress.question', { 
                current: currentQuestionIndex + 1, 
                total: questions.length 
              })}
            </p>
            <p className="text-sm text-blue-600 mt-1">
              🏆 {t('headers.testingVocabulary')}
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              Score: {results.filter(r => r.isCorrect).length} / {results.length}
            </div>
            <ClockIcon className="h-5 w-5 text-gray-400" />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      {currentQuestion && (
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="text-center space-y-6">
            {/* Word Display */}
            <div className="space-y-4">
              <div className="text-4xl font-bold text-gray-900">
                {currentQuestion.word}
              </div>
              <p className="text-lg text-gray-700">
                {t('question.prompt')}
              </p>
            </div>

            {/* Answer Options */}
            <div className="grid grid-cols-1 gap-3 max-w-md mx-auto">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(index)}
                  className={`p-4 text-left rounded-lg border-2 transition-all ${
                    selectedAnswer === index
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="font-medium">{String.fromCharCode(65 + index)}.</span> {option}
                </button>
              ))}
            </div>

            {/* Next Button */}
            <div className="text-center pt-4">
              <button
                onClick={handleNextQuestion}
                disabled={selectedAnswer === null}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
              >
                {isLastQuestion ? (
                  <>
                    <TrophyIcon className="h-5 w-5" />
                    <span>{t('actions.finishQuiz')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('actions.nextQuestion')}</span>
                    <ArrowRightIcon className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Stats */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('stats.title')}</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{currentQuestionIndex + 1}</div>
            <div className="text-sm text-gray-600">{t('stats.current')}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {results.filter(r => r.isCorrect).length}
            </div>
            <div className="text-sm text-gray-600">{t('results.correct')}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">
              {results.filter(r => !r.isCorrect).length}
            </div>
            <div className="text-sm text-gray-600">{t('results.incorrect')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizPage;