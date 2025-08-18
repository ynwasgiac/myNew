import React from 'react';
import { CheckCircleIcon, LightBulbIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

const LearningTips: React.FC = () => {
  const { t } = useTranslation('learning');

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
      <div className="flex items-center mb-4">
        <LightBulbIcon className="h-6 w-6 mr-2 text-blue-500" />
        <h2 className="text-xl font-semibold text-gray-900">
          {t('learningTips.title')}
        </h2>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-start">
          <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
          <span className="text-gray-700 text-sm">{t('learningTips.tip1')}</span>
        </div>
        <div className="flex items-start">
          <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
          <span className="text-gray-700 text-sm">{t('learningTips.tip2')}</span>
        </div>
        <div className="flex items-start">
          <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
          <span className="text-gray-700 text-sm">{t('learningTips.tip3')}</span>
        </div>
        <div className="flex items-start">
          <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
          <span className="text-gray-700 text-sm">{t('learningTips.tip4')}</span>
        </div>
      </div>
    </div>
  );
};

export default LearningTips;