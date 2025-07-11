// src/pages/profile/SettingsPage.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { languagesAPI } from '../../services/api';
import { Cog6ToothIcon, GlobeAltIcon, BellIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';

const SettingsPage: React.FC = () => {
  const { t } = useTranslation('settings');
  const { user, setMainLanguage, clearMainLanguage } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState(user?.main_language?.language_code || 'en');

  const { data: languages } = useQuery({
    queryKey: ['languages'],
    queryFn: () => languagesAPI.getLanguages(),
  });

  const handleLanguageChange = async (languageCode: string) => {
    try {
      if (languageCode === 'clear') {
        await clearMainLanguage();
        setSelectedLanguage('en');
      } else {
        await setMainLanguage(languageCode);
        setSelectedLanguage(languageCode);
      }
    } catch (error) {
      toast.error(t('messages.languageUpdateFailed'));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('page.title')}</h1>

      {/* Language Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <GlobeAltIcon className="h-5 w-5 mr-2" />
          {t('sections.languagePreferences')}
        </h3>
        
        <div className="space-y-4">
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
              {languages?.map((language) => (
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
            <input
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              defaultChecked
            />
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
            <input
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              defaultChecked
            />
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
            <input
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              defaultChecked
            />
          </div>
        </div>
        
        <p className="text-sm text-gray-500 mt-4">
          {t('notifications.comingSoon')}
        </p>
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
            <select className="w-full md:w-48 border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="5">{t('learning.goals.5words')}</option>
              <option value="10" selected>{t('learning.goals.10words')}</option>
              <option value="15">{t('learning.goals.15words')}</option>
              <option value="20">{t('learning.goals.20words')}</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('learning.sessionLength')}
            </label>
            <select className="w-full md:w-48 border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="10" selected>{t('learning.sessions.10words')}</option>
              <option value="15">{t('learning.sessions.15words')}</option>
              <option value="20">{t('learning.sessions.20words')}</option>
              <option value="25">{t('learning.sessions.25words')}</option>
            </select>
          </div>
        </div>
        
        <p className="text-sm text-gray-500 mt-4">
          {t('learning.comingSoon')}
        </p>
      </div>
    </div>
  );
};

export default SettingsPage;