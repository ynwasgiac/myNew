// src/pages/words/WordDetailPage.tsx - Updated to use useAudioPlayer hook
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SpeakerWaveIcon,
  HeartIcon,
  BookmarkIcon,
  ShareIcon,
  PhotoIcon,
  ChatBubbleLeftIcon,
  ClockIcon,
  CheckCircleIcon,
  EyeIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';
import { 
  HeartIcon as HeartSolidIcon, 
  BookmarkIcon as BookmarkSolidIcon 
} from '@heroicons/react/24/solid';
import { toast } from 'sonner';

import { wordsAPI, learningAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import type { KazakhWord, UserWordProgress, WordFilters, KazakhWordSummary, WordSound } from '../../types/api';

import LoadingSpinner from '../../components/ui/LoadingSpinner';

// Navigation context interface
interface NavigationContext {
  words: KazakhWordSummary[];
  currentIndex: number;
  totalCount: number;
  filters?: WordFilters;
  searchTerm?: string;
  source?: 'browse' | 'search' | 'category' | 'learning';
}

// Smart Image Display Component with Fallback System
interface WordImageDisplayProps {
  word: KazakhWord;
  className?: string;
  showAllImages?: boolean;
}

const WordImageDisplay: React.FC<WordImageDisplayProps> = ({ 
  word, 
  className = "w-48 h-32",
  showAllImages = false 
}) => {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [fallbackLevels, setFallbackLevels] = useState<Record<string, number>>({});

  // Generate all possible image sources for fallback system
  const getImageSources = (imageKey: string, originalPath?: string): string[] => {
    const sources = [];
    
    // 1. Original database image
    if (originalPath) {
      sources.push(originalPath);
    }
    
    // 2. Expected category path
    const safeWordName = word.kazakh_word.replace(/\s+/g, '_').toLowerCase();
    sources.push(`/images/words/categories/${word.category.category_name.toLowerCase()}/${safeWordName}.jpg`);
    
    // 3. Category-specific placeholder
    const categoryPlaceholders: Record<string, string> = {
      'animals': '/images/words/placeholders/animals.png',
      'food': '/images/words/placeholders/food.png',
      'colors': '/images/words/placeholders/colors.png',
      'family': '/images/words/placeholders/family.png',
      'body': '/images/words/placeholders/body.png',
      'nature': '/images/words/placeholders/nature.png',
      'objects': '/images/words/placeholders/objects.png',
      'actions': '/images/words/placeholders/actions.png'
    };
    
    sources.push(
      categoryPlaceholders[word.category.category_name.toLowerCase()] || 
      '/images/words/placeholders/default.png'
    );
    
    // 4. Default placeholder
    sources.push('/images/words/placeholders/default.png');
    
    return sources;
  };

  // Get current image source based on fallback level
  const getCurrentImageSource = (imageKey: string, originalPath?: string): string | null => {
    if (imageErrors[imageKey]) return null;
    
    const sources = getImageSources(imageKey, originalPath);
    const currentLevel = fallbackLevels[imageKey] || 0;
    
    return currentLevel < sources.length ? sources[currentLevel] : null;
  };

  // Handle image error - advance to next fallback level
  const handleImageError = (imageKey: string) => {
    const sources = getImageSources(imageKey);
    const currentLevel = fallbackLevels[imageKey] || 0;
    
    if (currentLevel < sources.length - 1) {
      setFallbackLevels(prev => ({ ...prev, [imageKey]: currentLevel + 1 }));
    } else {
      setImageErrors(prev => ({ ...prev, [imageKey]: true }));
    }
  };

  // Show all images in grid layout
  if (showAllImages && word.images && word.images.length > 0) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {word.images.slice(0, 4).map((image) => {
          const imageKey = `multi-${image.id}`;
          const imageSrc = getCurrentImageSource(imageKey, image.image_url);
          
          return (
            <div
              key={image.id}
              className="aspect-square rounded-lg overflow-hidden bg-gray-100 relative flex items-center justify-center"
            >
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={image.alt_text || word.kazakh_word}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                  onError={() => handleImageError(imageKey)}
                />
              ) : (
                <PhotoIcon className="h-8 w-8 text-gray-400" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Show single primary image
  const primaryImage = word.images?.find(img => img.is_primary) || word.images?.[0];
  const imageKey = 'primary';
  const imageSrc = getCurrentImageSource(imageKey, primaryImage?.image_url);

  return (
    <div className={`${className} rounded-lg overflow-hidden bg-white/50 backdrop-blur-sm border border-white/20 shadow-sm flex items-center justify-center`}>
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={`${word.kazakh_word} visual`}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
          onError={() => handleImageError(imageKey)}
        />
      ) : (
        <PhotoIcon className="h-8 w-8 text-gray-400" />
      )}
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
  const [navigationContext, setNavigationContext] = useState<NavigationContext | null>(null);
  const [isLoadingNavigation, setIsLoadingNavigation] = useState(false);

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

  // Use the audio player hook
  const { wordSounds, playAudio, playIndividualSound, hasAudio } = useAudioPlayer({
    wordId,
    word
  });

  // Initialize navigation context from URL state or parameters
  useEffect(() => {
    const state = location.state as any;
    const urlParams = new URLSearchParams(location.search);
    
    if (state?.navigationContext) {
      setNavigationContext(state.navigationContext);
    } else {
      // Build context from URL parameters
      const filters: WordFilters = {
        language_code: user?.main_language?.language_code || 'en',
        page_size: 100,  // ✅ Use page_size instead of limit
        page: 1          // ✅ Use page instead of skip
      };
      // OR if you want to get all words without pagination:
      // const filters: WordFilters = {
      //   language_code: user?.main_language?.language_code || 'en',
      //   page_size: 50,   // Maximum allowed per page
      //   page: 1
      // };

      const categoryId = urlParams.get('category');
      const wordTypeId = urlParams.get('wordType');
      const difficultyId = urlParams.get('difficulty');
      const searchTerm = urlParams.get('search');

      if (categoryId) filters.category_id = parseInt(categoryId);
      if (wordTypeId) filters.word_type_id = parseInt(wordTypeId);
      if (difficultyId) filters.difficulty_level_id = parseInt(difficultyId);

      if (searchTerm || Object.keys(filters).length > 2) {
        loadNavigationContext(filters, searchTerm || undefined);
      }
    }
  }, [location, user?.main_language?.language_code, wordId]);

  // Load navigation context for prev/next functionality
  const loadNavigationContext = async (filters: WordFilters, searchTerm?: string) => {
    setIsLoadingNavigation(true);
    try {
      let words: KazakhWordSummary[];
      let source: NavigationContext['source'] = 'browse';

      if (searchTerm) {
        words = await wordsAPI.searchWords(searchTerm, filters.language_code, 100);
        source = 'search';
      } else if (filters.category_id) {
        words = await wordsAPI.getWordsByCategory(
          filters.category_id,
          filters.language_code,
          0,
          100
        );
        source = 'category';
      } else {
        words = await wordsAPI.getWords({ ...filters, limit: 100 });
        source = 'browse';
      }

      const currentIndex = words.findIndex(w => w.id === wordId);
      
      if (currentIndex !== -1) {
        setNavigationContext({
          words,
          currentIndex,
          totalCount: words.length,
          filters,
          searchTerm,
          source
        });
      }
    } catch (error) {
      console.error('Failed to load navigation context:', error);
    } finally {
      setIsLoadingNavigation(false);
    }
  };

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!navigationContext) return;
      
      // Ignore if user is typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft' && navigationContext.currentIndex > 0) {
        navigateToWord(navigationContext.words[navigationContext.currentIndex - 1].id);
      } else if (e.key === 'ArrowRight' && navigationContext.currentIndex < navigationContext.words.length - 1) {
        navigateToWord(navigationContext.words[navigationContext.currentIndex + 1].id);
      } else if (e.key === 'Escape') {
        navigate('/app/words');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigationContext, navigate]);

  // Navigate to another word while preserving context
  const navigateToWord = (newWordId: number) => {
    if (!navigationContext) return;

    const urlParams = new URLSearchParams();
    
    if (navigationContext.searchTerm) {
      urlParams.set('search', navigationContext.searchTerm);
    }
    if (navigationContext.filters?.category_id) {
      urlParams.set('category', navigationContext.filters.category_id.toString());
    }
    if (navigationContext.filters?.word_type_id) {
      urlParams.set('wordType', navigationContext.filters.word_type_id.toString());
    }
    if (navigationContext.filters?.difficulty_level_id) {
      urlParams.set('difficulty', navigationContext.filters.difficulty_level_id.toString());
    }

    const queryString = urlParams.toString();
    const url = `/app/words/${newWordId}${queryString ? `?${queryString}` : ''}`;

    const newIndex = navigationContext.words.findIndex(w => w.id === newWordId);
    const updatedContext = {
      ...navigationContext,
      currentIndex: newIndex
    };

    navigate(url, { 
      state: { navigationContext: updatedContext },
      replace: false 
    });
  };

  // Get navigation information for UI
  const getNavigationInfo = () => {
    if (!navigationContext) return null;

    const { words, currentIndex, source, searchTerm } = navigationContext;
    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex < words.length - 1;
    const previousWord = hasPrevious ? words[currentIndex - 1] : null;
    const nextWord = hasNext ? words[currentIndex + 1] : null;

    let contextLabel = '';
    switch (source) {
      case 'search':
        contextLabel = t('navigation.context.search', { searchTerm });
        break;
      case 'category':
        contextLabel = t('navigation.context.category');
        break;
      case 'learning':
        contextLabel = t('navigation.context.learning');
        break;
      default:
        contextLabel = t('navigation.context.browse');
    }

    return {
      hasPrevious,
      hasNext,
      previousWord,
      nextWord,
      currentPosition: currentIndex + 1,
      totalWords: words.length,
      contextLabel
    };
  };

  // Mutations
  const addToLearningMutation = useMutation({
    mutationFn: (wordIds: number[]) => learningAPI.addWordToLearning(wordIds),
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

  // Event handlers
  const handleToggleLearning = () => {
    if (progress) {
      removeFromLearningMutation.mutate([wordId]);
    } else {
      addToLearningMutation.mutate([wordId]);
    }
  };

  // Audio event handlers using the hook
  const handlePlayAudio = () => {
    playAudio(t('messages.audioPlayed'), t('messages.audioNotAvailable'));
  };

  const handleIndividualSoundPlay = (sound: WordSound) => {
    playIndividualSound(sound, 'Audio played successfully', 'Audio file not found in public folder');
  };

  const handleUpdateNotes = () => {
    if (progress) {
      updateProgressMutation.mutate({ user_notes: notes });
    }
  };

  const handleUpdateDifficulty = (rating: string) => {
    if (progress) {
      updateProgressMutation.mutate({ difficulty_rating: rating });
    }
  };

  const handleMarkAsLearned = () => {
    if (progress) {
      updateProgressMutation.mutate({ status: 'learned' });
    } else {
      addToLearningMutation.mutate([wordId]);
      setTimeout(() => {
        updateProgressMutation.mutate({ status: 'learned' });
      }, 1000);
    }
  };

  const handleShare = async () => {
    if (navigator.share && word) {
      try {
        await navigator.share({
          title: t('share.title', { word: word.kazakh_word }),
          text: t('share.text', { 
            word: word.kazakh_word, 
            translation: word.translations?.[0]?.translation 
          }),
          url: window.location.href,
        });
      } catch (error) {
        navigator.clipboard.writeText(window.location.href);
        toast.success(t('messages.linkCopied'));
      }
    } else if (word) {
      navigator.clipboard.writeText(window.location.href);
      toast.success(t('messages.linkCopied'));
    }
  };

  // Utility functions
  const getDifficultyColor = (level: number) => {
    const colors = {
      1: 'bg-green-100 text-green-800',
      2: 'bg-blue-100 text-blue-800',
      3: 'bg-yellow-100 text-yellow-800',
      4: 'bg-orange-100 text-orange-800',
      5: 'bg-red-100 text-red-800'
    };
    return colors[level as keyof typeof colors] || colors[1];
  };

  const getStatusColor = (status?: string) => {
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

  // Loading state
  if (wordLoading) {
    return <LoadingSpinner fullScreen text={t('loading.wordDetails')} />;
  }

  // Error state
  if (wordError || !word) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">😕</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('errors.wordNotFound')}</h2>
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
    );
  }

  const navigationInfo = getNavigationInfo();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/app/words')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            <span>{t('navigation.backToWords')}</span>
          </button>

          {navigationInfo && (
            <div className="hidden md:flex items-center space-x-2 text-sm text-gray-500">
              <span>|</span>
              <span>{navigationInfo.contextLabel}</span>
              <span>({navigationInfo.currentPosition} / {navigationInfo.totalWords})</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Navigation Controls */}
          {navigationInfo && (
            <div className="flex items-center space-x-1">
              <button
                onClick={() => navigationInfo.previousWord && navigateToWord(navigationInfo.previousWord.id)}
                disabled={!navigationInfo.hasPrevious || isLoadingNavigation}
                className={`p-2 rounded-md transition-colors ${
                  navigationInfo.hasPrevious && !isLoadingNavigation
                    ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    : 'text-gray-300 cursor-not-allowed'
                }`}
                title={navigationInfo.previousWord 
                  ? t('navigation.previousWord', { word: navigationInfo.previousWord.kazakh_word })
                  : t('navigation.noPrevious')
                }
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>

              <div className="px-3 py-1 bg-gray-100 rounded-md text-sm text-gray-600 min-w-[80px] text-center">
                {navigationInfo.currentPosition} / {navigationInfo.totalWords}
              </div>

              <button
                onClick={() => navigationInfo.nextWord && navigateToWord(navigationInfo.nextWord.id)}
                disabled={!navigationInfo.hasNext || isLoadingNavigation}
                className={`p-2 rounded-md transition-colors ${
                  navigationInfo.hasNext && !isLoadingNavigation
                    ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    : 'text-gray-300 cursor-not-allowed'
                }`}
                title={navigationInfo.nextWord 
                  ? t('navigation.nextWord', { word: navigationInfo.nextWord.kazakh_word })
                  : t('navigation.noNext')
                }
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          )}

          <div className="h-4 w-px bg-gray-300" />

          <button
            onClick={handleShare}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title={t('actions.shareWord')}
          >
            <ShareIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Keyboard Hint */}
      <div className="text-center text-xs text-gray-500">
        {t('navigation.keyboardHint')}
      </div>

      {/* Main Word Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header with Gradient Background & Image */}
        <div className="p-8 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1">
              {/* Main Word Information */}
              <div className="mb-4">
                <h1 className="kazakh-text text-4xl font-bold text-gray-900 mb-2">
                  {word.kazakh_word}
                </h1>
                {word.kazakh_cyrillic && (
                  <p className="cyrillic-text text-xl text-gray-600">
                    {word.kazakh_cyrillic}
                  </p>
                )}
              </div>

              {/* Primary Translation */}
              {word.translations?.[0] && (
                <div className="mb-4">
                  <p className="text-2xl text-gray-900 font-medium mb-2">
                    {word.translations[0].translation}
                  </p>
                  {word.translations[0].alternative_translations && (
                    <p className="text-gray-600">
                      {t('word.also')}: {word.translations[0].alternative_translations.join(', ')}
                    </p>
                  )}
                </div>
              )}

              {/* Pronunciation */}
              {word.pronunciations && word.pronunciations.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('overview.pronunciations')}</h3>
                  <div className="space-y-2">
                    {word.pronunciations.map((pronunciation) => (
                      <div key={pronunciation.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className="font-mono text-gray-900">
                            /{pronunciation.pronunciation}/
                          </span>
                          {pronunciation.pronunciation_system && (
                            <span className="text-xs text-gray-500">
                              ({pronunciation.pronunciation_system})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500 uppercase">
                            {pronunciation.language_code}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Word Image in Gradient Section */}
            <div className="mt-6 lg:mt-0 lg:ml-8">
              <WordImageDisplay 
                word={word}
                className="w-48 h-32"
              />
            </div>
          </div>

          {/* Metadata Badges */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {/* Audio Controls using the hook */}
            {hasAudio && (
              <button
                onClick={handlePlayAudio}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
                title="Play pronunciation"
              >
                <SpeakerWaveIcon className="h-5 w-5" />
                <span>Play Audio</span>
              </button>
            )}

            {/* All Individual Pronunciations */}
            {wordSounds && wordSounds.length > 0 && (
              <div className="flex items-center space-x-2">
                {wordSounds.map((sound) => (
                  <button
                    key={sound.id}
                    onClick={() => handleIndividualSoundPlay(sound)}
                    className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                    title={`Play: ${sound.sound_type}`}
                  >
                    <SpeakerWaveIcon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            )}

            <span className={`badge ${getDifficultyColor(word.difficulty_level.level_number)}`}>
              {t('word.level', { level: word.difficulty_level.level_number })}
            </span>
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
                <tab.icon className="h-5 w-5" />
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-8">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* All Translations */}
              {word.translations && word.translations.length > 1 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('overview.allTranslations')}</h3>
                  <div className="space-y-2">
                    {word.translations.map((translation) => (
                      <div key={translation.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <span className="font-medium text-gray-900">{translation.translation}</span>
                          {translation.alternative_translations && (
                            <p className="text-sm text-gray-600 mt-1">
                              {t('word.also')}: {translation.alternative_translations.join(', ')}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 uppercase">
                          {translation.language_code}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'examples' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{t('examples.title')}</h3>
                <span className="text-sm text-gray-500">
                  {t('examples.count', { count: word.example_sentences?.length || 0 })}
                </span>
              </div>

              {word.example_sentences && word.example_sentences.length > 0 ? (
                <div className="space-y-4">
                  {word.example_sentences.map((sentence) => (
                    <div key={sentence.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="kazakh-text text-lg text-gray-900 mb-2">
                            {sentence.kazakh_sentence}
                          </p>
                          {sentence.translations?.[0] && (
                            <p className="text-gray-700">
                              {sentence.translations[0].translated_sentence}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <span className={`badge difficulty-${sentence.difficulty_level}`}>
                            {t('word.level', { level: sentence.difficulty_level })}
                          </span>
                        </div>
                      </div>

                      {sentence.usage_context && (
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <span className="font-medium">{t('examples.context')}:</span>
                          <span>{sentence.usage_context}</span>
                        </div>
                      )}

                      {/* Additional translations */}
                      {sentence.translations && sentence.translations.length > 1 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-500 mb-2">{t('examples.otherTranslations')}:</p>
                          <div className="space-y-1">
                            {sentence.translations.slice(1).map((translation) => (
                              <div key={translation.id} className="flex items-center justify-between text-sm">
                                <span className="text-gray-700">{translation.translated_sentence}</span>
                                <span className="text-xs text-gray-500 uppercase">{translation.language_code}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ChatBubbleLeftIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">{t('examples.noExamples')}</p>
                  <p className="text-sm text-gray-400 mt-2">{t('examples.addSoon')}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="space-y-6">
              {progress ? (
                <>
                  {/* Progress Statistics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-blue-600">{progress.times_seen}</div>
                      <div className="text-sm text-blue-600">{t('progress.timesSeen')}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-green-600">{progress.times_correct}</div>
                      <div className="text-sm text-green-600">{t('progress.correctAnswers')}</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-orange-600">
                        {progress.times_seen > 0 ? Math.round((progress.times_correct / progress.times_seen) * 100) : 0}%
                      </div>
                      <div className="text-sm text-orange-600">{t('progress.accuracyRate')}</div>
                    </div>
                  </div>

                  {/* Progress Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">{t('progress.learningStatus')}</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                          <span className="text-sm font-medium text-gray-500">{t('progress.currentStatus')}:</span>
                          <span className={`badge ${getStatusColor(progress.status)}`}>
                            {getStatusLabel(progress.status)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                          <span className="text-sm font-medium text-gray-500">{t('progress.added')}:</span>
                          <span className="text-sm text-gray-900">
                            {new Date(progress.added_at).toLocaleDateString()}
                          </span>
                        </div>
                        {progress.first_learned_at && (
                          <div className="flex items-center justify-between py-2 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-500">{t('progress.firstLearned')}:</span>
                            <span className="text-sm text-gray-900">
                              {new Date(progress.first_learned_at).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {progress.last_practiced_at && (
                          <div className="flex items-center justify-between py-2 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-500">{t('progress.lastPracticed')}:</span>
                            <span className="text-sm text-gray-900">
                              {new Date(progress.last_practiced_at).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {progress.next_review_at && (
                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm font-medium text-gray-500">{t('progress.nextReview')}:</span>
                            <span className="text-sm text-gray-900">
                              {new Date(progress.next_review_at).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">{t('progress.spacedRepetition')}</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                          <span className="text-sm font-medium text-gray-500">{t('progress.interval')}:</span>
                          <span className="text-sm text-gray-900">
                            {t('progress.days', { count: progress.repetition_interval })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                          <span className="text-sm font-medium text-gray-500">{t('progress.easeFactor')}:</span>
                          <span className="text-sm text-gray-900">
                            {progress.ease_factor.toFixed(2)}
                          </span>
                        </div>
                        {progress.difficulty_rating && (
                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm font-medium text-gray-500">{t('progress.yourDifficultyRating')}:</span>
                            <span className="text-sm text-gray-900">
                              {getDifficultyLabel(progress.difficulty_rating)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Difficulty Rating */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">{t('progress.rateDifficulty')}</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      {t('progress.difficultyDescription')}
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
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">{t('progress.personalNotes')}</h4>
                    <div className="space-y-3">
                      <textarea
                        value={notes || progress.user_notes || ''}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={t('progress.notesPlaceholder')}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 resize-none"
                        rows={4}
                      />
                      <button
                        onClick={handleUpdateNotes}
                        disabled={updateProgressMutation.isPending}
                        className="btn-primary"
                      >
                        {updateProgressMutation.isPending ? t('actions.saving') : t('actions.saveNotes')}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <ClockIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">{t('progress.notTracking')}</h4>
                  <p className="text-gray-500 mb-4">
                    {t('progress.addToTrackDescription')}
                  </p>
                  <button
                    onClick={() => addToLearningMutation.mutate([wordId])}
                    disabled={addToLearningMutation.isPending}
                    className="btn-primary"
                  >
                    {addToLearningMutation.isPending ? t('actions.adding') : t('actions.addToLearningList')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Preview Cards */}
      {navigationInfo && (navigationInfo.previousWord || navigationInfo.nextWord) && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Previous Word Preview */}
            <div className={`${!navigationInfo.previousWord ? 'opacity-30' : ''}`}>
              {navigationInfo.previousWord ? (
                <button
                  onClick={() => navigateToWord(navigationInfo.previousWord!.id)}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-white transition-all group"
                >
                  <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
                    <ChevronLeftIcon className="h-4 w-4" />
                    <span>{t('navigation.previous')}</span>
                  </div>
                  <div className="kazakh-text font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                    {navigationInfo.previousWord.kazakh_word}
                  </div>
                  <div className="text-sm text-gray-600 truncate">
                    {navigationInfo.previousWord.primary_translation}
                  </div>
                </button>
              ) : (
                <div className="w-full p-3 rounded-lg border border-gray-200 bg-gray-100">
                  <div className="flex items-center space-x-2 text-sm text-gray-400 mb-1">
                    <ChevronLeftIcon className="h-4 w-4" />
                    <span>{t('navigation.previous')}</span>
                  </div>
                  <div className="text-gray-400">
                    {t('navigation.noPrevious')}
                  </div>
                </div>
              )}
            </div>

            {/* Next Word Preview */}
            <div className={`${!navigationInfo.nextWord ? 'opacity-30' : ''}`}>
              {navigationInfo.nextWord ? (
                <button
                  onClick={() => navigateToWord(navigationInfo.nextWord!.id)}
                  className="w-full text-right p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-white transition-all group"
                >
                  <div className="flex items-center justify-end space-x-2 text-sm text-gray-500 mb-1">
                    <span>{t('navigation.next')}</span>
                    <ChevronRightIcon className="h-4 w-4" />
                  </div>
                  <div className="kazakh-text font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                    {navigationInfo.nextWord.kazakh_word}
                  </div>
                  <div className="text-sm text-gray-600 truncate">
                    {navigationInfo.nextWord.primary_translation}
                  </div>
                </button>
              ) : (
                <div className="w-full p-3 rounded-lg border border-gray-200 bg-gray-100 text-right">
                  <div className="flex items-center justify-end space-x-2 text-sm text-gray-400 mb-1">
                    <span>{t('navigation.next')}</span>
                    <ChevronRightIcon className="h-4 w-4" />
                  </div>
                  <div className="text-gray-400">
                    {t('navigation.noNext')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WordDetailPage;