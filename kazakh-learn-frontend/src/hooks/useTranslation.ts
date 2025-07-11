import { useTranslation as useI18nTranslation } from 'react-i18next';

export const useTranslation = (namespace?: string) => {
  const { t, i18n } = useI18nTranslation(namespace);
  
  const changeLanguage = (language: string) => {
    i18n.changeLanguage(language);
  };
  
  const currentLanguage = i18n.language;
  const isLoading = !i18n.isInitialized;
  
  return {
    t,
    changeLanguage,
    currentLanguage,
    isLoading,
    i18n,
  };
};

// Typed translation hook for better TypeScript support
export const useTypedTranslation = <T extends string>(namespace?: T) => {
  return useTranslation(namespace);
};