// kazakh-learn-frontend/src/components/learning/LearningModule.tsx
import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { learningAPI } from '../../services/learningAPI';
import { learningModuleAPI } from '../../services/learningModuleAPI';
import { LEARNING_STATUSES, IN_PROGRESS_STATUSES, type LearningStatus } from '../../types/learning';
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
import { PhotoIcon } from '@heroicons/react/24/outline';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { KazakhWordSummary } from '../../types/api';


// Types for the learning module
interface LearningWord {
  id: number;
  kazakh_word: string;
  kazakh_cyrillic?: string;
  translation: string;
  pronunciation?: string;
  // ✅ ИСПРАВЛЕНО: Добавлены поля для изображений
  image_url?: string;        // Основное поле от API  
  primary_image?: string;    // Дополнительное поле для совместимости
  difficulty_level: number;
  times_seen: number;
  last_practiced?: string;
  status?: string;
  category_name?: string;
  word_type_name?: string;
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

  useEffect(() => {
    // console.log('🔍 useEffect triggered:', {
    //   phase: cycle.phase,
    //   currentBatch: cycle.currentBatch,
    //   wordsLength: cycle.currentWords.length,
    //   words: cycle.currentWords.map(w => ({ id: w.id, kazakh_word: w.kazakh_word }))
    // });
  
    // Auto-update word status for Batch 1 when words are first shown
    if (cycle.phase === 'overview' && 
        cycle.currentBatch === 1 && 
        cycle.currentWords.length === 3) {
      
      // console.log('🎯 Batch 1 words displayed - automatically setting to learning status');
      // console.log('📋 Word IDs to update:', cycle.currentWords.map(w => w.id));
      
      const updateWordStatus = async () => {
        try {
          let updatedCount = 0;
          const updateResults = [];
  
          // Update each word individually using existing API
          for (const word of cycle.currentWords) {
            try {
              console.log(`🔄 Updating word ${word.id} (${word.kazakh_word}) to LEARNING status`);
              
              // Используем правильный тип - приводим к LearningStatus
              const requestData: { status: LearningStatus } = {
                status: LEARNING_STATUSES.LEARNING // Этот тип правильный: 'learning'
              };
              
              // console.log('📦 Sending request data:', requestData);
              
              const result = await learningAPI.updateWordProgress(word.id, requestData);
              
              // console.log(`✅ Successfully updated word ${word.id}:`, result);
              updatedCount++;
              updateResults.push({
                word_id: word.id,
                kazakh_word: word.kazakh_word,
                status: 'updated',
                new_status: 'learning'
              });
              
            } catch (error: any) {
              console.error(`❌ Failed to update word ${word.id}:`, error);
              console.error('Error details:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
              });
              
              updateResults.push({
                word_id: word.id,
                kazakh_word: word.kazakh_word,
                status: 'failed',
                error: error.response?.data?.detail || error.message || 'Unknown error'
              });
            }
          }
          
          // console.log('📈 Batch update completed:', {
          //   totalWords: cycle.currentWords.length,
          //   successfulUpdates: updatedCount,
          //   results: updateResults
          // });
          
          if (updatedCount > 0) {
            // console.log(`✅ SUCCESS: ${updatedCount}/${cycle.currentWords.length} words automatically moved to LEARNING status!`);
            
            // Optional: Show a subtle success message
            // toast.success(`🚀 ${updatedCount} words added to your learning list!`, { duration: 3000 });
          } else {
            console.log('⚠️ No words were updated. Check errors above for details.');
          }
          
        } catch (error) {
          console.error('❌ Failed to auto-update word statuses:', error);
        }
      };
      
      // Small delay to ensure UI is rendered and data is loaded
      // console.log('⏰ Setting 1000ms timeout for API calls...');
      const timer = setTimeout(() => {
        // console.log('⏰ Timeout triggered, calling updateWordStatus()');
        updateWordStatus();
      }, 1000);
      
      return () => {
        console.log('🧹 Cleaning up timeout');
        clearTimeout(timer);
      };
    } else {
      // console.log('❌ Conditions not met for status update:', {
      //   isOverview: cycle.phase === 'overview',
      //   isBatch1: cycle.currentBatch === 1,  
      //   hasThreeWords: cycle.currentWords.length === 3
      // });
    }
  }, [cycle.phase, cycle.currentBatch, cycle.currentWords]);

  // State for current session
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, boolean>>({});
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  const [wordStartTime, setWordStartTime] = useState<number>(0);

  // Get user's daily goal - simplified to use default value
  const dailyGoal = 10; // Default daily goal, can be made configurable later
  
  // Fetch words that need learning (not learned status)
  const { data: wordsToLearn, isLoading } = useQuery({
    queryKey: ['words-to-learn', dailyGoal, user?.main_language?.language_code],
    queryFn: async (): Promise<LearningWord[]> => {
      try {
        // console.log('🔍 Fetching words using learningModuleAPI...');
        
        // Use the correct learning module API
        const response = await learningModuleAPI.getWordsNotLearned(dailyGoal);
        
        // console.log('📝 Learning module API response:', response);
        
        // The API returns { total_words: number, batches: WordBatch[], ... }
        // Extract words from batches
        const words = response.batches?.flatMap(batch => batch.words) || [];
        
        // console.log('📝 Extracted words from batches:', words);
        
        // Words are already in the correct format from the learning module API
        return words;
      } catch (error) {
        console.error('Failed to fetch learning words:', error);
        return [];
      }
    },
    enabled: !!user && dailyGoal > 0
  });

  // Debug: Add logging to see what language is being used
  useEffect(() => {
    const userLanguage = user?.main_language?.language_code;
    // console.log('🌐 User language code:', userLanguage);
    // console.log('👤 User object:', user);
    
    // if (wordsToLearn && wordsToLearn.length > 0) {
    //   // console.log('📝 First word translation:', wordsToLearn[0]?.translation);
    //   console.log('🔤 All words:', wordsToLearn.map(w => ({ 
    //     kazakh: w.kazakh_word, 
    //     translation: w.translation 
    //   })));
    // }
  }, [user, wordsToLearn]);

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

  // useEffect(() => {
  //   if (wordsToLearn && wordsToLearn.length > 0) {
  //     console.log('📝 ВСЕ СЛОВА В СЕССИИ:');
  //     wordsToLearn.forEach((word, index) => {
  //       console.log(`${index + 1}. ID: ${word.id}, Казахский: "${word.kazakh_word}", Перевод: "${word.translation}"`);
  //     });
      
  //     // Проверяем наличие слова "ақ"
  //     const akWord = wordsToLearn.find(w => w.kazakh_word === 'ақ');
  //     if (akWord) {
  //       console.log('🎯 Найдено слово "ақ":', akWord);
  //       console.log('✅ Правильный перевод для "ақ":', akWord.translation);
  //     } else {
  //       console.log('❌ Слово "ақ" НЕ найдено в списке');
  //     }
      
  //     // Проверяем наличие слова "абысын"
  //     const abysynWord = wordsToLearn.find(w => w.kazakh_word === 'абысын');
  //     if (abysynWord) {
  //       console.log('🎯 Найдено слово "абысын":', abysynWord);
  //       console.log('✅ Правильный перевод для "абысын":', abysynWord.translation);
  //     }
  //   }
  // }, [wordsToLearn]);

  // Start Practice Session for current batch
  const startPracticeMutation = useMutation({
    mutationFn: async () => {
      const userLanguageCode = user?.main_language?.language_code || 'en';
      
      const response = await learningAPI.startPracticeSession({
        session_type: 'practice_batch',
        word_count: 3,
        category_id: undefined,
        difficulty_level_id: undefined,
        language_code: userLanguageCode // Ensure we pass the correct language
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
      if (!cycle.practiceSession) {
        throw new Error('No practice session active');
      }
      
      const responseTime = Date.now() - wordStartTime;
      
      console.log('🚀 Submitting practice answer:', {
        sessionId: cycle.practiceSession.session_id,
        wordId,
        wasCorrect,
        userAnswer,
        correctAnswer,
        responseTime
      });
      
      return learningAPI.submitPracticeAnswer(cycle.practiceSession.session_id, {
        word_id: wordId,
        was_correct: wasCorrect,
        user_answer: userAnswer,
        correct_answer: correctAnswer,
        response_time_ms: responseTime
      });
    },
    onSuccess: (response, variables) => {
      console.log('✅ Practice answer submitted successfully:', response);
      
      // Store the result
      setUserAnswers(prev => ({ 
        ...prev, 
        [`practice_${variables.wordId}`]: variables.wasCorrect 
      }));
      
      // ИСПРАВЛЕНИЕ: НЕ переходим к следующему слову автоматически
      // Пользователь сам нажмет "Next Word"
      console.log('⏳ Ожидаем нажатия кнопки "Next Word"');
    },
    onError: (error) => {
      console.error('❌ Failed to submit practice answer:', error);
      toast.error('Failed to submit answer. Please try again.');
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
        .slice(0, 2); // Take 2 wrong options

      // Add a generic wrong option if needed
      if (wrongOptions.length < 3) {
        const genericOptions = ['water', 'house', 'tree', 'book', 'person'];
        wrongOptions.push(genericOptions[index % genericOptions.length]);
      }

      // Create all options and shuffle
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
  const submitQuizAnswer = async (questionId: number, selectedIndex: number) => {
    console.log('\n🧠 === QUIZ ANSWER SUBMISSION DEBUG ===');
    console.log(`Question ID: ${questionId}`);
    console.log(`Selected index: ${selectedIndex}`);
    
    const question = cycle.quizQuestions?.find(q => q.id === questionId);
    if (!question) {
      console.error('❌ Question not found for ID:', questionId);
      return;
    }
  
    console.log('📝 Question details:');
    console.log('  Question:', question.question);
    console.log('  Options:', question.options);
    console.log('  Correct index:', question.correct_answer_index);
    console.log('  Selected option:', question.options[selectedIndex]);
    console.log('  Correct option:', question.options[question.correct_answer_index]);
  
    const isCorrect = selectedIndex === question.correct_answer_index;
    console.log(`✅ Answer is correct: ${isCorrect}`);
    
    // Обновляем состояние ответов
    const answerKey = `quiz_${questionId}`;
    console.log(`💾 Saving answer with key: ${answerKey} = ${isCorrect}`);
    
    // ✅ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Сохраняем результат и сразу используем его
    const newUserAnswers = { ...userAnswers, [answerKey]: isCorrect };
    
    setUserAnswers(newUserAnswers);
    console.log('📊 Updated userAnswers:', newUserAnswers);
    
    console.log(`✅ Quiz answer recorded locally: Word ${questionId} - ${isCorrect ? 'Correct' : 'Incorrect'}`);
  
    // Move to next question or finish quiz
    setTimeout(() => {
      console.log('⏭️ Moving to next question or finishing quiz...');
      console.log(`Current index: ${currentWordIndex}, Total questions: ${cycle.quizQuestions?.length}`);
      
      if (cycle.quizQuestions && currentWordIndex < cycle.quizQuestions.length - 1) {
        console.log('➡️ Moving to next question');
        setCurrentWordIndex(prev => prev + 1);
      } else {
        console.log('🏁 Finishing quiz, calling completeBatch with updated answers');
        // ✅ ПЕРЕДАЕМ ОБНОВЛЕННЫЕ ОТВЕТЫ НАПРЯМУЮ
        completeBatchWithAnswers(newUserAnswers);
      }
    }, 1000);
  };
  
  // ✅ НОВАЯ ФУНКЦИЯ: completeBatch с переданными ответами
  const completeBatchWithAnswers = async (finalUserAnswers: Record<string, boolean>) => {
    console.log('\n🎯 === FRONTEND BATCH COMPLETION DEBUG START ===');
    console.log('📊 Final userAnswers passed:', finalUserAnswers);
    console.log('📝 Current words:', cycle.currentWords.map(w => ({ id: w.id, kazakh_word: w.kazakh_word })));
  
    const practiceCorrect = cycle.currentWords.filter(word => 
      finalUserAnswers[`practice_${word.id}`] === true
    ).length;
    
    const quizCorrect = cycle.currentWords.filter(word => 
      finalUserAnswers[`quiz_${word.id}`] === true
    ).length;
  
    console.log(`📈 Practice correct: ${practiceCorrect}/3`);
    console.log(`🧠 Quiz correct: ${quizCorrect}/3`);
  
    // Подготавливаем данные для пакетного API
    const wordIds = cycle.currentWords.map(word => word.id);
    const practiceResults = cycle.currentWords.map(word => ({
      word_id: word.id,
      was_correct: finalUserAnswers[`practice_${word.id}`] === true
    }));
    const quizResults = cycle.currentWords.map(word => ({
      word_id: word.id,
      was_correct: finalUserAnswers[`quiz_${word.id}`] === true
    }));
  
    console.log('\n📝 === DETAILED WORD ANALYSIS ===');
    cycle.currentWords.forEach((word, index) => {
      const practiceKey = `practice_${word.id}`;
      const quizKey = `quiz_${word.id}`;
      const practiceAnswer = finalUserAnswers[practiceKey];
      const quizAnswer = finalUserAnswers[quizKey];
      
      console.log(`Word ${index + 1}: ${word.kazakh_word} (ID: ${word.id})`);
      console.log(`  Practice key: ${practiceKey} = ${practiceAnswer}`);
      console.log(`  Quiz key: ${quizKey} = ${quizAnswer}`);
      console.log(`  Practice correct: ${practiceAnswer === true}`);
      console.log(`  Quiz correct: ${quizAnswer === true}`);
      console.log(`  Both correct: ${practiceAnswer === true && quizAnswer === true}`);
    });
  
    console.log('\n📦 === SENDING TO API ===');
    console.log('Word IDs:', wordIds);
    console.log('Practice results:', practiceResults);
    console.log('Quiz results:', quizResults);
  
    // Проверим, что все результаты присутствуют
    const missingPractice = wordIds.filter(id => finalUserAnswers[`practice_${id}`] === undefined);
    const missingQuiz = wordIds.filter(id => finalUserAnswers[`quiz_${id}`] === undefined);
    
    if (missingPractice.length > 0) {
      console.warn('⚠️ Missing practice results for words:', missingPractice);
    }
    if (missingQuiz.length > 0) {
      console.warn('⚠️ Missing quiz results for words:', missingQuiz);
    }
  
    try {
      console.log('🚀 Calling completeLearningBatch API...');
      const batchResult = await learningModuleAPI.completeLearningBatch(
        wordIds,
        practiceResults,
        quizResults
      );
  
      console.log('✅ API Response:', batchResult);
  
      // Words that were learned according to the API response
      const wordsLearned = batchResult.summary.words_learned.map(w => w.kazakh_word);
      console.log('🎉 Words learned by API:', wordsLearned);
  
      const localBatchResult = {
        batchNumber: cycle.currentBatch,
        practiceCorrect,
        quizCorrect,
        wordsLearned
      };
  
      setCycle(prev => ({
        ...prev,
        batchResults: [...prev.batchResults, localBatchResult]
      }));
  
      // Show success message
      toast.success(`Batch ${cycle.currentBatch} complete! ${wordsLearned.length} words learned.`);
  
    } catch (error) {
      console.error('❌ Failed to complete batch:', error);
      console.error('Error details:', error);
      toast.error('Failed to save batch results. Please try again.');
      return;
    }
  
    console.log('🎯 === FRONTEND BATCH COMPLETION DEBUG END ===\n');
  
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
        console.log(`🎯 Starting Batch ${cycle.currentBatch + 1}`);
      } else {
        // Complete all learning
        setCycle(prev => ({ ...prev, phase: 'complete' }));
      }
    } else {
      // Complete all learning
      setCycle(prev => ({ ...prev, phase: 'complete' }));
    }
  };

  // Complete current batch
  const completeBatch = async () => {
    console.log('⚠️ completeBatch called - using current userAnswers state');
    return completeBatchWithAnswers(userAnswers);
  };

  const moveToNextWord = () => {
    if (currentWordIndex < cycle.currentWords.length - 1) {
      console.log(`📍 Moving to next word: ${currentWordIndex + 1}`);
      setCurrentWordIndex(prev => prev + 1);
      setWordStartTime(Date.now());
    } else {
      console.log('🎯 Practice phase complete, moving to quiz');
      finishPracticeAndStartQuiz();
    }
  };

  // Handle practice answer
  const handlePracticeAnswer = async (wordId: number, wasCorrect: boolean, userAnswer?: string, correctAnswer?: string) => {
    console.log('🎯 handlePracticeAnswer called:', { 
      wordId, 
      wasCorrect, 
      userAnswer, 
      correctAnswer,
      currentWord: cycle.currentWords[currentWordIndex]
    });
    
    const currentWord = cycle.currentWords[currentWordIndex];
    if (currentWord && currentWord.id === wordId) {
      console.log('✅ Word ID matches current word');
      console.log('📝 Current word data:', {
        id: currentWord.id,
        kazakh_word: currentWord.kazakh_word,
        translation: currentWord.translation,
        correctAnswerPassed: correctAnswer
      });
    }
    
    try {
      await submitPracticeAnswerMutation.mutateAsync({
        wordId,
        wasCorrect,
        userAnswer,
        correctAnswer: currentWord?.translation || correctAnswer
      });
      
      // НЕ ВЫЗЫВАЕМ moveToNextWord() здесь!
      // Пользователь сам нажмет кнопку Next Word
      
    } catch (error) {
      console.error('Error in handlePracticeAnswer:', error);
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
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Browse Words
        </button>
      </div>
    );
  }

  // Render different phases
  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Phase indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900"> 
            Learning Batch {cycle.currentBatch} of {cycle.totalBatches} 
          </h1>
          <div className="text-sm text-gray-500">
            {cycle.phase === 'overview' && 'Ready to learn 3 new words? Let\'s start with an overview!'}
            {cycle.phase === 'practice' && 'Practice Session'}
            {cycle.phase === 'quiz' && 'Quiz Time'}
            {cycle.phase === 'complete' && 'Batch Complete!'}
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ 
              width: `${((cycle.currentBatch - 1) / cycle.totalBatches + 
                        (cycle.phase === 'practice' ? 0.33 : 
                         cycle.phase === 'quiz' ? 0.66 : 
                         cycle.phase === 'complete' ? 1 : 0) / cycle.totalBatches) * 100}%` 
            }}
          />
        </div>
      </div>

      {/* Overview Phase */}
      {cycle.phase === 'overview' && (
        <OverviewPhase 
          words={cycle.currentWords} 
          onStart={() => startPracticeMutation.mutate()} 
        />
      )}

      {/* Practice Phase */}
      {cycle.phase === 'practice' && (
        <PracticePhase
          cycle={cycle}
          currentWordIndex={currentWordIndex}
          onAnswer={handlePracticeAnswer}
          onNextWord={moveToNextWord} // ДОБАВИТЬ ЭТО
        />
      )}

      {/* Quiz Phase */}
      {cycle.phase === 'quiz' && cycle.quizQuestions && (
        <QuizPhase
          questions={cycle.quizQuestions}
          currentQuestionIndex={currentWordIndex}
          onAnswer={submitQuizAnswer}
        />
      )}

      {/* Complete Phase */}
      {cycle.phase === 'complete' && (
        <CompletePhase
          results={cycle.batchResults}
          onContinue={cycle.currentBatch < cycle.totalBatches ? resetLearning : completeModule}
          isLastBatch={cycle.currentBatch >= cycle.totalBatches}
        />
      )}
    </div>
  );
};

// Overview Phase Component
const OverviewPhase: React.FC<{
  words: LearningWord[];
  onStart: () => void;
}> = ({ words, onStart }) => {
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
  const [fallbackLevels, setFallbackLevels] = useState<Record<number, number>>({});
  const { t } = useTranslation(['learning']);

  // ✅ ИСПРАВЛЕНИЕ: Сбрасываем состояние при смене списка слов
  useEffect(() => {
    setImageErrors({});
    setFallbackLevels({});
  }, [words]);

  // ✅ ИСПРАВЛЕННАЯ система fallback для изображений
  const getImageSources = (word: LearningWord): string[] => {
    const sources: string[] = [];
    
    // ✅ ИСПРАВЛЕНИЕ: Извлекаем primary_image из вложенной структуры
    const wordData: any = word;
    let primaryImage = word.primary_image || word.image_url;
    
    // Если данные приходят во вложенной структуре kazakh_word
    if (wordData.kazakh_word && typeof wordData.kazakh_word === 'object') {
      primaryImage = wordData.kazakh_word.primary_image || wordData.kazakh_word.image_url;
      // console.log(`🔍 Found nested kazakh_word.primary_image: ${primaryImage}`);
    }
    
    // ✅ ОТЛАДКА: Показываем ВСЕ поля слова
    // console.log(`🔍 DEBUG Word ${word.id} (${word.kazakh_word}) fields:`, {
    //   image_url: word.image_url,
    //   primary_image: word.primary_image,
    //   extracted_primary_image: primaryImage,
    //   category_name: word.category_name,
    //   nested_data: wordData.kazakh_word,
    //   allFields: Object.keys(word)
    // });
    
    // 1. ✅ ПРИОРИТЕТ: Извлеченный primary_image
    if (primaryImage) {
      sources.push(primaryImage);
      // console.log(`🔍 Adding extracted primary_image: ${primaryImage}`);
    }
    
    // 2. ✅ ПРИОРИТЕТ: image_url из API (основное поле)
    if (word.image_url && word.image_url !== primaryImage) {
      sources.push(word.image_url);
      // console.log(`🔍 Adding image_url: ${word.image_url}`);
    }
    
    // 3. ✅ ПРИОРИТЕТ: primary_image (дополнительное поле)
    if (word.primary_image && word.primary_image !== primaryImage && word.primary_image !== word.image_url) {
      sources.push(word.primary_image);
      // console.log(`🔍 Adding primary_image: ${word.primary_image}`);
    }
    
    // console.log(`🔍 Generated ${sources.length} image sources for word ${word.id} (${word.kazakh_word}):`, sources);
    return sources.filter(Boolean); // Remove null/undefined values
  };

  const getCurrentImageSource = (word: LearningWord): string | null => {
    if (imageErrors[word.id]) return null;
    
    const sources = getImageSources(word);
    const currentLevel = fallbackLevels[word.id] || 0;
    
    return currentLevel < sources.length ? sources[currentLevel] : null;
  };

  const handleImageError = (wordId: number) => {
    const word = words.find(w => w.id === wordId);
    if (!word) return;
    
    const sources = getImageSources(word);
    const currentLevel = fallbackLevels[wordId] || 0;
    
    console.log(`❌ Image error for word ${wordId} "${word.kazakh_word}", level ${currentLevel}/${sources.length - 1}`);
    console.log(`   Failed source: ${sources[currentLevel]}`);
    
    if (currentLevel < sources.length - 1) {
      setFallbackLevels(prev => ({ ...prev, [wordId]: currentLevel + 1 }));
      console.log(`   Trying next source: ${sources[currentLevel + 1]}`);
    } else {
      setImageErrors(prev => ({ ...prev, [wordId]: true }));
      console.log(`   All sources exhausted, showing placeholder icon`);
    }
  };

  // Audio player component for each word
  const WordAudioPlayer: React.FC<{ word: LearningWord }> = ({ word }) => {
    const { playAudio } = useAudioPlayer({ 
      wordId: word.id,
      word: {
        ...word,
        word_type_name: word.word_type_name || 'default'
      } as KazakhWordSummary
    });

    const handlePlayAudio = () => {
      playAudio();
    };

    return (
      <button
        onClick={handlePlayAudio}
        className="bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full p-3 shadow-lg transition-all duration-200 hover:scale-110"
        title={`Прослушать произношение: ${word.kazakh_word}`}
      >
        <SpeakerWaveIcon className="h-6 w-6 text-blue-600" />
      </button>
    );
  };

  const getDifficultyColor = (level: number): string => {
    const colors = {
      1: 'bg-green-100 text-green-800 border-green-200',
      2: 'bg-blue-100 text-blue-800 border-blue-200',
      3: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      4: 'bg-orange-100 text-orange-800 border-orange-200',
      5: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[level as keyof typeof colors] || colors[1];
  };

  // ✅ ОТЛАДОЧНАЯ ИНФОРМАЦИЯ
  // console.log('🔍 OverviewPhase words:', words.map(w => ({
  //   id: w.id,
  //   kazakh_word: w.kazakh_word,
  //   image_url: w.image_url,
  //   primary_image: w.primary_image,
  //   category_name: w.category_name
  // })));

  return (
    <div className="space-y-8">
      {/* Enhanced Visual Words Preview with Images */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t('overview.title')}
          </h2>
          <p className="text-gray-600">
            {t('overview.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {words.map((word, index) => {
            const imageSrc = getCurrentImageSource(word);
            
            // console.log(`🖼️ Word ${word.id} "${word.kazakh_word}":`, {
            //   imageSrc,
            //   fallbackLevel: fallbackLevels[word.id] || 0,
            //   hasError: imageErrors[word.id] || false,
            //   sources: getImageSources(word)
            // });
            
            return (
              <div 
                key={word.id} 
                className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
              >
                {/* Image Section */}
                <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200">
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt={`Изображение для слова: ${word.kazakh_word}`}
                      className="w-full h-full object-cover"
                      onError={() => handleImageError(word.id)}
                      // onLoad={() => console.log(`✅ Image loaded successfully for word ${word.id}: ${imageSrc}`)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PhotoIcon className="h-16 w-16 text-gray-400" />
                      <div className="absolute bottom-2 left-2 text-xs text-gray-500 bg-white bg-opacity-75 px-2 py-1 rounded">
                        No image
                      </div>
                    </div>
                  )}
                  
                  {/* Audio Button Overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center opacity-0 hover:opacity-100">
                    <WordAudioPlayer word={word} />
                  </div>

                  {/* Word Number Badge */}
                  <div className="absolute top-3 left-3">
                    <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                  </div>

                  {/* Difficulty Badge */}
                  <div className="absolute top-3 right-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getDifficultyColor(word.difficulty_level)}`}>
                      L{word.difficulty_level}
                    </span>
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-6">
                  {/* Main Word */}
                  <div className="text-center mb-4">
                    <h3 className="text-2xl font-bold text-gray-900 mb-1 kazakh-text">
                      {word.kazakh_word}
                    </h3>
                    {word.kazakh_cyrillic && (
                      <p className="text-lg text-gray-600 mb-2 cyrillic-text">
                        {word.kazakh_cyrillic}
                      </p>
                    )}
                    <p className="text-lg text-blue-600 font-medium">
                      {word.translation}
                    </p>
                  </div>

                  {/* Word Details */}
                  <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
                    <span className="bg-gray-100 px-2 py-1 rounded-full">
                      {word.category_name}
                    </span>
                    <span className="bg-gray-100 px-2 py-1 rounded-full">
                      {word.word_type_name}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Start Button */}
      <button
        onClick={onStart} 
        className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors flex items-center mx-auto mt-6 shadow-lg"
      >
        <PlayIcon className="h-6 w-6 mr-2" />
        {t('overview.startButton')} 
      </button>

      {/* Learning Process Overview */}
      <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
        <h3 className="text-xl font-semibold text-center mb-6 text-gray-900">
          {t('overview.process.title')}
        </h3>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="bg-blue-100 rounded-full p-3 w-12 h-12 mx-auto mb-3">
              <BookOpenIcon className="h-6 w-6 text-blue-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">{t('overview.process.study.title')}</h4>
            <p className="text-sm text-gray-600">{t('overview.process.study.description')}</p>
          </div>
          
          <div className="text-center">
            <div className="bg-green-100 rounded-full p-3 w-12 h-12 mx-auto mb-3">
              <PencilIcon className="h-6 w-6 text-green-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">{t('overview.process.practice.title')}</h4>
            <p className="text-sm text-gray-600">{t('overview.process.practice.description')}</p>
          </div>
          
          <div className="text-center">
            <div className="bg-purple-100 rounded-full p-3 w-12 h-12 mx-auto mb-3">
              <QuestionMarkCircleIcon className="h-6 w-6 text-purple-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">{t('overview.process.quiz.title')}</h4>
            <p className="text-sm text-gray-600">{t('overview.process.quiz.description')}</p>
          </div>
        </div>

        {/* Success Criteria */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
          <StarIcon className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
          <p className="text-sm text-yellow-800 font-medium">
            {t('overview.successCriteria')}
          </p>
        </div>

        {/* Study Tips */}
        <div className="mt-4 bg-white rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3 text-center">{t('overview.studyTips.title')}</h4>
          <div className="grid md:grid-cols-2 gap-3 text-sm text-gray-600">
            <div className="flex items-center">
              <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
              <span>{t('overview.studyTips.tip1')}</span>
            </div>
            <div className="flex items-center">
              <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
              <span>{t('overview.studyTips.tip2')}</span>
            </div>
            <div className="flex items-center">
              <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
              <span>{t('overview.studyTips.tip3')}</span>
            </div>
            <div className="flex items-center">
              <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
              <span>{t('overview.studyTips.tip4')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 1. Измените PracticePhase компонент:
const PracticePhase: React.FC<{
  cycle: LearningCycle;
  currentWordIndex: number;
  onAnswer: (wordId: number, wasCorrect: boolean, userAnswer?: string, correctAnswer?: string) => void;
  onNextWord: () => void; // ДОБАВИТЬ ЭТО
}> = ({ cycle, currentWordIndex, onAnswer, onNextWord }) => { // ДОБАВИТЬ onNextWord
  const [userInput, setUserInput] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useTranslation(['learning']);
  
  const [submittedWordData, setSubmittedWordData] = useState<{
    id: number;
    kazakh_word: string;
    translation: string;
    userAnswer: string;
    isCorrect: boolean;
  } | null>(null);

  const currentWord = cycle.currentWords[currentWordIndex];

  // Очищаем данные при смене слова
  useEffect(() => {
    if (!showResult) {
      setSubmittedWordData(null);
    }
  }, [currentWordIndex, showResult]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting || !userInput.trim() || !currentWord) return;
    setIsSubmitting(true);
    
    const userAnswerTrimmed = userInput.toLowerCase().trim();
    const correctAnswerTrimmed = currentWord.translation.toLowerCase().trim();
    const correct = userAnswerTrimmed === correctAnswerTrimmed;
    
    const wordDataToSubmit = {
      id: currentWord.id,
      kazakh_word: currentWord.kazakh_word,
      translation: currentWord.translation,
      userAnswer: userInput,
      isCorrect: correct
    };
    
    setSubmittedWordData(wordDataToSubmit);
    setIsCorrect(correct);
    setShowResult(true);
    
    // console.log('============ ОТПРАВКА ОТВЕТА ============');
    // console.log('📍 Индекс текущего слова:', currentWordIndex);
    // console.log('🆔 ID слова:', wordDataToSubmit.id);
    // console.log('🇰🇿 Казахское слово:', wordDataToSubmit.kazakh_word);
    // console.log('🇷🇺 Ожидаемый перевод:', wordDataToSubmit.translation);
    // console.log('👤 Ответ пользователя:', wordDataToSubmit.userAnswer);
    // console.log('✅ Правильно?', wordDataToSubmit.isCorrect);
    // console.log('==========================================');
    
    try {
      await onAnswer(
        wordDataToSubmit.id, 
        wordDataToSubmit.isCorrect, 
        wordDataToSubmit.userAnswer, 
        wordDataToSubmit.translation
      );
      
      // НЕ очищаем форму автоматически - ждем нажатия Next Word
      setIsSubmitting(false);
      
    } catch (error) {
      console.error('Error submitting answer:', error);
      setIsSubmitting(false);
      toast.error('Failed to submit answer');
    }
  };

  // ДОБАВИТЬ функцию для обработки Next Word:
  const handleNextWord = () => {
    // Очищаем состояние
    setUserInput('');
    setShowResult(false);
    setIsSubmitting(false);
    setSubmittedWordData(null);
    
    // Переходим к следующему слову
    onNextWord();
  };

  if (!currentWord) {
    return <div>Loading word...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="text-center mb-8">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-500 font-medium">{t('practice.title')}</span>
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
        {!showResult ? (
          <>
            {/* <div className="text-xs text-gray-400 mb-2">
              Debug: ID={currentWord.id}, Translation="{currentWord.translation}"
            </div> */}
            
            <h2 className="text-4xl font-bold text-gray-900 mb-3">
              {currentWord.kazakh_word}
            </h2>
            {currentWord.kazakh_cyrillic && (
              <p className="text-2xl text-gray-600 mb-4">{currentWord.kazakh_cyrillic}</p>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-lg font-medium text-gray-700 mb-3">
                  {t('practice.question', { word: currentWord.kazakh_word })}
                </label>
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}  
                  placeholder={t('practice.placeholder')}
                  className="w-full max-w-md mx-auto px-4 py-3 border border-gray-300 rounded-lg text-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting || !userInput.trim()}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Answer'}
              </button>
            </form>
          </>
        ) : (
          <div className="space-y-6">
            {submittedWordData && (
              <>
                <div className={`text-2xl font-bold ${submittedWordData.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                  {submittedWordData.isCorrect ? '✅ Correct!' : '❌ Not quite right'}
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-lg mb-2">
                    <span className="font-semibold text-gray-700">"{submittedWordData.kazakh_word}"</span> means{' '}
                    <span className="font-semibold text-blue-600">"{submittedWordData.translation}"</span>
                  </p>
                  {!submittedWordData.isCorrect && (
                    <p className="text-gray-600">
                      Your answer: <span className="font-medium">"{submittedWordData.userAnswer}"</span>
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    Result for Word ID: {submittedWordData.id} | Expected: "{submittedWordData.translation}"
                  </p>
                </div>

                <button
                  onClick={handleNextWord} // ИЗМЕНИТЬ НА handleNextWord
                  className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                >
                  {currentWordIndex < cycle.currentWords.length - 1 ? 'Next Word' : 'Continue to Quiz'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Quiz Phase Component
const QuizPhase: React.FC<{
  questions: QuizQuestion[];
  currentQuestionIndex: number;
  onAnswer: (questionId: number, selectedIndex: number) => void;
}> = ({ questions, currentQuestionIndex, onAnswer }) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];

  const handleOptionSelect = (optionIndex: number) => {
    if (showResult) return;
    
    const correct = optionIndex === currentQuestion.correct_answer_index;
    setSelectedOption(optionIndex);
    setIsCorrect(correct);
    setShowResult(true);

    // Submit answer and move to next question
    setTimeout(() => {
      onAnswer(currentQuestion.id, optionIndex);
      setSelectedOption(null);
      setShowResult(false);
    }, 1500);
  };

  if (!currentQuestion) return null;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="text-center mb-8">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-500 font-medium">Quiz Session</span>
          <span className="text-sm text-gray-500 font-medium">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
          <div 
            className="bg-purple-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-lg">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">
          {currentQuestion.question}
        </h2>
        
        <div className="text-center mb-8">
          <h3 className="text-4xl font-bold text-blue-600 mb-2">
            {currentQuestion.kazakh_word}
          </h3>
          {currentQuestion.kazakh_cyrillic && (
            <p className="text-2xl text-gray-600">{currentQuestion.kazakh_cyrillic}</p>
          )}
        </div>

        <div className="grid gap-4 max-w-2xl mx-auto">
          {currentQuestion.options.map((option, index) => {
            let buttonClass = "w-full p-4 text-left border-2 rounded-lg transition-all duration-200 hover:border-purple-300";
            
            if (showResult) {
              if (index === currentQuestion.correct_answer_index) {
                buttonClass += " border-green-500 bg-green-50 text-green-800";
              } else if (index === selectedOption && index !== currentQuestion.correct_answer_index) {
                buttonClass += " border-red-500 bg-red-50 text-red-800";
              } else {
                buttonClass += " border-gray-200 bg-gray-50 text-gray-500";
              }
            } else {
              buttonClass += " border-gray-200 hover:border-purple-300 hover:bg-purple-50";
            }

            return (
              <button
                key={index}
                onClick={() => handleOptionSelect(index)}
                disabled={showResult}
                className={buttonClass}
              >
                <span className="font-semibold mr-3">
                  {String.fromCharCode(65 + index)}.
                </span>
                {option}
              </button>
            );
          })}
        </div>

        {showResult && (
          <div className="mt-6">
            <div className={`text-xl font-bold ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
              {isCorrect ? '✅ Correct!' : '❌ Incorrect'}
            </div>
            {!isCorrect && (
              <p className="text-gray-600 mt-2">
                The correct answer is: <span className="font-semibold text-green-600">
                  {currentQuestion.correct_answer}
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Complete Phase Component
const CompletePhase: React.FC<{
  results: Array<{
    batchNumber: number;
    practiceCorrect: number;
    quizCorrect: number;
    wordsLearned: string[];
  }>;
  onContinue: () => void;
  isLastBatch: boolean;
}> = ({ results, onContinue, isLastBatch }) => {
  const totalWordsLearned = results.reduce((acc, batch) => acc + batch.wordsLearned.length, 0);
  const totalPracticeCorrect = results.reduce((acc, batch) => acc + batch.practiceCorrect, 0);
  const totalQuizCorrect = results.reduce((acc, batch) => acc + batch.quizCorrect, 0);
  const totalWords = results.length * 3;

  return (
    <div className="max-w-4xl mx-auto text-center">
      <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-8 border border-green-200 shadow-lg">
        <div className="mb-6">
          <TrophyIcon className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            🎉 {isLastBatch ? 'Learning Session Complete!' : 'Batch Complete!'}
          </h2>
          <p className="text-lg text-gray-600">
            {isLastBatch 
              ? 'Congratulations on completing your learning session!' 
              : 'Great job! Ready for the next batch?'}
          </p>
        </div>

        {/* Overall Statistics */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 border shadow-sm">
            <div className="text-3xl font-bold text-green-600 mb-2">{totalWordsLearned}</div>
            <div className="text-sm text-gray-600">Words Learned</div>
          </div>
          <div className="bg-white rounded-lg p-6 border shadow-sm">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {Math.round((totalPracticeCorrect / totalWords) * 100)}%
            </div>
            <div className="text-sm text-gray-600">Practice Accuracy</div>
          </div>
          <div className="bg-white rounded-lg p-6 border shadow-sm">
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {Math.round((totalQuizCorrect / totalWords) * 100)}%
            </div>
            <div className="text-sm text-gray-600">Quiz Accuracy</div>
          </div>
        </div>

        {/* Batch Results */}
        {results.length > 1 && (
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Batch Results</h3>
            <div className="space-y-3">
              {results.map((batch, index) => (
                <div key={index} className="bg-white rounded-lg p-4 border shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Batch {batch.batchNumber}</span>
                    <div className="flex space-x-4 text-sm">
                      <span className="text-green-600">
                        Practice: {batch.practiceCorrect}/3
                      </span>
                      <span className="text-purple-600">
                        Quiz: {batch.quizCorrect}/3
                      </span>
                      <span className="text-yellow-600">
                        Learned: {batch.wordsLearned.length}
                      </span>
                    </div>
                  </div>
                  {batch.wordsLearned.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      Learned words: {batch.wordsLearned.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Motivational message */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <StarIcon className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
          <p className="text-yellow-800 font-medium">
            {totalWordsLearned > 0 
              ? `Amazing! You've mastered ${totalWordsLearned} new word${totalWordsLearned > 1 ? 's' : ''} today!`
              : 'Keep practicing! Review the words and try again to master them.'}
          </p>
        </div>

        {/* Action button */}
        <button
          onClick={onContinue}
          className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors shadow-lg"
        >
          {isLastBatch ? (
            <>
              <CheckCircleIcon className="h-6 w-6 mr-2 inline" />
              Return to Dashboard
            </>
          ) : (
            <>
              <ArrowRightIcon className="h-6 w-6 mr-2 inline" />
              Continue to Next Batch
            </>
          )}
        </button>

        {/* Study again option */}
        <div className="mt-4">
          <button
            onClick={() => window.location.reload()}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
};

export default LearningModule;