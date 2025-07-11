// src/components/dashboard/WordsToReview.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { 
  ClockIcon, 
  ArrowRightIcon,
  BookOpenIcon,
  AcademicCapIcon 
} from '@heroicons/react/24/outline';
import { learningAPI } from '../../services/api';
import LoadingSpinner from '../ui/LoadingSpinner';

const WordsToReview: React.FC = () => {
  const { t } = useTranslation('wordsToReview');

  // Fetch words that need review
  const { data: reviewWords, isLoading } = useQuery({
    queryKey: ['words-for-review'],
    queryFn: () => learningAPI.getWordsForReview(10),
  });

  const getStatusLabel = (status: string) => {
    return t(`statuses.${status}`, { defaultValue: status.replace('_', ' ') });
  };

  const formatDueDate = (dateString: string | null | undefined) => {
    if (!dateString) {
      return t('wordInfo.dueNow');
    }
    const date = new Date(dateString).toLocaleDateString();
    return t('wordInfo.due', { date });
  };

  const calculateAccuracy = (correct: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((correct / total) * 100);
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

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('title')}</h3>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <ClockIcon className="h-5 w-5 text-orange-500 mr-2" />
          {t('title')}
        </h3>
        {reviewWords && reviewWords.length > 0 && (
          <Link
            to="/app/practice?type=review"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
          >
            {t('actions.reviewAll')}
            <ArrowRightIcon className="h-4 w-4 ml-1" />
          </Link>
        )}
      </div>

      {/* Words List */}
      {reviewWords && reviewWords.length > 0 ? (
        <div className="space-y-3">
          {reviewWords.slice(0, 5).map((progress) => (
            <div
              key={progress.id}
              className="flex items-center justify-between p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="bg-orange-100 p-2 rounded-lg">
                  <BookOpenIcon className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  {/* Note: In a real implementation, you'd need to fetch word details */}
                  <p className="font-medium text-gray-900">
                    {t('wordInfo.wordId', { id: progress.kazakh_word_id })}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatDueDate(progress.next_review_at)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className={`badge ${getStatusColor(progress.status)}`}>
                  {getStatusLabel(progress.status)}
                </span>
                <span className="text-xs text-gray-500">
                  {t('accuracy', { 
                    rate: calculateAccuracy(progress.times_correct, progress.times_seen) 
                  })}
                </span>
              </div>
            </div>
          ))}

          {/* Show more indicator */}
          {reviewWords.length > 5 && (
            <div className="text-center pt-3 border-t border-gray-200">
              <Link
                to="/app/practice?type=review"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {t('wordInfo.moreWords', { count: reviewWords.length - 5 })}
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="bg-green-100 p-3 rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center">
            <AcademicCapIcon className="h-6 w-6 text-green-600" />
          </div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">{t('emptyState.title')}</h4>
          <p className="text-gray-600 mb-4">
            {t('emptyState.description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Link
              to="/app/learn"
              className="btn-primary text-sm"
            >
              {t('actions.learnNewWords')}
            </Link>
            <Link
              to="/app/practice"
              className="btn-secondary text-sm"
            >
              {t('actions.practiceAnyway')}
            </Link>
          </div>
        </div>
      )}

      {/* Quick Action Buttons */}
      {reviewWords && reviewWords.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              to="/app/practice?type=review"
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-center py-2 px-4 rounded-lg text-sm font-medium transition-colors"
            >
              {t('actions.startReviewSession')}
            </Link>
            <Link
              to="/app/practice?type=quick"
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-center py-2 px-4 rounded-lg text-sm font-medium transition-colors"
            >
              {t('actions.quickPractice')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default WordsToReview;