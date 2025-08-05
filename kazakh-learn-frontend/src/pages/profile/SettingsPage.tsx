import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { 
  GlobeAltIcon, 
  BellIcon, 
  Cog6ToothIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';

import { useAuth } from '../../contexts/AuthContext';
import { languagesAPI } from '../../services/api';

// Simple user preferences API - can be moved to a separate file later
const userPreferencesAPI = {
  async getPreferences() {
    const stored = localStorage.getItem('user-preferences');
    const defaults = {
      quiz_word_count: 5,
      daily_goal: 10,
      session_length: 10,
      interface_language: 'en'
    };
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return { ...defaults, ...parsed };
      } catch (error) {
        return defaults;
      }
    }
    
    return defaults;
  },

  async updatePreferences(preferences: any) {
    const current = await this.getPreferences();
    const updated = { ...current, ...preferences };
    
    localStorage.setItem('user-preferences', JSON.stringify(updated));
    
    return new Promise(resolve => {
      setTimeout(() => resolve(updated), 100);
    });
  }
};

const SettingsPage: React.FC = () => {
  const { t } = useTranslation('settings');
  const { user, setMainLanguage } = useAuth();
  const queryClient = useQueryClient();
  
  // Local state for settings
  const [selectedLanguage, setSelectedLanguage] = useState(
    user?.main_language?.language_code || 'en'
  );
  const [quizWordCount, setQuizWordCount] = useState<number>(5);
  const [dailyGoal, setDailyGoal] = useState<number>(10);
  const [sessionLength, setSessionLength] = useState<number>(10);

  // Get available languages
  const { data: languages = [] } = useQuery({
    queryKey: ['languages'],
    queryFn: () => languagesAPI.getLanguages(),
  });

  // Get user preferences
  const { data: preferences } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: userPreferencesAPI.getPreferences,
  });

  // Set preferences when data loads
  useEffect(() => {
    if (preferences) {
      const prefs = preferences as any;
      setQuizWordCount(prefs.quiz_word_count || 5);
      setDailyGoal(prefs.daily_goal || 10);
      setSessionLength(prefs.session_length || 10);
    }
  }, [preferences]);

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: userPreferencesAPI.updatePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      toast.success(t('messages.settingsUpdateSuccess'));
    },
    onError: (error) => {
      console.error('Failed to update preferences:', error);
      toast.error(t('messages.settingsUpdateFailed'));
    }
  });

  // Update language mutation
  const updateLanguageMutation = useMutation({
    mutationFn: ({ languageCode }: { languageCode: string }) =>
      setMainLanguage(languageCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast.success('Language updated successfully!');
    },
    onError: (error) => {
      console.error('Failed to update language:', error);
      toast.error(t('messages.languageUpdateFailed'));
    }
  });

  // Handle language change
  const handleLanguageChange = (languageCode: string) => {
    setSelectedLanguage(languageCode);
    if (languageCode !== 'clear') {
      updateLanguageMutation.mutate({ languageCode });
    }
  };

  // Handle quiz word count change
  const handleQuizWordCountChange = (count: number) => {
    setQuizWordCount(count);
    updatePreferencesMutation.mutate({ quiz_word_count: count });
  };

  // Handle daily goal change
  const handleDailyGoalChange = (goal: number) => {
    setDailyGoal(goal);
    updatePreferencesMutation.mutate({ daily_goal: goal });
  };

  // Handle session length change
  const handleSessionLengthChange = (length: number) => {
    setSessionLength(length);
    updatePreferencesMutation.mutate({ session_length: length });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {t('page.title')}
        </h1>
        <p className="text-gray-600">
          Customize your learning experience and app preferences
        </p>
      </div>

      {/* Language Preferences */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <GlobeAltIcon className="h-5 w-5 mr-2" />
          {t('sections.languagePreferences')}
        </h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('language.interfaceLanguage')}
          </label>
          <select
            value={selectedLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="w-full md:w-64 border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="en">{t('language.languages.english')}</option>
            <option value="ru">{t('language.languages.russian')}</option>
            <option value="kk">{t('language.languages.kazakh')}</option>
            {(languages as any[]).map((language: any) => (
              <option key={language.id} value={language.language_code}>
                {language.language_name}
              </option>
            ))}
            <option value="clear">{t('language.clearPreference')}</option>
          </select>
          <p className="text-sm text-gray-500 mt-1">
            {t('language.description')}
          </p>
        </div>
      </div>

      {/* Quiz Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <AcademicCapIcon className="h-5 w-5 mr-2" />
          {t('sections.quizSettings')}
        </h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('quiz.defaultWordCount')}
          </label>
          <select
            value={quizWordCount}
            onChange={(e) => handleQuizWordCountChange(parseInt(e.target.value))}
            className="w-full md:w-48 border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={updatePreferencesMutation.isPending}
          >
            <option value={5}>{t('quiz.wordCounts.5words')}</option>
            <option value={10}>{t('quiz.wordCounts.10words')}</option>
            <option value={15}>{t('quiz.wordCounts.15words')}</option>
            <option value={20}>{t('quiz.wordCounts.20words')}</option>
            <option value={25}>{t('quiz.wordCounts.25words')}</option>
            <option value={30}>{t('quiz.wordCounts.30words')}</option>
          </select>
          <p className="text-sm text-gray-500 mt-1">
            {t('quiz.description')}
          </p>
        </div>
      </div>

      {/* Learning Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Cog6ToothIcon className="h-5 w-5 mr-2" />
          {t('sections.learningSettings')}
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('learning.dailyGoal')}
            </label>
            <select 
              value={dailyGoal}
              onChange={(e) => handleDailyGoalChange(parseInt(e.target.value))}
              className="w-full md:w-48 border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={updatePreferencesMutation.isPending}
            >
              <option value={5}>{t('learning.goals.5words')}</option>
              <option value={10}>{t('learning.goals.10words')}</option>
              <option value={15}>{t('learning.goals.15words')}</option>
              <option value={20}>{t('learning.goals.20words')}</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('learning.sessionLength')}
            </label>
            <select 
              value={sessionLength}
              onChange={(e) => handleSessionLengthChange(parseInt(e.target.value))}
              className="w-full md:w-48 border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={updatePreferencesMutation.isPending}
            >
              <option value={10}>{t('learning.sessions.10words')}</option>
              <option value={15}>{t('learning.sessions.15words')}</option>
              <option value={20}>{t('learning.sessions.20words')}</option>
              <option value={25}>{t('learning.sessions.25words')}</option>
            </select>
          </div>
        </div>
        
        <p className="text-sm text-gray-500 mt-4">
          {t('learning.comingSoon')}
        </p>
      </div>

      {/* Notification Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <BellIcon className="h-5 w-5 mr-2" />
          {t('sections.notifications')}
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">
                {t('notifications.dailyReminders.title')}
              </h4>
              <p className="text-sm text-gray-500">
                {t('notifications.dailyReminders.description')}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                disabled
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">
                {t('notifications.reviewReminders.title')}
              </h4>
              <p className="text-sm text-gray-500">
                {t('notifications.reviewReminders.description')}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                disabled
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">
                {t('notifications.achievementNotifications.title')}
              </h4>
              <p className="text-sm text-gray-500">
                {t('notifications.achievementNotifications.description')}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                disabled
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
        
        <p className="text-sm text-gray-500 mt-4">
          {t('notifications.comingSoon')}
        </p>
      </div>
    </div>
  );
};

export default SettingsPage;