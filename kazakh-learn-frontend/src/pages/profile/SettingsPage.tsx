// src/pages/SettingsPage.tsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  UserIcon,
  BellIcon,
  AcademicCapIcon,
  PuzzlePieceIcon,
  ClockIcon,
  ArrowPathIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';

import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import api, { languagesAPI } from '../../services/api';
import type { Language } from '../../types/api';

// Types based on your API schemas
interface NotificationSettings {
  daily_reminders?: boolean;
  review_reminders?: boolean;
  achievement_notifications?: boolean;
  streak_reminders?: boolean;
  goal_reminders?: boolean;
}

interface UserPreferences {
  id: number;
  user_id: number;
  quiz_word_count: number;
  daily_goal: number;
  session_length: number;
  notification_settings: NotificationSettings;
  created_at: string;
  updated_at: string;
}

interface PreferencesUpdateData {
  quiz_word_count?: number;
  daily_goal?: number;
  session_length?: number;
  notification_settings?: NotificationSettings;
}

interface DefaultPreferences {
  quiz_word_count: number;
  daily_goal: number;
  session_length: number;
  notification_settings: NotificationSettings;
}

// API functions
const preferencesAPI = {
  getPreferences: async (): Promise<UserPreferences> => {
    const response = await api.get('/api/preferences/');
    return response.data;
  },

  updatePreferences: async (data: PreferencesUpdateData): Promise<UserPreferences> => {
    const response = await api.put('/api/preferences/', data);
    return response.data;
  },

  updateQuizSettings: async (data: { quiz_word_count: number }): Promise<UserPreferences> => {
    const response = await api.patch('/api/preferences/quiz-settings', data);
    return response.data;
  },

  updateLearningSettings: async (data: { daily_goal?: number; session_length?: number }): Promise<UserPreferences> => {
    const response = await api.patch('/api/preferences/learning-settings', data);
    return response.data;
  },

  updateNotificationSettings: async (data: NotificationSettings): Promise<UserPreferences> => {
    const response = await api.patch('/api/preferences/notifications', data);
    return response.data;
  },

  resetToDefault: async (): Promise<UserPreferences> => {
    const response = await api.post('/api/preferences/reset-to-default');
    return response.data;
  },

  getDefaultValues: async (): Promise<DefaultPreferences> => {
    const response = await api.get('/api/preferences/default-values');
    return response.data;
  },

  deletePreferences: async (): Promise<void> => {
    await api.delete('/api/preferences/');
  },
};

const SettingsPage: React.FC = () => {
  const { user, setMainLanguage, clearMainLanguage } = useAuth();
  const queryClient = useQueryClient();
  
  // State management
  const [activeSection, setActiveSection] = useState<'profile' | 'language' | 'learning' | 'quiz' | 'notifications'>('language');
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Fetch available languages
  const { data: languages = [] } = useQuery<Language[]>({
    queryKey: ['languages'],
    queryFn: () => languagesAPI.getLanguages(),
    retry: 1,
  });

  // Fetch user preferences
  const {
    data: preferences,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: preferencesAPI.getPreferences,
    retry: 1,
  });

  // Fetch default values for display
  const { data: defaultValues } = useQuery({
    queryKey: ['default-preferences'],
    queryFn: preferencesAPI.getDefaultValues,
    retry: 1,
  });

  // Update language mutations
  const updateLanguageMutation = useMutation({
    mutationFn: (languageCode: string) => setMainLanguage(languageCode),
    onSuccess: () => {
      toast.success('Language preference updated successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to update language: ${error.response?.data?.detail || error.message}`);
    },
  });

  const clearLanguageMutation = useMutation({
    mutationFn: clearMainLanguage,
    onSuccess: () => {
      toast.success('Language preference cleared');
    },
    onError: (error: any) => {
      toast.error(`Failed to clear language: ${error.response?.data?.detail || error.message}`);
    },
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: preferencesAPI.updatePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      toast.success('Preferences updated successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to update preferences: ${error.response?.data?.detail || error.message}`);
    },
  });

  // Update quiz settings mutation
  const updateQuizMutation = useMutation({
    mutationFn: preferencesAPI.updateQuizSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      toast.success('Quiz settings updated successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to update quiz settings: ${error.response?.data?.detail || error.message}`);
    },
  });

  // Update learning settings mutation
  const updateLearningMutation = useMutation({
    mutationFn: preferencesAPI.updateLearningSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      toast.success('Learning settings updated successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to update learning settings: ${error.response?.data?.detail || error.message}`);
    },
  });

  // Update notification settings mutation
  const updateNotificationsMutation = useMutation({
    mutationFn: preferencesAPI.updateNotificationSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      toast.success('Notification settings updated successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to update notification settings: ${error.response?.data?.detail || error.message}`);
    },
  });

  // Reset to default mutation
  const resetMutation = useMutation({
    mutationFn: preferencesAPI.resetToDefault,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      toast.success('Settings reset to defaults successfully');
      setShowResetModal(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to reset settings: ${error.response?.data?.detail || error.message}`);
    },
  });

  // Delete preferences mutation
  const deleteMutation = useMutation({
    mutationFn: preferencesAPI.deletePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      toast.success('Preferences deleted successfully. Defaults will be used.');
      setShowDeleteModal(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to delete preferences: ${error.response?.data?.detail || error.message}`);
    },
  });

  // Handle language changes
  const handleLanguageChange = (languageCode: string) => {
    if (languageCode === 'clear') {
      clearLanguageMutation.mutate();
    } else {
      updateLanguageMutation.mutate(languageCode);
    }
  };

  // Handle updates
  const handleQuizWordCountChange = (value: number) => {
    if (value >= 1 && value <= 50) {
      updateQuizMutation.mutate({ quiz_word_count: value });
    }
  };

  const handleDailyGoalChange = (value: number) => {
    if (value >= 1 && value <= 100) {
      updateLearningMutation.mutate({ daily_goal: value });
    }
  };

  const handleSessionLengthChange = (value: number) => {
    if (value >= 5 && value <= 60) {
      updateLearningMutation.mutate({ session_length: value });
    }
  };

  const handleNotificationToggle = (key: keyof NotificationSettings, value: boolean) => {
    const currentSettings = preferences?.notification_settings || {};
    updateNotificationsMutation.mutate({
      ...currentSettings,
      [key]: value,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircleIcon className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Failed to load settings</h3>
          <p className="mt-1 text-sm text-gray-500">
            {(error as any)?.response?.data?.detail || (error as Error).message}
          </p>
          <div className="mt-6">
            <Button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['user-preferences'] })}
              variant="primary"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Settings
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Customize your learning experience and preferences
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">
            <Button
              onClick={() => setShowResetModal(true)}
              variant="secondary"
              className="inline-flex items-center"
            >
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
            <Button
              onClick={() => setShowDeleteModal(true)}
              variant="danger"
              className="inline-flex items-center"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete Preferences
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <nav className="space-y-1">
              {[
                { id: 'profile', name: 'Profile', icon: UserIcon },
                { id: 'language', name: 'Language', icon: GlobeAltIcon },
                { id: 'learning', name: 'Learning', icon: AcademicCapIcon },
                { id: 'quiz', name: 'Quiz Settings', icon: PuzzlePieceIcon },
                { id: 'notifications', name: 'Notifications', icon: BellIcon },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id as any)}
                  className={`w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeSection === item.id
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 transition-colors ${
                      activeSection === item.id ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                    }`}
                  />
                  {item.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white shadow rounded-lg">
              {/* Profile Section */}
              {activeSection === 'profile' && (
                <div className="p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Profile Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Username</label>
                      <div className="mt-1 p-3 bg-gray-50 rounded-md">
                        <span className="text-sm text-gray-900">{user?.username}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <div className="mt-1 p-3 bg-gray-50 rounded-md">
                        <span className="text-sm text-gray-900">{user?.email}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Role</label>
                      <div className="mt-1 p-3 bg-gray-50 rounded-md">
                        <span className="text-sm text-gray-900 capitalize">{user?.role}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Main Language</label>
                      <div className="mt-1 p-3 bg-gray-50 rounded-md">
                        <span className="text-sm text-gray-900">
                          {user?.main_language ? `${user.main_language.language_name} (${user.main_language.language_code})` : 'Not set'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Language Section */}
              {activeSection === 'language' && (
                <div className="p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Language Preferences
                  </h3>
                  <div className="space-y-6">
                    {/* Current Language Display */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Current Language
                      </label>
                      <div className="p-3 bg-gray-50 rounded-md">
                        <span className="text-sm text-gray-900">
                          {user?.main_language 
                            ? `${user.main_language.language_name} (${user.main_language.language_code.toUpperCase()})`
                            : 'No language preference set (using default)'
                          }
                        </span>
                      </div>
                    </div>

                    {/* Language Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Interface Language
                      </label>
                      <select
                        value={user?.main_language?.language_code || ''}
                        onChange={(e) => handleLanguageChange(e.target.value)}
                        disabled={updateLanguageMutation.isPending || clearLanguageMutation.isPending}
                        className="w-full md:w-64 border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Choose a language...</option>
                        {languages.map((lang: Language) => (
                          <option key={lang.language_code} value={lang.language_code}>
                            {lang.language_name} ({lang.language_code.toUpperCase()})
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-sm text-gray-500">
                        This will be your default language for the interface
                      </p>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                      <div className="flex">
                        <GlobeAltIcon className="h-5 w-5 text-blue-400" />
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-blue-800">
                            Language Settings
                          </h4>
                          <p className="mt-1 text-sm text-blue-700">
                            Your language preference affects the interface language and determines 
                            which translations are shown by default. You can change this at any time.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Learning Settings */}
              {activeSection === 'learning' && preferences && (
                <div className="p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Learning Preferences
                  </h3>
                  <div className="space-y-6">
                    {/* Daily Goal */}
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700">
                          Daily Learning Goal
                        </label>
                        <span className="text-sm text-gray-500">
                          Current: {preferences.daily_goal} words
                          {defaultValues && (
                            <span className="ml-2 text-xs text-gray-400">
                              (Default: {defaultValues.daily_goal})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="mt-2">
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={preferences.daily_goal}
                          onChange={(e) => handleDailyGoalChange(parseInt(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                          disabled={updateLearningMutation.isPending}
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>1</span>
                          <span>50</span>
                          <span>100</span>
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        Number of words to learn per day
                      </p>
                    </div>

                    {/* Session Length */}
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700">
                          Session Length
                        </label>
                        <span className="text-sm text-gray-500">
                          Current: {preferences.session_length} minutes
                          {defaultValues && (
                            <span className="ml-2 text-xs text-gray-400">
                              (Default: {defaultValues.session_length})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="mt-2">
                        <input
                          type="range"
                          min="5"
                          max="60"
                          value={preferences.session_length}
                          onChange={(e) => handleSessionLengthChange(parseInt(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                          disabled={updateLearningMutation.isPending}
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>5 min</span>
                          <span>30 min</span>
                          <span>60 min</span>
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        Preferred length for learning sessions
                      </p>
                    </div>

                    {/* Last Updated */}
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex items-center text-sm text-gray-500">
                        <ClockIcon className="h-4 w-4 mr-2" />
                        Last updated: {new Date(preferences.updated_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Quiz Settings */}
              {activeSection === 'quiz' && preferences && (
                <div className="p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Quiz Configuration
                  </h3>
                  <div className="space-y-6">
                    {/* Quiz Word Count */}
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700">
                          Words Per Quiz
                        </label>
                        <span className="text-sm text-gray-500">
                          Current: {preferences.quiz_word_count} words
                          {defaultValues && (
                            <span className="ml-2 text-xs text-gray-400">
                              (Default: {defaultValues.quiz_word_count})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="mt-2">
                        <input
                          type="range"
                          min="1"
                          max="50"
                          value={preferences.quiz_word_count}
                          onChange={(e) => handleQuizWordCountChange(parseInt(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                          disabled={updateQuizMutation.isPending}
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>1</span>
                          <span>25</span>
                          <span>50</span>
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        Number of words to include in each quiz session
                      </p>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                      <div className="flex">
                        <QuestionMarkCircleIcon className="h-5 w-5 text-blue-400" />
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-blue-800">
                            Quiz Tips
                          </h4>
                          <p className="mt-1 text-sm text-blue-700">
                            Start with fewer words (5-10) if you're new to learning. 
                            Increase the count as you become more comfortable with the vocabulary.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications */}
              {activeSection === 'notifications' && preferences && (
                <div className="p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Notification Preferences
                  </h3>
                  <div className="space-y-4">
                    {Object.entries({
                      daily_reminders: {
                        title: 'Daily Reminders',
                        description: 'Get reminded to practice daily'
                      },
                      review_reminders: {
                        title: 'Review Reminders',
                        description: 'Reminders to review learned words'
                      },
                      achievement_notifications: {
                        title: 'Achievement Notifications',
                        description: 'Notifications for completed goals and milestones'
                      },
                      streak_reminders: {
                        title: 'Streak Reminders',
                        description: 'Reminders to maintain your learning streak'
                      },
                      goal_reminders: {
                        title: 'Goal Reminders',
                        description: 'Reminders about your daily learning goals'
                      },
                    }).map(([key, config]) => (
                      <div key={key} className="flex items-center justify-between py-3">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900">
                            {config.title}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {config.description}
                          </p>
                        </div>
                        <div className="ml-4">
                          <button
                            type="button"
                            onClick={() => handleNotificationToggle(
                              key as keyof NotificationSettings,
                              !preferences.notification_settings[key as keyof NotificationSettings]
                            )}
                            disabled={updateNotificationsMutation.isPending}
                            className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                              preferences.notification_settings[key as keyof NotificationSettings]
                                ? 'bg-blue-600'
                                : 'bg-gray-200'
                            } ${updateNotificationsMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
                                preferences.notification_settings[key as keyof NotificationSettings]
                                  ? 'translate-x-5'
                                  : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Reset to Defaults"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Are you sure you want to reset all your preferences to their default values? 
            This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-3">
            <Button
              onClick={() => setShowResetModal(false)}
              variant="secondary"
              disabled={resetMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => resetMutation.mutate()}
              variant="danger"
              disabled={resetMutation.isPending}
              className="inline-flex items-center"
            >
              {resetMutation.isPending && (
                <div className="mr-2">
                  <LoadingSpinner size="sm" />
                </div>
              )}
              Reset Settings
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Preferences"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Are you sure you want to delete your preferences? Default settings will be 
            used for your account. You can create new preferences at any time.
          </p>
          <div className="flex justify-end space-x-3">
            <Button
              onClick={() => setShowDeleteModal(false)}
              variant="secondary"
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => deleteMutation.mutate()}
              variant="danger"
              disabled={deleteMutation.isPending}
              className="inline-flex items-center"
            >
              {deleteMutation.isPending && (
                <div className="mr-2">
                  <LoadingSpinner size="sm" />
                </div>
              )}
              Delete Preferences
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SettingsPage;