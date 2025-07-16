// kazakh-learn-frontend/src/components/learning/LearningModule.tsx
import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { learningAPI } from '../../services/learningAPI';
import { LEARNING_STATUSES, IN_PROGRESS_STATUSES } from '../../types/learning';
import { toast } from 'sonner';
import { 
  BookOpenIcon, 
  PencilIcon, 
  QuestionMarkCircleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  PlayIcon,
  StarIcon,
  ClockIcon,
  TrophyIcon,
  XMarkIcon,
  SpeakerWaveIcon
} from '@heroicons/react/24/outline';

// Types for the learning module
interface LearningWord {
  id: number;
  kazakh_word: string;
  kazakh_cyrillic?: string;
  translation: string;
  pronunciation?: string;
  image_url?: string;
  difficulty_level: number;
  times_seen: number;
  last_practiced?: string;
  status?: string;
}

interface QuizQuestion {
  id: number;
  question: string;
  kazakh_word: string;
  kazakh_cyrillic?: string;
  options: string[];
  correct_answer_index: number;
  correct_answer: string;
}

interface LearningCycle {
  phase: 'overview' | 'practice' | 'quiz' | 'complete';
  currentBatch: number;
  totalBatches: number;
  wordsPerBatch: number;
  currentWords: LearningWord[];
  practiceSession?: any;
  quizQuestions?: QuizQuestion[];
  batchResults: Array<{
    batchNumber: number;
    practiceCorrect: number;
    quizCorrect: number;
    wordsLearned: string[];
  }>;
}

interface LearningModuleProps {
  onComplete?: () => void;
}

const LearningModule: React.FC<LearningModuleProps> = ({ onComplete }) => {
  const { t } = useTranslation(['learning', 'common']);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State for learning cycle
  const [cycle, setCycle] = useState<LearningCycle>({
    phase: 'overview',
    currentBatch: 1,
    totalBatches: 1,
    wordsPerBatch: 3,
    currentWords: [],
    batchResults: []
  });

  // State for current session
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, boolean>>({});
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  const [wordStartTime, setWordStartTime] = useState<number>(0);

  // Get user's daily goal - simplified to use default value
  const dailyGoal = 10; // Default daily goal, can be made configurable later
  
  // Fetch words that need learning (not learned status)
  const { data: wordsToLearn, isLoading } = useQuery({
    queryKey: ['words-to-learn'],
    queryFn: async (): Promise<LearningWord[]> => {
      try {
        // Get words with learning statuses using learningAPI which returns UserWordProgressWithWord[]
        const response = await learningAPI.getProgress({
          limit: dailyGoal * 3, // Get more words than needed
        });
        
        // Filter to only include words with non-learned statuses and transform to LearningWord format
        return response
          .filter(wordProgress => 
            IN_PROGRESS_STATUSES.includes(wordProgress.status)
          )
          .map(wordProgress => ({
            id: wordProgress.kazakh_word_id,
            kazakh_word: wordProgress.kazakh_word?.kazakh_word || `Word ${wordProgress.kazakh_word_id}`,
            kazakh_cyrillic: wordProgress.kazakh_word?.kazakh_cyrillic,
            translation: wordProgress.kazakh_word?.translations?.[0]?.translation || 'No translation',
            // pronunciation: wordProgress.kazakh_word?.pronunciation,
            // image_url: wordProgress.kazakh_word?.image_url,
            difficulty_level: wordProgress.kazakh_word?.difficulty_level || 1,
            times_seen: wordProgress.times_seen,
            last_practiced: wordProgress.last_practiced_at,
            status: wordProgress.status
          } as LearningWord));
      } catch (error) {
        console.error('Failed to fetch learning words:', error);
        return [];
      }
    },
    enabled: !!user
  });

  // Initialize learning cycle when words are loaded
  useEffect(() => {
    if (wordsToLearn && wordsToLearn.length > 0) {
      const totalBatches = Math.ceil(Math.min(wordsToLearn.length, dailyGoal) / 3);
      setCycle(prev => ({
        ...prev,
        totalBatches,
        wordsPerBatch: 3,
        currentWords: wordsToLearn.slice(0, 3) // First 3 words
      }));
    }
  }, [wordsToLearn, dailyGoal]);

  // Start Practice Session for current batch
  const startPracticeMutation = useMutation({
    mutationFn: async () => {
      // Use learningAPI.startPracticeSession which exists in learningAPI.ts
      const response = await learningAPI.startPracticeSession({
        session_type: 'practice_batch',
        word_count: 3,
        category_id: undefined,
        difficulty_level_id: undefined,
        language_code: user?.main_language?.language_code || 'en'
      });
      return response;
    },
    onSuccess: (data) => {
      setCycle(prev => ({
        ...prev,
        phase: 'practice',
        practiceSession: data
      }));
      setCurrentWordIndex(0);
      setUserAnswers({});
      setSessionStartTime(Date.now());
      setWordStartTime(Date.now());
      toast.success('Practice session started!');
    },
    onError: (error) => {
      console.error('Failed to start practice:', error);
      toast.error('Failed to start practice session');
    }
  });

  // Submit Practice Answer
  const submitPracticeAnswerMutation = useMutation({
    mutationFn: async ({ wordId, wasCorrect, userAnswer, correctAnswer }: {
      wordId: number;
      wasCorrect: boolean;
      userAnswer?: string;
      correctAnswer?: string;
    }) => {
      if (!cycle.practiceSession) return;
      
      const responseTime = Date.now() - wordStartTime;
      
      return learningAPI.submitPracticeAnswer(cycle.practiceSession.session_id, {
        word_id: wordId,
        was_correct: wasCorrect,
        user_answer: userAnswer,
        correct_answer: correctAnswer,
        response_time_ms: responseTime
      });
    },
    onSuccess: (_, variables) => {
      setUserAnswers(prev => ({ ...prev, [`practice_${variables.wordId}`]: variables.wasCorrect }));
      
      if (currentWordIndex < cycle.currentWords.length - 1) {
        setCurrentWordIndex(prev => prev + 1);
        setWordStartTime(Date.now());
      } else {
        // Practice phase complete, move to quiz
        finishPracticeAndStartQuiz();
      }
    }
  });

  // Finish Practice and Start Quiz
  const finishPracticeAndStartQuiz = async () => {
    if (!cycle.practiceSession) return;

    try {
      // Finish practice session
      await learningAPI.finishPracticeSession(
        cycle.practiceSession.session_id,
        Math.floor((Date.now() - sessionStartTime) / 1000)
      );

      // Generate quiz questions from current words
      const quizQuestions = generateQuizQuestions(cycle.currentWords);

      setCycle(prev => ({
        ...prev,
        phase: 'quiz',
        quizQuestions
      }));
      setCurrentWordIndex(0);
      setWordStartTime(Date.now());
      
    } catch (error) {
      console.error('Error transitioning to quiz:', error);
      toast.error('Failed to start quiz session');
    }
  };

  // Generate quiz questions from words
  const generateQuizQuestions = (words: LearningWord[]): QuizQuestion[] => {
    return words.map((word, index) => {
      // Generate wrong options from other words
      const wrongOptions = words
        .filter(w => w.id !== word.id)
        .map(w => w.translation)
        .slice(0, 2);

      // Add generic wrong options if needed
      const genericOptions = ['water', 'house', 'tree', 'book', 'person', 'food'];
      while (wrongOptions.length < 3) {
        const randomOption = genericOptions[Math.floor(Math.random() * genericOptions.length)];
        if (!wrongOptions.includes(randomOption) && randomOption !== word.translation) {
          wrongOptions.push(randomOption);
        }
      }

      // Create options array and shuffle
      const allOptions = [word.translation, ...wrongOptions.slice(0, 3)];
      const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);
      const correctIndex = shuffledOptions.indexOf(word.translation);

      return {
        id: word.id,
        question: `What does "${word.kazakh_word}" mean?`,
        kazakh_word: word.kazakh_word,
        kazakh_cyrillic: word.kazakh_cyrillic,
        options: shuffledOptions,
        correct_answer_index: correctIndex,
        correct_answer: word.translation
      };
    });
  };

  // Submit Quiz Answer
  const submitQuizAnswerMutation = useMutation({
    mutationFn: async ({ questionId, selectedAnswer, isCorrect }: {
      questionId: number;
      selectedAnswer: string;
      isCorrect: boolean;
    }) => {
      const responseTime = Date.now() - wordStartTime;
      
      return {
        questionId,
        selectedAnswer,
        isCorrect,
        timeSpent: responseTime
      };
    },
    onSuccess: (result) => {
      setUserAnswers(prev => ({ 
        ...prev, 
        [`quiz_${result.questionId}`]: result.isCorrect 
      }));
      
      if (currentWordIndex < cycle.currentWords.length - 1) {
        setCurrentWordIndex(prev => prev + 1);
        setWordStartTime(Date.now());
      } else {
        // Quiz phase complete
        finishCurrentBatch();
      }
    }
  });

  // Finish Current Batch
  const finishCurrentBatch = async () => {
    const practiceCorrect = cycle.currentWords.filter(word => 
      userAnswers[`practice_${word.id}`] === true
    ).length;
    
    const quizCorrect = cycle.currentWords.filter(word => 
      userAnswers[`quiz_${word.id}`] === true
    ).length;

    // Words that were correct in both practice and quiz are marked as learned
    const wordsLearned = cycle.currentWords
      .filter(word => 
        userAnswers[`practice_${word.id}`] === true && 
        userAnswers[`quiz_${word.id}`] === true
      )
      .map(word => word.kazakh_word);

    // Update word statuses to "learned" for perfect performance
    for (const word of cycle.currentWords) {
      if (userAnswers[`practice_${word.id}`] === true && userAnswers[`quiz_${word.id}`] === true) {
        try {
          await learningAPI.updateWordProgress(word.id, {
            status: LEARNING_STATUSES.LEARNED,
            was_correct: true
          });
        } catch (error) {
          console.error('Failed to update word status:', error);
        }
      }
    }

    const batchResult = {
      batchNumber: cycle.currentBatch,
      practiceCorrect,
      quizCorrect,
      wordsLearned
    };

    setCycle(prev => ({
      ...prev,
      batchResults: [...prev.batchResults, batchResult]
    }));

    // Check if there are more batches
    if (cycle.currentBatch < cycle.totalBatches && wordsToLearn) {
      const nextBatchStart = cycle.currentBatch * 3;
      const nextWords = wordsToLearn.slice(nextBatchStart, nextBatchStart + 3);
      
      if (nextWords.length >= 3) {
        setCycle(prev => ({
          ...prev,
          phase: 'overview',
          currentBatch: prev.currentBatch + 1,
          currentWords: nextWords,
          practiceSession: undefined,
          quizQuestions: undefined
        }));
        setCurrentWordIndex(0);
        setUserAnswers({});
        toast.success(`Batch ${cycle.currentBatch} complete! Moving to next batch.`);
      } else {
        setCycle(prev => ({ ...prev, phase: 'complete' }));
      }
    } else {
      setCycle(prev => ({ ...prev, phase: 'complete' }));
    }
  };

  // Reset learning module
  const resetLearning = () => {
    setCycle({
      phase: 'overview',
      currentBatch: 1,
      totalBatches: Math.ceil(Math.min(wordsToLearn?.length || 0, dailyGoal) / 3),
      wordsPerBatch: 3,
      currentWords: wordsToLearn?.slice(0, 3) || [],
      batchResults: []
    });
    setCurrentWordIndex(0);
    setUserAnswers({});
    queryClient.invalidateQueries({ queryKey: ['words-to-learn'] });
  };

  // Complete module and call parent callback
  const completeModule = () => {
    if (onComplete) {
      onComplete();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading your learning session...</span>
      </div>
    );
  }

  if (!wordsToLearn || wordsToLearn.length === 0) {
    return (
      <div className="text-center p-8">
        <BookOpenIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No words to learn
        </h3>
        <p className="text-gray-600 mb-4">
          Add some words to your learning list to start practicing!
        </p>
        <button 
          onClick={() => window.location.href = '/app/words'}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Browse Words
        </button>
      </div>
    );
  }

  // Render based on current phase
  switch (cycle.phase) {
    case 'overview':
      return <OverviewPhase cycle={cycle} onStart={() => startPracticeMutation.mutate()} />;
    
    case 'practice':
      return (
        <PracticePhase 
          cycle={cycle}
          currentWordIndex={currentWordIndex}
          onAnswer={(wordId, wasCorrect, userAnswer, correctAnswer) => 
            submitPracticeAnswerMutation.mutate({ wordId, wasCorrect, userAnswer, correctAnswer })
          }
        />
      );
    
    case 'quiz':
      return (
        <QuizPhase 
          cycle={cycle}
          currentWordIndex={currentWordIndex}
          onAnswer={(questionId, selectedAnswer, isCorrect) => 
            submitQuizAnswerMutation.mutate({ questionId, selectedAnswer, isCorrect })
          }
        />
      );
    
    case 'complete':
      return <CompletionPhase cycle={cycle} onReset={resetLearning} onComplete={completeModule} />;
    
    default:
      return null;
  }
};

// Overview Phase Component
const OverviewPhase: React.FC<{
  cycle: LearningCycle;
  onStart: () => void;
}> = ({ cycle, onStart }) => {
  const { t } = useTranslation('learning');

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Learning Batch {cycle.currentBatch} of {cycle.totalBatches}
        </h1>
        <p className="text-gray-600">
          Ready to learn 3 new words? Let's start with an overview!
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {cycle.currentWords.map((word, index) => (
          <div key={word.id} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {word.kazakh_word}
              </h3>
              {word.kazakh_cyrillic && (
                <p className="text-gray-600 mb-2 text-lg">{word.kazakh_cyrillic}</p>
              )}
              <p className="text-xl text-blue-600 font-semibold mb-3">
                {word.translation}
              </p>
              {word.pronunciation && (
                <div className="flex items-center justify-center mb-3">
                  <SpeakerWaveIcon className="h-4 w-4 text-gray-400 mr-1" />
                  <p className="text-sm text-gray-500 italic">
                    /{word.pronunciation}/
                  </p>
                </div>
              )}
              {word.image_url && (
                <img 
                  src={word.image_url} 
                  alt={word.kazakh_word}
                  className="w-24 h-24 object-cover rounded-lg mx-auto mt-4 border"
                />
              )}
              <div className="mt-4">
                <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                  Level {word.difficulty_level}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center">
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-6">Learning Process:</h3>
          <div className="flex justify-center items-center space-x-6">
            <div className="flex items-center">
              <div className="bg-blue-100 rounded-full p-3 mr-3">
                <BookOpenIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">1. Overview</div>
                <div className="text-sm text-gray-500">Study the words</div>
              </div>
            </div>
            <ArrowRightIcon className="h-5 w-5 text-gray-400" />
            <div className="flex items-center">
              <div className="bg-green-100 rounded-full p-3 mr-3">
                <PencilIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">2. Practice</div>
                <div className="text-sm text-gray-500">Write translations</div>
              </div>
            </div>
            <ArrowRightIcon className="h-5 w-5 text-gray-400" />
            <div className="flex items-center">
              <div className="bg-purple-100 rounded-full p-3 mr-3">
                <QuestionMarkCircleIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">3. Quiz</div>
                <div className="text-sm text-gray-500">Multiple choice</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 rounded-lg p-4 mb-6">
          <StarIcon className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
          <p className="text-yellow-800 font-medium">
            Words you get correct in BOTH practice and quiz will be marked as learned!
          </p>
        </div>

        <button
          onClick={onStart}
          className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors flex items-center mx-auto shadow-lg"
        >
          <PlayIcon className="h-6 w-6 mr-2" />
          Start Practice Session
        </button>
      </div>
    </div>
  );
};

// Practice Phase Component
const PracticePhase: React.FC<{
  cycle: LearningCycle;
  currentWordIndex: number;
  onAnswer: (wordId: number, wasCorrect: boolean, userAnswer?: string, correctAnswer?: string) => void;
}> = ({ cycle, currentWordIndex, onAnswer }) => {
  const [userInput, setUserInput] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const currentWord = cycle.currentWords[currentWordIndex];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const correct = userInput.toLowerCase().trim() === currentWord.translation.toLowerCase().trim();
    setIsCorrect(correct);
    setShowResult(true);
    
    setTimeout(() => {
      onAnswer(currentWord.id, correct, userInput, currentWord.translation);
      setUserInput('');
      setShowResult(false);
    }, 2000);
  };

  if (!currentWord) return null;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="text-center mb-8">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-500 font-medium">Practice Session</span>
          <span className="text-sm text-gray-500 font-medium">
            {currentWordIndex + 1} of {cycle.currentWords.length}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
          <div 
            className="bg-green-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${((currentWordIndex + 1) / cycle.currentWords.length) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-lg">
        <h2 className="text-4xl font-bold text-gray-900 mb-3">
          {currentWord.kazakh_word}
        </h2>
        {currentWord.kazakh_cyrillic && (
          <p className="text-2xl text-gray-600 mb-4">{currentWord.kazakh_cyrillic}</p>
        )}
        {currentWord.pronunciation && (
          <div className="flex items-center justify-center mb-6">
            <SpeakerWaveIcon className="h-5 w-5 text-gray-400 mr-2" />
            <p className="text-lg text-gray-500 italic">
              /{currentWord.pronunciation}/
            </p>
          </div>
        )}
        {currentWord.image_url && (
          <img 
            src={currentWord.image_url} 
            alt={currentWord.kazakh_word}
            className="w-40 h-40 object-cover rounded-lg mx-auto mb-6 border shadow-sm"
          />
        )}

        {!showResult ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-lg font-medium text-gray-700 mb-3">
                What does this word mean in English?
              </label>
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-4 text-xl text-center focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Type your answer..."
                autoFocus
                required
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors shadow-md"
            >
              Submit Answer
            </button>
          </form>
        ) : (
          <div className={`p-8 rounded-xl ${isCorrect ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'}`}>
            {isCorrect ? (
              <div className="text-center">
                <CheckCircleIcon className="h-20 w-20 text-green-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-green-800 mb-3">Correct! 🎉</h3>
                <p className="text-green-700 text-lg">
                  "{currentWord.kazakh_word}" means "{currentWord.translation}"
                </p>
              </div>
            ) : (
              <div className="text-center">
                <XMarkIcon className="h-20 w-20 text-red-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-red-800 mb-3">Not quite right</h3>
                <p className="text-red-700 mb-2 text-lg">
                  You answered: "{userInput}"
                </p>
                <p className="text-red-700 text-lg">
                  Correct answer: "{currentWord.translation}"
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Quiz Phase Component
const QuizPhase: React.FC<{
  cycle: LearningCycle;
  currentWordIndex: number;
  onAnswer: (questionId: number, selectedAnswer: string, isCorrect: boolean) => void;
}> = ({ cycle, currentWordIndex, onAnswer }) => {
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const currentQuestion = cycle.quizQuestions?.[currentWordIndex];

  const handleOptionSelect = (option: string) => {
    if (showResult) return;
    
    setSelectedOption(option);
    const correct = option === currentQuestion?.correct_answer;
    setIsCorrect(correct);
    setShowResult(true);
    
    setTimeout(() => {
      if (currentQuestion) {
        onAnswer(currentQuestion.id, option, correct);
      }
      setSelectedOption('');
      setShowResult(false);
    }, 2000);
  };

  if (!currentQuestion) return null;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="text-center mb-8">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-500 font-medium">Quiz Session</span>
          <span className="text-sm text-gray-500 font-medium">
            {currentWordIndex + 1} of {cycle.currentWords.length}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
          <div 
            className="bg-purple-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${((currentWordIndex + 1) / cycle.currentWords.length) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-lg">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {currentQuestion.question}
          </h2>
          <div className="text-3xl font-bold text-blue-600 mb-2">
            {currentQuestion.kazakh_word}
          </div>
          {currentQuestion.kazakh_cyrillic && (
            <p className="text-xl text-gray-600">({currentQuestion.kazakh_cyrillic})</p>
          )}
        </div>

        <div className="space-y-4">
          {currentQuestion.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleOptionSelect(option)}
              disabled={showResult}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all text-lg font-medium ${
                showResult && option === currentQuestion.correct_answer
                  ? 'border-green-500 bg-green-50 text-green-800'
                  : showResult && option === selectedOption && !isCorrect
                  ? 'border-red-500 bg-red-50 text-red-800'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700'
              } ${showResult ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center justify-between">
                <span>{option}</span>
                {showResult && option === currentQuestion.correct_answer && (
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                )}
                {showResult && option === selectedOption && !isCorrect && (
                  <XMarkIcon className="h-6 w-6 text-red-600" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Completion Phase Component
const CompletionPhase: React.FC<{
  cycle: LearningCycle;
  onReset: () => void;
  onComplete: () => void;
}> = ({ cycle, onReset, onComplete }) => {
  const totalWordsLearned = cycle.batchResults.reduce((sum, batch) => 
    sum + batch.wordsLearned.length, 0
  );
  
  const totalPracticeCorrect = cycle.batchResults.reduce((sum, batch) => 
    sum + batch.practiceCorrect, 0
  );
  
  const totalQuizCorrect = cycle.batchResults.reduce((sum, batch) => 
    sum + batch.quizCorrect, 0
  );

  const overallAccuracy = cycle.batchResults.length > 0 
    ? Math.round(((totalPracticeCorrect + totalQuizCorrect) / (cycle.batchResults.length * 6)) * 100)
    : 0;

  const getMotivationalMessage = () => {
    if (totalWordsLearned === cycle.batchResults.length * 3 && overallAccuracy >= 90) {
      return "Perfect! You're a natural learner! 🌟";
    } else if (totalWordsLearned >= cycle.batchResults.length * 2 && overallAccuracy >= 80) {
      return "Excellent work! Keep up the great progress! 🎉";
    } else if (totalWordsLearned >= cycle.batchResults.length && overallAccuracy >= 60) {
      return "Good job! You're making solid progress! 👍";
    } else if (overallAccuracy >= 40) {
      return "Nice effort! Practice makes perfect! 💪";
    } else {
      return "Keep trying! Every mistake is a learning opportunity! 🚀";
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <div className="mb-6">
          <TrophyIcon className="h-24 w-24 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Congratulations! 🎉
          </h1>
          <p className="text-xl text-gray-600 mb-4">
            You've completed your learning session
          </p>
          <p className="text-lg text-blue-600 font-semibold">
            {getMotivationalMessage()}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Words Learned
            </h3>
            <p className="text-4xl font-bold text-blue-600 mb-2">{totalWordsLearned}</p>
            <p className="text-sm text-blue-700">
              Marked as learned in your progress
            </p>
          </div>
          <div className="bg-green-50 rounded-xl p-6 border border-green-200">
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              Practice Accuracy
            </h3>
            <p className="text-4xl font-bold text-green-600 mb-2">
              {cycle.batchResults.length > 0 ? Math.round((totalPracticeCorrect / (cycle.batchResults.length * 3)) * 100) : 0}%
            </p>
            <p className="text-sm text-green-700">
              {totalPracticeCorrect}/{cycle.batchResults.length * 3} correct
            </p>
          </div>
          <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
            <h3 className="text-lg font-semibold text-purple-900 mb-2">
              Quiz Accuracy
            </h3>
            <p className="text-4xl font-bold text-purple-600 mb-2">
              {cycle.batchResults.length > 0 ? Math.round((totalQuizCorrect / (cycle.batchResults.length * 3)) * 100) : 0}%
            </p>
            <p className="text-sm text-purple-700">
              {totalQuizCorrect}/{cycle.batchResults.length * 3} correct
            </p>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-2xl font-semibold mb-6">Batch Results</h3>
          <div className="space-y-4">
            {cycle.batchResults.map((batch, index) => (
              <div key={index} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-lg font-semibold text-gray-900">
                    Batch {batch.batchNumber}
                  </h4>
                  <div className="flex space-x-6 text-sm">
                    <span className="flex items-center text-green-600">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                      Practice: {batch.practiceCorrect}/3
                    </span>
                    <span className="flex items-center text-purple-600">
                      <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                      Quiz: {batch.quizCorrect}/3
                    </span>
                    <span className="flex items-center text-blue-600">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                      Learned: {batch.wordsLearned.length}
                    </span>
                  </div>
                </div>
                {batch.wordsLearned.length > 0 && (
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-sm text-green-800 font-medium">
                      Words learned: {batch.wordsLearned.join(', ')}
                    </p>
                  </div>
                )}
                {batch.wordsLearned.length === 0 && (
                  <div className="bg-yellow-50 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      No words learned in this batch. Review and practice more!
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{cycle.batchResults.length}</div>
              <div className="text-sm text-gray-600">Batches Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{cycle.batchResults.length * 3}</div>
              <div className="text-sm text-gray-600">Words Practiced</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{overallAccuracy}%</div>
              <div className="text-sm text-gray-600">Overall Accuracy</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{Math.round((totalWordsLearned / (cycle.batchResults.length * 3)) * 100)}%</div>
              <div className="text-sm text-gray-600">Learning Rate</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
          <button
            onClick={onReset}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            Start New Session
          </button>
          <button
            onClick={onComplete}
            className="bg-gray-600 text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-gray-700 transition-colors shadow-md"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Tips for improvement */}
        {overallAccuracy < 70 && (
          <div className="mt-8 bg-blue-50 rounded-lg p-6 border border-blue-200">
            <h4 className="text-lg font-semibold text-blue-900 mb-3">💡 Tips for Improvement</h4>
            <ul className="text-blue-800 space-y-2 text-left">
              <li>• Review the words you missed before your next session</li>
              <li>• Try to create sentences using the new words</li>
              <li>• Practice pronunciation out loud</li>
              <li>• Use spaced repetition - review words after 1 day, 3 days, then 1 week</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default LearningModule;