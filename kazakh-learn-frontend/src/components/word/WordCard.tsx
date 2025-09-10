// src/components/word/WordCard.tsx - Fixed Image Handling (No Infinite Recursion)
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  HeartIcon, 
  SpeakerWaveIcon,
  BookmarkIcon,
  EyeIcon,
  TagIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';
import { 
  HeartIcon as HeartSolidIcon, 
  BookmarkIcon as BookmarkSolidIcon 
} from '@heroicons/react/24/solid';
import type { KazakhWordSummary } from '../../types/api';

interface WordCardProps {
  word: KazakhWordSummary;
  onAddToLearning?: (wordId: number) => void;
  onRemoveFromLearning?: (wordId: number) => void;
  isInLearningList?: boolean;
  showActions?: boolean;
  compact?: boolean;
}

const WordCard: React.FC<WordCardProps> = ({
  word,
  onAddToLearning,
  onRemoveFromLearning,
  isInLearningList = false,
  showActions = true,
  compact = false
}) => {
  const [imageError, setImageError] = useState(false);
  const [fallbackLevel, setFallbackLevel] = useState(0);

  // ✅ ИСПРАВЛЕНИЕ: Сбрасываем состояние при смене слова
  useEffect(() => {
    setImageError(false);
    setFallbackLevel(0);
  }, [word.id]); // Зависимость от ID слова

  const handleToggleLearning = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isInLearningList && onRemoveFromLearning) {
      onRemoveFromLearning(word.id);
    } else if (!isInLearningList && onAddToLearning) {
      onAddToLearning(word.id);
    }
  };

  const getDifficultyColor = (level: number): string => {
    const colors = {
      1: 'bg-green-100 text-green-800',
      2: 'bg-blue-100 text-blue-800',
      3: 'bg-yellow-100 text-yellow-800',
      4: 'bg-orange-100 text-orange-800',
      5: 'bg-red-100 text-red-800'
    };
    return colors[level as keyof typeof colors] || colors[1];
  };

  // ✅ FIXED: Get image source without recursion
  const getImageSource = (): string | null => {
    if (imageError) return null;

    // Generate all possible image sources upfront
    const imageSources: (string | null)[] = [];
    
    // Source 1: Primary image from database
    if (word.primary_image) {
      imageSources.push(word.primary_image);
    }
    
    // Source 2: Expected category path
    const safeWordName = word.kazakh_word.replace(/\s+/g, '_').toLowerCase();
    imageSources.push(`/images/words/categories/${word.category_name.toLowerCase()}/${safeWordName}.jpg`);
    
    // Source 3: Category placeholder
    const categoryPlaceholders: Record<string, string> = {
      'animals': '/images/words/placeholders/animals.png',
      'food': '/images/words/placeholders/food.png',
      'colors': '/images/words/placeholders/colors.png',
      'family': '/images/words/placeholders/family.png',
      'body': '/images/words/placeholders/body.png',
      'nature': '/images/words/placeholders/nature.png'
    };
    imageSources.push(
      categoryPlaceholders[word.category_name.toLowerCase()] || 
      '/images/words/placeholders/default.png'
    );
    
    // Source 4: Default placeholder
    imageSources.push('/images/words/placeholders/default.png');

    // Return the source for current fallback level
    return imageSources[fallbackLevel] || null;
  };

  // ✅ FIXED: Handle image error with controlled fallback (no recursion)
  const handleImageError = () => {
    if (fallbackLevel < 3) {
      setFallbackLevel(prev => prev + 1);
    } else {
      setImageError(true);
    }
  };

  const currentImageSrc = getImageSource();

  // Compact version for list view
  if (compact) {
    return (
      <div className="p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center justify-between">
          <Link 
            to={`/app/words/${word.id}`}
            className="flex-1 min-w-0 flex items-center space-x-4"
          >
            {/* Compact Image */}
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
              {currentImageSrc && !imageError ? (
                <img
                  src={currentImageSrc}
                  alt={`${word.kazakh_word} image`}
                  className="w-full h-full object-cover"
                  onError={handleImageError}
                />
              ) : (
                <PhotoIcon className="h-6 w-6 text-gray-400" />
              )}
            </div>

            {/* Word Text */}
            <div className="flex-1 min-w-0">
              <h3 className="kazakh-text font-semibold text-gray-900 truncate text-lg">
                {word.kazakh_word}
              </h3>
              {word.kazakh_cyrillic && (
                <p className="cyrillic-text text-sm text-gray-600 truncate">
                  {word.kazakh_cyrillic}
                </p>
              )}
              <p className="text-sm text-gray-700 truncate">
                {word.primary_translation}
              </p>
            </div>

            {/* Metadata */}
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                {word.category_name}
              </span>
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                {word.word_type_name}
              </span>
              <span className={`px-2 py-1 text-xs rounded-full ${getDifficultyColor(word.difficulty_level)}`}>
                Level {word.difficulty_level}
              </span>
            </div>
          </Link>

          {/* Actions */}
          {showActions && (
            <div className="ml-4 flex items-center space-x-2">
              <button
                onClick={handleToggleLearning}
                className={`p-2 rounded-full transition-all duration-200 ${
                  isInLearningList
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-500'
                }`}
                title={isInLearningList ? 'Remove from learning list' : 'Add to learning list'}
              >
                {isInLearningList ? (
                  <HeartSolidIcon className="h-5 w-5" />
                ) : (
                  <HeartIcon className="h-5 w-5" />
                )}
              </button>
              <Link
                to={`/app/words/${word.id}`}
                className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                title="View details"
              >
                <EyeIcon className="h-5 w-5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full card version for grid view
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md hover:border-gray-300 transition-all duration-200 group">
      <Link to={`/app/words/${word.id}`} className="block">
        {/* Main Image */}
        <div className="aspect-video w-full mb-4 rounded-lg overflow-hidden bg-gray-100 relative flex items-center justify-center">
          {currentImageSrc && !imageError ? (
            <img
              src={currentImageSrc}
              alt={`${word.kazakh_word} image`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              onError={handleImageError}
            />
          ) : (
            <PhotoIcon className="h-12 w-12 text-gray-400" />
          )}
        </div>

        {/* Content */}
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="kazakh-text font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-xl">
                {word.kazakh_word}
              </h3>
              {word.kazakh_cyrillic && (
                <p className="cyrillic-text text-sm text-gray-600 mt-1">
                  {word.kazakh_cyrillic}
                </p>
              )}
            </div>
            
            {showActions && (
              <button
                onClick={handleToggleLearning}
                className={`p-2 rounded-full transition-all duration-200 ml-2 ${
                  isInLearningList
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-500'
                }`}
                title={isInLearningList ? 'Remove from learning list' : 'Add to learning list'}
              >
                {isInLearningList ? (
                  <HeartSolidIcon className="h-6 w-6" />
                ) : (
                  <HeartIcon className="h-6 w-6" />
                )}
              </button>
            )}
          </div>

          {/* Translation */}
          {word.primary_translation && (
            <p className="text-gray-700 text-sm">
              {word.primary_translation}
            </p>
          )}

          {/* Metadata */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                {word.category_name}
              </span>
              <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                {word.word_type_name}
              </span>
            </div>
            
            <span className={`px-2 py-1 rounded-full ${getDifficultyColor(word.difficulty_level)}`}>
              Level {word.difficulty_level}
            </span>
          </div>
        </div>
      </Link>

      {/* Action buttons (visible on hover) */}
      {showActions && (
        <div className="mt-4 pt-3 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                className="flex items-center space-x-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"
                title="Listen to pronunciation"
              >
                <SpeakerWaveIcon className="h-4 w-4" />
                <span>Listen</span>
              </button>
              
              <Link
                to={`/app/words/${word.id}`}
                className="flex items-center space-x-1 text-xs text-gray-500 hover:text-green-600 transition-colors"
                title="View details"
              >
                <EyeIcon className="h-4 w-4" />
                <span>View</span>
              </Link>
            </div>
            
            <button
              onClick={handleToggleLearning}
              className={`flex items-center space-x-1 text-xs transition-colors ${
                isInLearningList 
                  ? 'text-red-500 hover:text-red-600' 
                  : 'text-gray-500 hover:text-red-600'
              }`}
              title={isInLearningList ? 'Remove from learning' : 'Add to learning'}
            >
              {isInLearningList ? (
                <BookmarkSolidIcon className="h-4 w-4" />
              ) : (
                <BookmarkIcon className="h-4 w-4" />
              )}
              <span>{isInLearningList ? 'Remove' : 'Save'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WordCard;