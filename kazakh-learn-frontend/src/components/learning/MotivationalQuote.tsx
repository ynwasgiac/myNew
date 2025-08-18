import React from 'react';
import { useTranslation } from 'react-i18next';

interface MotivationalQuoteProps {
  customTitle?: string;
  customQuote?: string;
  gradient?: string;
}

const MotivationalQuote: React.FC<MotivationalQuoteProps> = ({ 
  customTitle, 
  customQuote, 
  gradient = "from-purple-500 to-pink-500" 
}) => {
  const { t } = useTranslation('learning');

  const title = customTitle || t('motivation.title');
  const quote = customQuote || t('motivation.quote');

  return (
    <div className={`bg-gradient-to-r ${gradient} rounded-xl p-6 text-white`}>
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      <p className="text-purple-100 text-sm italic">
        {quote}
      </p>
    </div>
  );
};

export default MotivationalQuote;