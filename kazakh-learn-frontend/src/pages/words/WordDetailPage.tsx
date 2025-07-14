// src/pages/words/WordDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeftIcon,
  HeartIcon,
  SpeakerWaveIcon,
  ShareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  ChatBubbleLeftIcon,
  ClockIcon,
  CheckCircleIcon,
  HeartIcon as HeartSolidIcon
} from '@heroicons/react/24/outline';

import { wordsAPI, learningAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

// Types
interface SequentialNavigationContext {
  currentWordId: number;
  previousWordId: number | null;
  nextWordId: number | null;
  previousWord: any | null;
  nextWord: any | null;
  isLoadingPrevious: boolean;
  isLoadingNext: boolean;
}

interface NavigationInfo {
  hasPrevious: boolean;
  hasNext: boolean;
  previousWord: any | null;
  nextWord: any | null;
  currentWordId: number;
  previousWordId: number | null;
  nextWordId: number | null;
  contextLabel: string;
  isLoadingPrevious: boolean;
  isLoadingNext: boolean;
}

// Navigation Panel Component
const NavigationPanel: React.FC<{
  navigationInfo: NavigationInfo;
  wordId: number;
  navigateToPrevious: () => void;
  navigateToNext: () => void;
  onBackToWords: () => void;
  showShareButton: boolean;
}> = ({ navigationInfo, wordId, navigateToPrevious, navigateToNext, onBackToWords, showShareButton }) => {
  const { t } = useTranslation('wordDetail');

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          {/* Back Button */}
          <button
            onClick={onBackToWords}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            <span className="text-sm font-medium">{t('navigation.backToWords')}</span>
          </button>

          {/* Navigation Controls */}
          <div className="flex items-center space-x-4">
            {/* Previous Button */}
            <button
              onClick={navigateToPrevious}
              disabled={!navigationInfo.hasPrevious || navigationInfo.isLoadingPrevious}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                navigationInfo.hasPrevious && !navigationInfo.isLoadingPrevious
                  ? 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                  : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              <ChevronLeftIcon className="h-4 w-4" />
              <span className="text-sm">
                {navigationInfo.isLoadingPrevious ? 'Loading...' : t('navigation.previous')}
              </span>
            </button>

            {/* Current Word Info */}
            <div className="text-center">
              <div className="text-sm text-gray-500">Word #{wordId}</div>
              <div className="text-xs text-gray-400">{navigationInfo.contextLabel}</div>
            </div>

            {/* Next Button */}
            <button
              onClick={navigateToNext}
              disabled={!navigationInfo.hasNext || navigationInfo.isLoadingNext}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                navigationInfo.hasNext && !navigationInfo.isLoadingNext
                  ? 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                  : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              <span className="text-sm">
                {navigationInfo.isLoadingNext ? 'Loading...' : t('navigation.next')}
              </span>
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Share Button */}
          {showShareButton && (
            <button className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors">
              <ShareIcon className="h-5 w-5" />
              <span className="text-sm font-medium">{t('actions.shareWord')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Navigation Preview Component
const NavigationPreview: React.FC<{
  navigationInfo: NavigationInfo;
  navigateToPrevious: () => void;
  navigateToNext: () => void;
}> = ({ navigationInfo, navigateToPrevious, navigateToNext }) => {
  const { t } = useTranslation('wordDetail');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
      {/* Previous Word Preview */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {navigationInfo.previousWord ? (
          <button
            onClick={navigateToPrevious}
            disabled={navigationInfo.isLoadingPrevious}
            className={`w-full p-3 rounded-lg border border-gray-200 transition-all text-left ${
              navigationInfo.isLoadingPrevious 
                ? 'bg-gray-100 cursor-not-allowed' 
                : 'hover:border-gray-300 hover:bg-white cursor-pointer'
            }`}
          >
            <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
              {navigationInfo.isLoadingPrevious ? (
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
              ) : (
                <ChevronLeftIcon className="h-4 w-4" />
              )}
              <span>
                {navigationInfo.isLoadingPrevious ? 'Loading...' : t('navigation.previous')}
              </span>
            </div>
            <div className="font-semibold text-gray-900">
              {navigationInfo.previousWord.kazakh_word}
            </div>
            <div className="text-sm text-gray-600">
              {navigationInfo.previousWord.translations?.[0]?.translation}
            </div>
          </button>
        ) : (
          <div className="p-3 text-center text-gray-400">
            <div className="text-sm">{t('navigation.noPrevious')}</div>
          </div>
        )}
      </div>

      {/* Next Word Preview */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {navigationInfo.nextWord ? (
          <button
            onClick={navigateToNext}
            disabled={navigationInfo.isLoadingNext}
            className={`w-full p-3 rounded-lg border border-gray-200 transition-all text-right ${
              navigationInfo.isLoadingNext 
                ? 'bg-gray-100 cursor-not-allowed' 
                : 'hover:border-gray-300 hover:bg-white cursor-pointer'
            }`}
          >
            <div className="flex items-center justify-end space-x-2 text-sm text-gray-500 mb-1">
              <span>
                {navigationInfo.isLoadingNext ? 'Loading...' : t('navigation.next')}
              </span>
              {navigationInfo.isLoadingNext ? (
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
            </div>
            <div className="font-semibold text-gray-900">
              {navigationInfo.nextWord.kazakh_word}
            </div>
            <div className="text-sm text-gray-600">
              {navigationInfo.nextWord.translations?.[0]?.translation}
            </div>
          </button>
        ) : (
          <div className="p-3 text-center text-gray-400">
            <div className="text-sm">{t('navigation.noNext')}</div>
          </div>
        )}
      </div>
    </div>
  );
};

const WordDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation('wordDetail');
  const queryClient = useQueryClient();
  const wordId = parseInt(id || '0');

  // Component state
  const [activeTab, setActiveTab] = useState<'overview' | 'examples' | 'progress'>('overview');
  const [notes, setNotes] = useState('');
  const [navigationContext, setNavigationContext] = useState<SequentialNavigationContext | null>(null);

  // API Queries
  const { data: word, isLoading: wordLoading, error: wordError } = useQuery({
    queryKey: ['word', wordId, user?.main_language?.language_code],
    queryFn: () => wordsAPI.getWord(wordId, user?.main_language?.language_code),
    enabled: !!wordId,
  });

  const { data: progress } = useQuery({
    queryKey: ['word-progress', wordId],
    queryFn: async () => {
      const allProgress = await learningAPI.getProgress();
      return allProgress.find(p => p.kazakh_word_id === wordId);
    },
    enabled: !!wordId,
  });

  // Load adjacent words for sequential navigation
  const { data: previousWord, isLoading: isLoadingPrevious } = useQuery({
    queryKey: ['word', wordId - 1, user?.main_language?.language_code],
    queryFn: async () => {
      try {
        console.log(`🔍 Loading previous word: ${wordId - 1}`);
        return await wordsAPI.getWord(wordId - 1, user?.main_language?.language_code);
      } catch (error) {
        console.log(`❌ Previous word ${wordId - 1} not found`);
        return null;
      }
    },
    enabled: !!wordId && wordId > 1,
    retry: false,
  });

  const { data: nextWord, isLoading: isLoadingNext } = useQuery({
    queryKey: ['word', wordId + 1, user?.main_language?.language_code],
    queryFn: async () => {
      try {
        console.log(`🔍 Loading next word: ${wordId + 1}`);
        return await wordsAPI.getWord(wordId + 1, user?.main_language?.language_code);
      } catch (error) {
        console.log(`❌ Next word ${wordId + 1} not found`);
        return null;
      }
    },
    enabled: !!wordId,
    retry: false,
  });

  // Use the audio player hook
  const { wordSounds, playAudio, playIndividualSound, hasAudio } = useAudioPlayer({
    wordId,
    word
  });

  // Update navigation context when adjacent words load
  useEffect(() => {
    if (wordId) {
      console.log('🚀 Setting up sequential navigation context');
      const context: SequentialNavigationContext = {
        currentWordId: wordId,
        previousWordId: wordId > 1 ? wordId - 1 : null,
        nextWordId: wordId + 1,
        previousWord: previousWord || null,
        nextWord: nextWord || null,
        isLoadingPrevious,
        isLoadingNext,
      };
      
      setNavigationContext(context);
      console.log('✅ Navigation context updated:', {
        current: wordId,
        previous: context.previousWordId,
        next: context.nextWordId,
        hasPrevious: !!previousWord,
        hasNext: !!nextWord
      });
    }
  }, [wordId, previousWord, nextWord, isLoadingPrevious, isLoadingNext]);

  // =============================================
  // AUTO-UPDATE WORD STATUS TO LEARNING
  // =============================================
  
  // Auto-update word status to "learning" when opening detail page
  useEffect(() => {
    // Only proceed if we have both word data and user is authenticated
    if (!word || !user || !wordId) {
      return;
    }

    console.log('🔍 Checking if word needs auto-status update:', {
      wordId,
      hasProgress: !!progress,
      currentStatus: progress?.status
    });

    // Check if word is not in learning list, or if it's in learning list but not finished
    const shouldAutoUpdate = !progress || (
      progress && 
      progress.status !== 'learned' && 
      progress.status !== 'mastered' && 
      progress.status !== 'review'
    );

    if (shouldAutoUpdate) {
      console.log('✅ Auto-updating word status to learning');
      
      // If word is not in learning list at all, add it with "learning" status
      if (!progress) {
        // Use a silent mutation that doesn't show success toast for auto-updates
        learningAPI.addWordToLearning([wordId], 'learning')
          .then(() => {
            console.log('✅ Word automatically added to learning list');
            // Silently invalidate queries to update UI
            queryClient.invalidateQueries({ queryKey: ['word-progress', wordId] });
            queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
          })
          .catch((error) => {
            console.error('❌ Failed to auto-add word to learning:', error);
          });
      } 
      // If word is in learning list but status is "want_to_learn", update to "learning"
      else if (progress.status === 'want_to_learn') {
        learningAPI.updateWordProgress(wordId, { status: 'learning' })
          .then(() => {
            console.log('✅ Word status automatically updated to learning');
            // Silently invalidate queries to update UI
            queryClient.invalidateQueries({ queryKey: ['word-progress', wordId] });
            queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
          })
          .catch((error) => {
            console.error('❌ Failed to auto-update word status:', error);
          });
      }
    } else {
      console.log('ℹ️ Word status update not needed:', progress?.status);
    }
  }, [word, progress, user, wordId, queryClient]);

  // =============================================
  // MUTATIONS
  // =============================================

  // Updated addToLearningMutation to support custom status
  const addToLearningMutation = useMutation({
    mutationFn: ({ wordIds, status }: { wordIds: number[], status?: string }) => 
      learningAPI.addWordToLearning(wordIds, status || 'learning'), // Default to 'learning' instead of 'want_to_learn'
    onSuccess: () => {
      toast.success(t('messages.addedToLearning'));
      queryClient.invalidateQueries({ queryKey: ['word-progress', wordId] });
      queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
    },
    onError: () => toast.error(t('messages.addToLearningError')),
  });

  const removeFromLearningMutation = useMutation({
    mutationFn: (wordIds: number[]) => learningAPI.removeWordFromLearning(wordIds),
    onSuccess: () => {
      toast.success(t('messages.removedFromLearning'));
      queryClient.invalidateQueries({ queryKey: ['word-progress', wordId] });
      queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
    },
    onError: () => toast.error(t('messages.removeFromLearningError')),
  });

  const updateProgressMutation = useMutation({
    mutationFn: (data: any) => learningAPI.updateWordProgress(wordId, data),
    onSuccess: () => {
      toast.success(t('messages.progressUpdated'));
      queryClient.invalidateQueries({ queryKey: ['word-progress', wordId] });
    },
    onError: () => toast.error(t('messages.progressUpdateError')),
  });

  // =============================================
  // EVENT HANDLERS
  // =============================================

  // Navigation handlers
  const navigateToPrevious = () => {
    if (navigationContext?.previousWordId) {
      navigate(`/app/words/${navigationContext.previousWordId}`);
    }
  };

  const navigateToNext = () => {
    if (navigationContext?.nextWordId) {
      navigate(`/app/words/${navigationContext.nextWordId}`);
    }
  };

  // Updated handleToggleLearning function
  const handleToggleLearning = () => {
    if (progress) {
      removeFromLearningMutation.mutate([wordId]);
    } else {
      // For manual addition, pass wordIds and status as object properties
      addToLearningMutation.mutate({ wordIds: [wordId], status: 'learning' });
    }
  };

  const handlePlayAudio = () => {
    playAudio(t('messages.audioPlayed'), t('messages.audioNotAvailable'));
  };

  const handleMarkAsLearned = () => {
    updateProgressMutation.mutate({ status: 'learned' });
  };

  const handleUpdateDifficulty = (difficulty: string) => {
    updateProgressMutation.mutate({ difficulty_rating: difficulty });
  };

  const handleUpdateNotes = () => {
    updateProgressMutation.mutate({ user_notes: notes });
  };

  // =============================================
  // HELPER FUNCTIONS
  // =============================================

  const getNavigationInfo = (): NavigationInfo => {
    if (!navigationContext) {
      return {
        hasPrevious: false,
        hasNext: false,
        previousWord: null,
        nextWord: null,
        currentWordId: wordId,
        previousWordId: null,
        nextWordId: null,
        contextLabel: t('navigation.context.browse'),
        isLoadingPrevious: false,
        isLoadingNext: false,
      };
    }

    const hasPrevious = !navigationContext.isLoadingPrevious && 
                       !navigationContext.previousWordId && !!navigationContext.previousWord;
    const hasNext = !!navigationContext.nextWord;

    return {
      hasPrevious,
      hasNext: !isLoadingNext,
      previousWord: navigationContext.previousWord,
      nextWord: navigationContext.nextWord,
      currentWordId: navigationContext.currentWordId,
      previousWordId: navigationContext.previousWordId,
      nextWordId: navigationContext.nextWordId,
      contextLabel: t('navigation.context.browse'),
      isLoadingPrevious: navigationContext.isLoadingPrevious,
      isLoadingNext: navigationContext.isLoadingNext,
    };
  };

  const getStatusColor = (status: string) => {
    const colors = {
      'want_to_learn': 'bg-gray-100 text-gray-800',
      'learning': 'bg-blue-100 text-blue-800',
      'learned': 'bg-green-100 text-green-800',
      'mastered': 'bg-purple-100 text-purple-800',
      'review': 'bg-orange-100 text-orange-800'
    };
    return colors[status as keyof typeof colors] || colors['want_to_learn'];
  };

  const getStatusLabel = (status?: string) => {
    const statusLabels: Record<string, string> = {
      'want_to_learn': t('status.wantToLearn'),
      'learning': t('status.learning'),
      'learned': t('status.learned'),
      'mastered': t('status.mastered'),
      'review': t('status.review')
    };
    return statusLabels[status || 'want_to_learn'] || status;
  };

  const getDifficultyLabel = (difficulty: string) => {
    const difficultyLabels: Record<string, string> = {
      'very_easy': t('difficulty.veryEasy'),
      'easy': t('difficulty.easy'),
      'medium': t('difficulty.medium'),
      'hard': t('difficulty.hard'),
      'very_hard': t('difficulty.veryHard')
    };
    return difficultyLabels[difficulty] || difficulty;
  };

  // Get navigation info for components
  const navigationInfo = getNavigationInfo();

  // =============================================
  // RENDER STATES
  // =============================================

  // Loading state
  if (wordLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <NavigationPanel
          navigationInfo={navigationInfo}
          wordId={wordId}
          navigateToPrevious={navigateToPrevious}
          navigateToNext={navigateToNext}
          onBackToWords={() => navigate('/app/words')}
          showShareButton={false}
        />
        
        <div className="text-center text-xs text-gray-500">
          Use ← → arrow keys to navigate by word ID • Current: {wordId}
        </div>

        <LoadingSpinner fullScreen text={t('loading.wordDetails')} />
      </div>
    );
  }

  // Error state
  if (wordError || !word) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <NavigationPanel
          navigationInfo={navigationInfo}
          wordId={wordId}
          navigateToPrevious={navigateToPrevious}
          navigateToNext={navigateToNext}
          onBackToWords={() => navigate('/app/words')}
          showShareButton={false}
        />

        <div className="text-center py-12">
          <div className="text-6xl mb-4">😞</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t('errors.wordNotFound')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('errors.wordNotFoundDescription')}
          </p>
          <button
            onClick={() => navigate('/app/words')}
            className="btn-primary"
          >
            {t('actions.browseWords')}
          </button>
        </div>
      </div>
    );
  }

  // =============================================
  // MAIN RENDER
  // =============================================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Panel */}
      <NavigationPanel
        navigationInfo={navigationInfo}
        wordId={wordId}
        navigateToPrevious={navigateToPrevious}
        navigateToNext={navigateToNext}
        onBackToWords={() => navigate('/app/words')}
        showShareButton={true}
      />

      {/* Sequential Keyboard Hint */}
      <div className="text-center text-xs text-gray-500 py-2">
        {t('navigation.keyboardHint')} • Current: {wordId}
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Word Header Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
          {/* Word Title Section */}
          <div className="px-8 py-6 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {word.kazakh_word}
                  {word.kazakh_cyrillic && (
                    <span className="ml-3 text-2xl text-gray-600">
                      ({word.kazakh_cyrillic})
                    </span>
                  )}
                </h1>
                <p className="text-xl text-gray-700 mb-4">
                  {word.translations?.[0]?.translation}
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="badge badge-blue">
                    {word.category.translations?.[0]?.translated_name || word.category.category_name}
                  </span>
                  <span className="badge badge-gray">
                    {word.word_type.translations?.[0]?.translated_name || word.word_type.type_name}
                  </span>
                  {progress && (
                    <span className={`badge ${getStatusColor(progress.status)}`}>
                      {getStatusLabel(progress.status)}
                    </span>
                  )}
                </div>
              </div>

              {/* Audio Button */}
              {hasAudio && (
                <button
                  onClick={handlePlayAudio}
                  className="flex items-center justify-center w-16 h-16 bg-blue-100 hover:bg-blue-200 rounded-full transition-colors"
                >
                  <SpeakerWaveIcon className="h-8 w-8 text-blue-600" />
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-8 py-4 bg-white border-b border-gray-200">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleToggleLearning}
                disabled={addToLearningMutation.isPending || removeFromLearningMutation.isPending}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  progress
                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                {progress ? (
                  <HeartSolidIcon className="h-5 w-5" />
                ) : (
                  <HeartIcon className="h-5 w-5" />
                )}
                <span>
                  {progress ? t('actions.removeFromLearning') : t('actions.addToLearning')}
                </span>
              </button>

              {progress && (
                <button
                  onClick={handleMarkAsLearned}
                  disabled={updateProgressMutation.isPending}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors"
                >
                  <CheckCircleIcon className="h-5 w-5" />
                  <span>{t('actions.markAsLearned')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-8">
              {[
                { id: 'overview', name: t('tabs.overview'), icon: EyeIcon },
                { id: 'examples', name: t('tabs.examples'), icon: ChatBubbleLeftIcon },
                { id: 'progress', name: t('tabs.myProgress'), icon: ClockIcon }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-8">
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Word Details */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {t('overview.wordDetails')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">{t('overview.category')}</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {word.category.translations?.[0]?.translated_name || word.category.category_name}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">{t('overview.wordType')}</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {word.word_type.translations?.[0]?.translated_name || word.word_type.type_name}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">{t('overview.difficultyLevel')}</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {t('overview.levelInfo', {
                          level: word.difficulty_level.level_number,
                          name: word.difficulty_level.translations?.[0]?.translated_name || word.difficulty_level.level_name
                        })}
                      </dd>
                    </div>
                  </div>
                </div>

                {/* All Translations */}
                {word.translations && word.translations.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {t('overview.allTranslations')}
                    </h3>
                    <div className="space-y-2">
                      {word.translations.map((translation: any, index: number) => (
                        <div key={index} className="flex items-center space-x-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {translation.language?.language_code || 'en'}
                          </span>
                          <span className="text-gray-900">{translation.translation}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pronunciations */}
                {word.pronunciations && word.pronunciations.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {t('overview.pronunciations')}
                    </h3>
                    <div className="space-y-2">
                      {word.pronunciations.map((pronunciation: any, index: number) => (
                        <div key={index} className="flex items-center space-x-3">
                          <button
                            onClick={() => playIndividualSound(pronunciation.audio_url)}
                            className="flex items-center space-x-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            <SpeakerWaveIcon className="h-4 w-4" />
                            <span className="text-sm">{pronunciation.pronunciation_text}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Images */}
                {word.images && word.images.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {t('overview.images')}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {word.images.map((image: any, index: number) => (
                        <div key={index} className="relative">
                          <img
                            src={image.image_url}
                            alt={word.kazakh_word}
                            className="w-full h-32 object-cover rounded-lg border border-gray-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/images/placeholder.jpg';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'examples' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('examples.title')}
                </h3>
                
                {word.example_sentences && word.example_sentences.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      {t('examples.count', { count: word.example_sentences.length })}
                    </p>
                    
                    {word.example_sentences.map((example: any, index: number) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4">
                        <div className="mb-3">
                          <h4 className="text-sm font-medium text-gray-500 mb-1">
                            {t('examples.context')}
                          </h4>
                          <p className="text-gray-900">{example.example_sentence}</p>
                        </div>
                        
                        {example.translations && example.translations.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-500 mb-1">
                              {t('examples.otherTranslations')}
                            </h4>
                            <div className="space-y-1">
                              {example.translations.map((translation: any, tIndex: number) => (
                                <div key={tIndex} className="flex items-center space-x-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                    {translation.language_code}
                                  </span>
                                  <span className="text-gray-700">{translation.translated_sentence}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {t('examples.noExamples')}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'progress' && (
              <div className="space-y-6">
                {progress ? (
                  <>
                    {/* Progress Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="text-sm font-medium text-blue-600">Times Seen</div>
                        <div className="text-2xl font-bold text-blue-900">{progress.times_seen}</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <div className="text-sm font-medium text-green-600">Times Correct</div>
                        <div className="text-2xl font-bold text-green-900">{progress.times_correct}</div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4">
                        <div className="text-sm font-medium text-red-600">Times Incorrect</div>
                        <div className="text-2xl font-bold text-red-900">{progress.times_incorrect}</div>
                      </div>
                    </div>

                    {/* Learning Status */}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">Learning Status</h4>
                      <div className="flex items-center space-x-4">
                        <span className={`badge ${getStatusColor(progress.status)}`}>
                          {getStatusLabel(progress.status)}
                        </span>
                        {progress.added_at && (
                          <span className="text-sm text-gray-500">
                            Added {new Date(progress.added_at).toLocaleDateString()}
                          </span>
                        )}
                        {progress.last_practiced_at && (
                          <span className="text-sm text-gray-500">
                            Last practiced {new Date(progress.last_practiced_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Difficulty Rating */}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">Rate Difficulty</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        How difficult is this word for you? This helps improve the learning algorithm.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 'very_easy', label: t('difficulty.veryEasy'), color: 'bg-green-100 text-green-800' },
                          { value: 'easy', label: t('difficulty.easy'), color: 'bg-blue-100 text-blue-800' },
                          { value: 'medium', label: t('difficulty.medium'), color: 'bg-yellow-100 text-yellow-800' },
                          { value: 'hard', label: t('difficulty.hard'), color: 'bg-orange-100 text-orange-800' },
                          { value: 'very_hard', label: t('difficulty.veryHard'), color: 'bg-red-100 text-red-800' }
                        ].map((rating) => (
                          <button
                            key={rating.value}
                            onClick={() => handleUpdateDifficulty(rating.value)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              progress.difficulty_rating === rating.value
                                ? rating.color + ' ring-2 ring-offset-2 ring-blue-500'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {rating.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Personal Notes */}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">Personal Notes</h4>
                      <div className="space-y-3">
                        <textarea
                          value={notes || progress.user_notes || ''}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Add your personal notes about this word..."
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 resize-none"
                          rows={4}
                        />
                        <button
                          onClick={handleUpdateNotes}
                          disabled={updateProgressMutation.isPending}
                          className="btn-primary"
                        >
                          {updateProgressMutation.isPending ? 'Saving...' : t('actions.saveNotes')}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <ClockIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Not Tracking Progress</h4>
                    <p className="text-gray-500 mb-4">
                      Add this word to your learning list to track your progress.
                    </p>
                    <button
                      onClick={() => addToLearningMutation.mutate({ wordIds: [wordId], status: 'learning' })}
                      disabled={addToLearningMutation.isPending}
                      className="btn-primary"
                    >
                      {addToLearningMutation.isPending ? 'Adding...' : t('actions.addToLearningList')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sequential Navigation Preview Cards */}
        <NavigationPreview
          navigationInfo={navigationInfo}
          navigateToPrevious={navigateToPrevious}
          navigateToNext={navigateToNext}
        />
      </div>
    </div>
  );
};

export default WordDetailPage;