// src/pages/profile/ProfilePage.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { UserIcon, AcademicCapIcon } from '@heroicons/react/24/outline';

const ProfilePage: React.FC = () => {
  const { t } = useTranslation('profile');
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-gray-600">{t('page.loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('page.title')}</h1>

      {/* Profile Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-6 mb-6">
          <div className="h-20 w-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-2xl">
              {user.username?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{user.full_name || user.username}</h2>
            <p className="text-gray-600">{user.email}</p>
            <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full mt-2 capitalize">
              {user.role}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
              <UserIcon className="h-5 w-5 mr-2" />
              {t('sections.accountDetails')}
            </h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">{t('fields.username')}</dt>
                <dd className="text-gray-900">{user.username}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('fields.email')}</dt>
                <dd className="text-gray-900">{user.email}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('fields.accountType')}</dt>
                <dd className="text-gray-900 capitalize">{user.role}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('fields.status')}</dt>
                <dd className="text-green-600">{t('status.active')}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
              <AcademicCapIcon className="h-5 w-5 mr-2" />
              {t('sections.learningPreferences')}
            </h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">{t('fields.interfaceLanguage')}</dt>
                <dd className="text-gray-900">
                  {user.main_language?.language_name || t('fields.defaultLanguage')}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('fields.memberSince')}</dt>
                <dd className="text-gray-900">
                  {new Date(user.created_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Coming Soon */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          {t('comingSoon.title')}
        </h3>
        <p className="text-blue-700">
          {t('comingSoon.description')}
        </p>
      </div>
    </div>
  );
};

export default ProfilePage;