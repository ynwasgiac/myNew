// src/components/ui/LanguageSwitcher.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { GlobeAltIcon } from '@heroicons/react/24/outline';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'kk', name: 'Қазақша', flag: '🇰🇿' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
];

interface LanguageSwitcherProps {
  className?: string;
  showLabels?: boolean;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  className = '',
  showLabels = true 
}) => {
  const { i18n } = useTranslation();
  const { user, setMainLanguage, isAuthenticated } = useAuth();

  const handleLanguageChange = async (languageCode: string) => {
    try {
      // Update i18next immediately for UI
      await i18n.changeLanguage(languageCode);
      localStorage.setItem('user-language', languageCode);

      // If user is authenticated, update their preference in the backend
      if (isAuthenticated) {
        await setMainLanguage(languageCode);
      }
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  };

  const currentLanguage = i18n.language;

  return (
    <div className={`relative ${className}`}>
      <select
        value={currentLanguage}
        onChange={(e) => handleLanguageChange(e.target.value)}
        className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {showLabels ? `${lang.flag} ${lang.name}` : lang.flag}
          </option>
        ))}
      </select>
      
      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <GlobeAltIcon className="h-4 w-4 text-gray-400" />
      </div>
      
      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 mt-1">
          Current: {currentLanguage} | User: {user?.main_language?.language_code || 'none'}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;