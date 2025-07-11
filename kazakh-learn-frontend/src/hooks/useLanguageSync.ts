// src/hooks/useLanguageSync.ts
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook to keep i18next language in sync with user's preferred language
 */
export const useLanguageSync = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();

  useEffect(() => {
    if (user?.main_language?.language_code) {
      const userLanguage = user.main_language.language_code;
      const currentLanguage = i18n.language;

      // Only change if it's different to avoid unnecessary re-renders
      if (currentLanguage !== userLanguage) {
        console.log(`Syncing language: ${currentLanguage} -> ${userLanguage}`);
        i18n.changeLanguage(userLanguage);
        localStorage.setItem('user-language', userLanguage);
      }
    }
  }, [user, i18n]);

  return {
    currentLanguage: i18n.language,
    changeLanguage: i18n.changeLanguage,
    userPreferredLanguage: user?.main_language?.language_code,
  };
};