import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  AcademicCapIcon,
  ArrowLeftIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

import { useAuth } from '../../contexts/AuthContext';
import { learningAPI } from '../../services/learningAPI';
import { userPreferencesAPI } from '../../services/api';

// Local quiz question interface
interface LocalQuizQuestion {
  id: number;
  word: string;
  translation: string;
  options: string[];
  correctAnswer: number;
  type: 'multiple_choice' | 'translation';
}

interface QuizResult {
  questionId: number;
  wasCorrect: boolean;
  userAnswer: number;
  correctAnswer: number;
  responseTime: number;
}

// Word interface matching your API
interface Word {
  id: number;
  kazakh_word: string;
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
  
  // Get user preferences for quiz word count
  const { data: userPreferences } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: userPreferencesAPI.getPreferences,
  });

  // Use URL parameter, then user preference, then default to 5
  const questionCount = parseInt(searchParams.get('count') || '') || userPreferences?.quiz_word_count || 5;

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
        
        if (learnedWordsResponse.length < questionCount) {
          toast.error(`Only ${learnedWordsResponse.length} learned words available. Please learn more words or reduce quiz length in settings.`);
        }
        
        // Extract the quiz words from the learning progress data
        const quizWords = learnedWordsResponse.map((item: any) => ({
          id: item.word.id,
          kazakh_word: item.word.kazakh_word,
          translation: item.word.translation || 'No translation',
        }));
        
        console.log('🎯 Quiz words extracted:', quizWords.slice(0, 3));
        
        if (quizWords.length < Math.min(questionCount, 3)) {
          throw new Error('Please learn more words first.');
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
        
        // Generate quiz questions with proper 4 options from learned words only
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
            const option = availableWrongOptions[randomIndex];
            wrongOptions.push(option);
            availableWrongOptions.splice(randomIndex, 1); // Remove to avoid duplicates
          }
          
          // Fill remaining slots with generic options if needed
          const genericAnswers = [
            'hello', 'water', 'book', 'house', 'tree', 'car', 'food', 'person',
            'time', 'day', 'night', 'good', 'bad', 'big', 'small', 'new', 'old'
          ];
          
          while (wrongOptions.length < 3) {
            const randomAnswer = genericAnswers[Math.floor(Math.random() * genericAnswers.length)];
            if (!wrongOptions.includes(randomAnswer) && 
                randomAnswer !== word.translation.toLowerCase()) {
              wrongOptions.push(randomAnswer);
            }
          }
          
          console.log(`   Wrong options: ${wrongOptions}`);
          
          // Create all options and shuffle
          const allOptions = [word.translation, ...wrongOptions.slice(0, 3)];
          const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);
          const correctAnswerIndex = shuffledOptions.indexOf(word.translation);
          
          console.log(`   Final options: ${shuffledOptions}`);
          console.log(`   Correct answer index: ${correctAnswerIndex}`);
          
          return {
            id: word.id,
            word: word.kazakh_word,
            translation: word.translation,
            options: shuffledOptions,
            correctAnswer: correctAnswerIndex,
            type: 'multiple_choice' as const
          };
        });
        
        console.log('✅ Quiz questions generated successfully:', questions.length);
        return questions;
        
      } catch (error) {
        console.error('❌ Quiz generation failed:', error);
        throw error;
      }
    },
    onSuccess: (questions) => {
      console.log('✅ Quiz generation successful, setting questions:', questions.length);
      setQuestions(questions);
      setStartTime(Date.now());
    },
    onError: (error: any) => {
      console.error('❌ Quiz generation error:', error);
      toast.error(error.message || 'Failed to generate quiz questions');
    }
  });

  // Initialize quiz on component mount
  useEffect(() => {
    console.log('🎯 QuizPage mounted, generating quiz...');
    generateQuizMutation.mutate();
  }, [categoryId, difficultyLevelId, questionCount]);

  // Handle answer selection
  const handleAnswerSelect = (answerIndex: number) => {
    if (selectedAnswer !== null) return; // Prevent multiple selections
    
    setSelectedAnswer(answerIndex);
    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = answerIndex === currentQuestion.correctAnswer;
    const responseTime = Date.now() - startTime;
    
    // Record result
    const result: QuizResult = {
      questionId: currentQuestion.id,
      wasCorrect: isCorrect,
      userAnswer: answerIndex,
      correctAnswer: currentQuestion.correctAnswer,
      responseTime
    };
    
    setResults(prev => [...prev, result]);
    
    // Show feedback
    if (isCorrect) {
      toast.success('Correct!');
    } else {
      toast.error(`Incorrect. The answer was: ${currentQuestion.options[currentQuestion.correctAnswer]}`);
    }
    
    // Move to next question after delay
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer(null);
        setStartTime(Date.now());
      } else {
        // Quiz complete
        setIsQuizComplete(true);
      }
    }, 2000);
  };

  // Calculate quiz results
  const calculateResults = () => {
    const correctAnswers = results.filter(r => r.wasCorrect).length;
    const totalQuestions = results.length;
    const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
    const averageTime = results.length > 0 
      ? results.reduce((sum, r) => sum + r.responseTime, 0) / results.length 
      : 0;
    
    return {
      correctAnswers,
      totalQuestions,
      accuracy: Math.round(accuracy),
      averageTime: Math.round(averageTime / 1000) // Convert to seconds
    };
  };

  // Navigate to settings
  const goToSettings = () => {
    navigate('/settings');
  };

  // Restart quiz
  const restartQuiz = () => {
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setResults([]);
    setIsQuizComplete(false);
    setStartTime(Date.now());
    generateQuizMutation.mutate();
  };

  // Loading state - Fixed to use isPending instead of isLoading
  if (generateQuizMutation.isPending) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Generating Quiz Questions...
          </h2>
          <p className="text-gray-600">
            Creating {questionCount} questions from your learned words
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (generateQuizMutation.error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center">
          <XCircleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Unable to Generate Quiz
          </h2>
          <p className="text-gray-600 mb-6">
            {(generateQuizMutation.error as any)?.message || 'Please try again or adjust your settings.'}
          </p>
          <div className="space-x-4">
            <button
              onClick={restartQuiz}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              Try Again
            </button>
            <button
              onClick={goToSettings}
              className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700 inline-flex items-center"
            >
              <Cog6ToothIcon className="h-4 w-4 mr-2" />
              Adjust Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Quiz completion state
  if (isQuizComplete) {
    const results = calculateResults();
    
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center mb-8">
          <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Quiz Complete!
          </h1>
          <p className="text-gray-600">
            Great job on completing your quiz session
          </p>
        </div>

        {/* Results Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Results</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {results.correctAnswers}
              </div>
              <div className="text-sm text-gray-600">Correct</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {results.totalQuestions - results.correctAnswers}
              </div>
              <div className="text-sm text-gray-600">Incorrect</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {results.accuracy}%
              </div>
              <div className="text-sm text-gray-600">Accuracy</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {results.averageTime}s
              </div>
              <div className="text-sm text-gray-600">Avg Time</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={restartQuiz}
            className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 font-medium"
          >
            Take Another Quiz
          </button>
          
          <button
            onClick={goToSettings}
            className="bg-gray-600 text-white px-6 py-3 rounded-md hover:bg-gray-700 font-medium inline-flex items-center justify-center"
          >
            <Cog6ToothIcon className="h-4 w-4 mr-2" />
            Quiz Settings
          </button>
          
          <button
            onClick={() => navigate('/learning')}
            className="border border-gray-300 text-gray-700 px-6 py-3 rounded-md hover:bg-gray-50 font-medium"
          >
            Back to Learning
          </button>
        </div>
      </div>
    );
  }

  // Quiz in progress
  if (questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto mb-6"></div>
            <div className="space-y-3">
              <div className="h-12 bg-gray-200 rounded"></div>
              <div className="h-12 bg-gray-200 rounded"></div>
              <div className="h-12 bg-gray-200 rounded"></div>
              <div className="h-12 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/learning')}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-1" />
          Back
        </button>
        
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
          
          <button
            onClick={goToSettings}
            className="p-2 text-gray-400 hover:text-gray-600"
            title="Quiz Settings"
          >
            <Cog6ToothIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      {/* Question */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <AcademicCapIcon className="h-8 w-8 text-blue-600 mr-3" />
          <h1 className="text-2xl font-bold text-gray-900">
            What does this word mean?
          </h1>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-8 mb-8">
          <div className="text-4xl font-bold text-gray-900 mb-2">
            {currentQuestion.word}
          </div>
          <div className="text-sm text-gray-500">
            Choose the correct translation
          </div>
        </div>
      </div>

      {/* Answer Options */}
      <div className="space-y-4">
        {currentQuestion.options.map((option, index) => {
          let buttonClass = "w-full p-4 text-left border rounded-lg transition-all duration-200 hover:border-blue-300 hover:bg-blue-50";
          
          if (selectedAnswer !== null) {
            if (index === currentQuestion.correctAnswer) {
              buttonClass += " border-green-500 bg-green-50 text-green-800";
            } else if (index === selectedAnswer && selectedAnswer !== currentQuestion.correctAnswer) {
              buttonClass += " border-red-500 bg-red-50 text-red-800";
            } else {
              buttonClass += " opacity-50";
            }
          } else {
            buttonClass += " border-gray-300 hover:shadow-md";
          }
          
          return (
            <button
              key={index}
              onClick={() => handleAnswerSelect(index)}
              disabled={selectedAnswer !== null}
              className={buttonClass}
            >
              <div className="flex items-center">
                <span className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium mr-4">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="text-lg">{option}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Timer/Stats */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <div className="flex items-center justify-center">
          <ClockIcon className="h-4 w-4 mr-1" />
          Question {currentQuestionIndex + 1} of {questions.length}
        </div>
      </div>
    </div>
  );
};

export default QuizPage;