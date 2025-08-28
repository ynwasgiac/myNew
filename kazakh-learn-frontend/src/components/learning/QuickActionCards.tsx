import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PencilIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

interface QuickActionCardsProps {
  review?: string; 
}

const QuickActionCards: React.FC<QuickActionCardsProps> = ({ review }) => {
  const navigate = useNavigate();
  const { t } = useTranslation('learning');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <button
        onClick={() => navigate(`/app/practice${review}`)}
        className="p-6 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all text-left group"
      >
        <div className="flex items-center mb-3">
          <PencilIcon className="h-8 w-8 text-blue-500 group-hover:text-blue-600" />
          <h4 className="text-lg font-semibold text-gray-900 ml-3">
            {t('quickActions.quickPractice')}
          </h4>
        </div>
        <p className="text-gray-600 text-sm">
          {t('quickActions.quickPracticeDesc')}
        </p>
      </button>

      <button
        onClick={() => navigate('/app/quiz')}
        className="p-6 bg-white rounded-lg border border-gray-200 hover:border-green-300 hover:shadow-md transition-all text-left group"
      >
        <div className="flex items-center mb-3">
          <QuestionMarkCircleIcon className="h-8 w-8 text-green-500 group-hover:text-green-600" />
          <h4 className="text-lg font-semibold text-gray-900 ml-3">
            {t('quickActions.takeQuiz')}
          </h4>
        </div>
        <p className="text-gray-600 text-sm">
          {t('quickActions.takeQuizDesc')}
        </p>
      </button>
    </div>
  );
};

const QuickActionCardsReview: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('learning');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <button
        onClick={() => navigate('/app/practice?type=review')}
        className="p-6 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all text-left group"
      >
        <div className="flex items-center mb-3">
          <PencilIcon className="h-8 w-8 text-blue-500 group-hover:text-blue-600" />
          <h4 className="text-lg font-semibold text-gray-900 ml-3">
            {t('quickActions.quickPractice')}
          </h4>
        </div>
        <p className="text-gray-600 text-sm">
          {t('quickActions.quickPracticeDesc')}
        </p>
      </button>

      <button
        onClick={() => navigate('/app/quiz')}
        className="p-6 bg-white rounded-lg border border-gray-200 hover:border-green-300 hover:shadow-md transition-all text-left group"
      >
        <div className="flex items-center mb-3">
          <QuestionMarkCircleIcon className="h-8 w-8 text-green-500 group-hover:text-green-600" />
          <h4 className="text-lg font-semibold text-gray-900 ml-3">
            {t('quickActions.takeQuiz')}
          </h4>
        </div>
        <p className="text-gray-600 text-sm">
          {t('quickActions.takeQuizDesc')}
        </p>
      </button>
    </div>
  );
};

export default QuickActionCards;