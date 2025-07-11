import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { resources } from './resources';

// Enhanced language detection function
const getUserLanguage = (): string => {
  // 1. First priority: Check localStorage for user's language preference
  const savedLanguage = localStorage.getItem('user-language');
  if (savedLanguage && ['en', 'kk', 'ru'].includes(savedLanguage)) {
    console.log(`Found saved language: ${savedLanguage}`);
    return savedLanguage;
  }

  // 2. Second priority: Check if user is logged in and has language preference
  const userDataString = localStorage.getItem('user-data');
  if (userDataString) {
    try {
      const userData = JSON.parse(userDataString);
      if (userData.main_language?.language_code) {
        const userLang = userData.main_language.language_code;
        console.log(`Found user language from stored data: ${userLang}`);
        // Store it for future use
        localStorage.setItem('user-language', userLang);
        return userLang;
      }
    } catch (error) {
      console.error('Error parsing user data for language detection:', error);
    }
  }

  // 3. Third priority: Check URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get('lang');
  if (urlLang && ['en', 'kk', 'ru'].includes(urlLang)) {
    console.log(`Found language from URL: ${urlLang}`);
    return urlLang;
  }

  // 4. Fourth priority: Browser language detection
  const browserLang = navigator.language.split('-')[0];
  if (['en', 'kk', 'ru'].includes(browserLang)) {
    console.log(`Using browser language: ${browserLang}`);
    return browserLang;
  }

  // 5. Ultimate fallback
  console.log('Using fallback language: en');
  return 'en';
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: getUserLanguage(), // Set initial language
    fallbackLng: {
      'ru-RU': ['ru', 'en'],
      'kk-KZ': ['kk', 'en'],
      'default': ['en']
    },
    ns: ['common', 'categories', 'words', 'wordDetail', 'categoryDetail', 
         'learning', 'practice', 'progress', 'quiz', 'notFound'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'user-language',
    },
    debug: process.env.NODE_ENV === 'development', // Enable debug in development
  });

// Language change event handler for debugging
i18n.on('languageChanged', (lng) => {
  console.log(`Language changed to: ${lng}`);
  document.documentElement.lang = lng;
});

export default i18n;