import React from 'react';
import { BookOpenIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

interface WordsAvailableData {
  want_to_learn: number;
  learning: number;
  review: number;
  total: number;
}

interface WordsAvailableBreakdownProps {
  wordsAvailable?: WordsAvailableData | null;
}

const WordsAvailableBreakdown: React.FC<WordsAvailableBreakdownProps> = ({ wordsAvailable }) => {
  const { t } = useTranslation('learning');

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <BookOpenIcon className="h-5 w-5 mr-2 text-green-500" />
        {t('wordsAvailable.title')}
      </h3>
      
      {wordsAvailable && wordsAvailable.total > 0 ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
            <span className="text-blue-700 font-medium">{t('wordsAvailable.wantToLearn')}</span>
            <span className="font-bold text-blue-900">{wordsAvailable.want_to_learn}</span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
            <span className="text-yellow-700 font-medium">{t('wordsAvailable.learning')}</span>
            <span className="font-bold text-yellow-900">{wordsAvailable.learning}</span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
            <span className="text-orange-700 font-medium">{t('wordsAvailable.review')}</span>
            <span className="font-bold text-orange-900">{wordsAvailable.review}</span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-gray-100 rounded-lg border-2 border-gray-300">
            <span className="text-gray-700 font-semibold">{t('wordsAvailable.total')}</span>
            <span className="font-bold text-gray-900 text-lg">{wordsAvailable.total}</span>
          </div>
        </div>
      ) : (
        <p className="text-gray-500 text-center py-4">{t('wordsAvailable.noWordsAvailable')}</p>
      )}
    </div>
  );
};

export default WordsAvailableBreakdown;