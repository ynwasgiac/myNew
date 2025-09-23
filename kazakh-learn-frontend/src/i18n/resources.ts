// src/i18n/resources.ts - Updated to include learningModule translations

// Import all existing translations
import categoriesEn from '../locales/en/categories.json';
import wordsEn from '../locales/en/words.json';
import wordDetailEn from '../locales/en/wordDetail.json';
import categoryDetaillEn from '../locales/en/categoryDetail.json';
import notFoundEn from '../locales/en/notFound.json';
import learningEn from '../locales/en/learning.json';
import practiceEn from '../locales/en/practice.json';
import progressEn from '../locales/en/progress.json';
import quizEn from '../locales/en/quiz.json';
import profileEn from '../locales/en/profile.json';
import settingsEn from '../locales/en/settings.json';
import homeEn from '../locales/en/home.json';
import dashboardEn from '../locales/en/dashboard.json';
import learningGoalsEn from '../locales/en/learningGoals.json';
import recentActivityEn from '../locales/en/recentActivity.json';
import wordsToReviewEn from '../locales/en/wordsToReview.json';
import navigationEn from '../locales/en/navigation.json';
import guidesEn from '../locales/en/guides.json';
import commonEn from '../locales/en/common.json';
import learnedWordsEn from '../locales/en/learnedWords.json';
import weeklyProgressEn from '../locales/en/weeklyProgress.json';
import wordProgressEn from '../locales/en/wordProgress.json';
import dailyProgressEn from '../locales/en/dailyProgress.json';
import wordsAvailableEn from '../locales/en/wordsAvailable.json';
import quickActionsEn from '../locales/en/quickActions.json';

import categoriesKk from '../locales/kk/categories.json';
import wordsKk from '../locales/kk/words.json';
import wordDetailKk from '../locales/kk/wordDetail.json';
import categoryDetaillKk from '../locales/kk/categoryDetail.json';
import notFoundKk  from '../locales/kk/notFound.json';
import learningKk from '../locales/kk/learning.json';
import practiceKk from '../locales/kk/practice.json';
import progressKk from '../locales/kk/progress.json';
import quizKk from '../locales/kk/quiz.json';
import profileKk from '../locales/kk/profile.json';
import settingsKk from '../locales/kk/settings.json';
import homeKk from '../locales/kk/home.json';
import dashboardKk from '../locales/kk/dashboard.json';
import learningGoalsKk from '../locales/kk/learningGoals.json';
import recentActivityKk from '../locales/kk/recentActivity.json';
import wordsToReviewKk from '../locales/kk/wordsToReview.json';
import navigationKk from '../locales/kk/navigation.json';
import guidesKk from '../locales/kk/guides.json';
import commonKk from '../locales/kk/common.json';
import learnedWordsKk from '../locales/kk/learnedWords.json';
import weeklyProgressKk from '../locales/kk/weeklyProgress.json';
import wordProgressKk from '../locales/kk/wordProgress.json';
import dailyProgressKk from '../locales/kk/dailyProgress.json';
import wordsAvailableKk from '../locales/kk/wordsAvailable.json';
import quickActionsKk from '../locales/kk/quickActions.json';

import categoriesRu from '../locales/ru/categories.json';
import wordsRu from '../locales/ru/words.json';
import wordDetailRu from '../locales/ru/wordDetail.json';
import categoryDetaillRu from '../locales/ru/categoryDetail.json';
import notFoundRu from '../locales/ru/notFound.json';
import learningRu from '../locales/ru/learning.json';
import practiceRu from '../locales/ru/practice.json';
import progressRu from '../locales/ru/progress.json';
import quizRu from '../locales/ru/quiz.json';
import profileRu from '../locales/ru/profile.json';
import settingsRu from '../locales/ru/settings.json';
import homeRu from '../locales/ru/home.json';
import dashboardRu from '../locales/ru/dashboard.json';
import learningGoalsRu from '../locales/ru/learningGoals.json';
import recentActivityRu from '../locales/ru/recentActivity.json';
import wordsToReviewRu from '../locales/ru/wordsToReview.json';
import navigationRu from '../locales/ru/navigation.json';
import guidesRu from '../locales/ru/guides.json';
import commonRu from '../locales/ru/common.json';
import learnedWordsRu from '../locales/ru/learnedWords.json';
import weeklyProgressRu from '../locales/ru/weeklyProgress.json';
import wordProgressRu from '../locales/ru/wordProgress.json';
import dailyProgressRu from '../locales/ru/dailyProgress.json';
import wordsAvailableRu from '../locales/ru/wordsAvailable.json';
import quickActionsRu from '../locales/ru/quickActions.json';

// Create the base resources
const baseResources = {
  en: {
    categories: categoriesEn,
    words: wordsEn,
    wordDetail: wordDetailEn,
    categoryDetail: categoryDetaillEn,
    notFound: notFoundEn,
    learning: learningEn,
    practice: practiceEn,
    progress: progressEn,
    quiz: quizEn,
    profile: profileEn,
    settings: settingsEn,
    home: homeEn,
    dashboard: dashboardEn,
    learningGoals: learningGoalsEn,
    recentActivity: recentActivityEn,
    wordsToReview: wordsToReviewEn,
    navigation: navigationEn,
    guides: guidesEn,
    common: commonEn,
    learnedWords: learnedWordsEn,
    weeklyProgress: weeklyProgressEn,
    wordProgress: wordProgressEn,
    dailyProgress: dailyProgressEn,
    wordsAvailable: wordsAvailableEn,
    quickActions: quickActionsEn
  },
  kk: {
    categories: categoriesKk,
    words: wordsKk,
    wordDetail: wordDetailKk,
    categoryDetail: categoryDetaillKk,
    notFound: notFoundKk,
    learning: learningKk,
    practice: practiceKk,
    progress: progressKk,
    quiz: quizKk,
    profile: profileKk,
    settings: settingsKk,
    home: homeKk,
    dashboard: dashboardKk,
    learningGoals: learningGoalsKk,
    recentActivity: recentActivityKk,
    wordsToReview: wordsToReviewKk,
    navigation: navigationKk,
    guides: guidesKk,
    common: commonKk,
    learnedWords: learnedWordsKk,
    weeklyProgress: weeklyProgressKk,
    wordProgress: wordProgressKk,
    dailyProgress: dailyProgressKk,
    wordsAvailable: wordsAvailableKk,
    quickActions: quickActionsKk
  },
  ru: {
    categories: categoriesRu,
    words: wordsRu,
    wordDetail: wordDetailRu,
    categoryDetail: categoryDetaillRu,
    notFound: notFoundRu,
    learning: learningRu,
    practice: practiceRu,
    progress: progressRu,
    quiz: quizRu,
    profile: profileRu,
    settings: settingsRu,
    home: homeRu,
    dashboard: dashboardRu,
    learningGoals: learningGoalsRu,
    recentActivity: recentActivityRu,
    wordsToReview: wordsToReviewRu,
    navigation: navigationRu,
    guides: guidesRu,
    common: commonRu,
    learnedWords: learnedWordsRu,
    weeklyProgress: weeklyProgressRu,
    wordProgress: wordProgressRu,
    dailyProgress: dailyProgressRu,
    wordsAvailable: wordsAvailableRu,
    quickActions: quickActionsRu
  },
};

// Export resources with locale variations to handle different formats
export const resources = {
  ...baseResources,
  // Handle locale variations
  'en-US': baseResources.en,
  'en-GB': baseResources.en,
  'ru-RU': baseResources.ru,
  'ru-KZ': baseResources.ru,
  'kk-KZ': baseResources.kk,
  'kk-Cyrl': baseResources.kk,
};

// Alternative: Create a function to normalize locale codes
export const normalizeLocale = (locale: string): string => {
  const baseLocale = locale.split('-')[0];
  const localeMap: Record<string, string> = {
    'en': 'en',
    'ru': 'ru', 
    'kk': 'kk',
    'kz': 'kk', // Handle Kazakhstan country code
  };
  
  return localeMap[baseLocale] || 'en';
};