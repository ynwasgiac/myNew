// src/pages/learning/GuidedLearningPage.tsx - ИСПРАВЛЕНО для использования существующего learning-module

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  Map, 
  Play, 
  BookOpen, 
  Users, 
  Home, 
  Car,
  Heart,
  Utensils,
  GraduationCap,
  Briefcase,
  Clock,
  CheckCircle,
  Plus,
  Search,
  TrendingUp
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import api from '../../services/api';
import { invalidateLearningModuleCaches } from '../../utils/learningCacheUtils';

// Types
interface Guide {
  id: number;
  title: string;
  description: string;
  icon: string;
  color: string;
  difficulty: string;
  estimated_time: string;
  word_count: number;
  topics: string[];
  keywords: string[];
  status: string;
  progress: {
    words_completed: number;
    total_words_added: number;
    completion_percentage: number;
  };
  last_accessed?: string;
}

// Icon mapping
const iconMap: Record<string, React.ComponentType<any>> = {
  'Users': Users,
  'Heart': Heart,
  'Home': Home,
  'Utensils': Utensils,
  'Car': Car,
  'Briefcase': Briefcase,
  'GraduationCap': GraduationCap,
  'Clock': Clock,
  'BookOpen': BookOpen,
};

// API functions
const fetchGuides = async (): Promise<Guide[]> => {
  const response = await api.get('/learning/guides');
  return response.data;
};

const startGuide = async (guideId: number) => {
  const response = await api.post(`/learning/guides/${guideId}/start`);
  return response.data;
};

// Progress indicator component
const ProgressIndicator: React.FC<{ guide: Guide }> = ({ guide }) => {
  const { progress } = guide;
  
  if (guide.status === 'not_started' || progress.total_words_added === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Прогресс изучения</span>
        <span className="font-medium text-gray-900">
          {progress.words_completed}/{progress.total_words_added} слов
        </span>
      </div>
      
      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(progress.completion_percentage, 100)}%` }}
        />
      </div>
      
      <div className="flex items-center text-xs text-gray-500">
        <TrendingUp className="h-3 w-3 mr-1" />
        <span>{Math.round(progress.completion_percentage)}% завершено</span>
      </div>
    </div>
  );
};

const GuidedLearningPage = () => {
  const { t } = useTranslation(['guides', 'learning']);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch guides from database with progress sync
  const { data: guides = [], isLoading, error } = useQuery({
    queryKey: ['learning-guides', selectedDifficulty],
    queryFn: async () => {
      // First fetch guides
      const guidesData = await fetchGuides();
      
      // Sync progress for guides that are in progress
      for (const guide of guidesData) {
        if (guide.status === 'in_progress' && guide.progress.total_words_added > 0) {
          try {
            await api.post(`/learning/guides/${guide.id}/sync-progress`);
          } catch (error) {
            console.error(`Failed to sync progress for guide ${guide.id}:`, error);
          }
        }
      }
      
      // Re-fetch guides with updated progress
      return await fetchGuides();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Start guide mutation
  const startGuideMutation = useMutation({
    mutationFn: startGuide,
    onSuccess: async (data) => {
      toast.success(`${data.guide_title} started! Added ${data.words_added} new words.`);
      
      // ✅ Устанавливаем флаг для принудительного обновления в LearningModulePage
      sessionStorage.setItem('refreshLearningData', 'true');
      
      // ✅ Используем утилиту для инвалидации всех кэшей
      try {
        await invalidateLearningModuleCaches(queryClient);
        console.log('✅ All learning caches invalidated successfully');
        
        navigate('/app/learning-module');
      } catch (error) {
        console.error('❌ Error invalidating caches:', error);
        navigate('/app/learning-module');
        toast('If you don\'t see new words, please refresh the page.');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to start guide');
    },
  });

  // Handle start guide - добавляет слова в WANT_TO_LEARN и перенаправляет
  const handleStartGuide = async (guideId: number) => {
    if (!user) {
      toast.error('Please login to start learning');
      return;
    }

    startGuideMutation.mutate(guideId);
  };

  // Handle view guide details - для уже начатых гайдов
  const handleViewGuide = (guideId: number) => {
    // Если гайд уже начат, сразу идем в learning-module для продолжения обучения
    navigate('/app/learning-module');
  };

  // Filter guides
  const filteredGuides = guides.filter((guide: Guide) => {
    const matchesDifficulty = selectedDifficulty === 'all' || guide.difficulty === selectedDifficulty;
    const matchesSearch = !searchTerm || 
      guide.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      guide.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      guide.topics.some((topic: string) => topic.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesDifficulty && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <div className="max-w-7xl mx-auto">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t('learning:error.loadFailed', 'Failed to load guides')}
            </h2>
            <p className="text-gray-600">
              {t('learning:error.tryAgain', 'Please try again later')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative max-w-7xl mx-auto py-16 px-6">
          <div className="text-center">
            <Map className="h-16 w-16 text-white mx-auto mb-6" />
            <h1 className="text-4xl font-bold mb-4">
              {t('guides:header.title', 'Learning Guides')}
            </h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              {t('guides:header.subtitle', 'Structured learning paths to help you master Kazakh vocabulary effectively')}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-8 px-6">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={t('guides:search.placeholder', 'Search guides...')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Difficulty Filter */}
            <div className="flex space-x-2">
              {['all', 'beginner', 'intermediate', 'advanced'].map((difficulty) => (
                <button
                  key={difficulty}
                  onClick={() => setSelectedDifficulty(difficulty)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedDifficulty === difficulty
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {t(`guides:difficulty.${difficulty}`, difficulty.charAt(0).toUpperCase() + difficulty.slice(1))}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Guides Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGuides.map((guide: Guide) => {
            const IconComponent = iconMap[guide.icon] || BookOpen;
            
            return (
              <div
                key={guide.id}
                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300"
              >
                {/* Header */}
                <div className={`p-6 ${guide.color} text-white`}>
                  <div className="flex items-center justify-between">
                    <IconComponent className="h-8 w-8" />
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      guide.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                      guide.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {t(`guides:difficulty.${guide.difficulty}`, guide.difficulty)}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mt-4 mb-2">{guide.title}</h3>
                  <p className="text-sm text-white/90">{guide.description}</p>
                </div>

                {/* Content */}
                <div className="p-6">
                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>{guide.estimated_time}</span>
                    </div>
                    <div className="flex items-center">
                      <BookOpen className="h-4 w-4 mr-1" />
                      <span>{guide.word_count} words</span>
                    </div>
                  </div>

                  {/* Topics */}
                  {guide.topics.length > 0 && (
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-1">
                        {guide.topics.slice(0, 3).map((topic, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-md"
                          >
                            {topic}
                          </span>
                        ))}
                        {guide.topics.length > 3 && (
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-md">
                            +{guide.topics.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Progress Indicator */}
                  {guide.status !== 'not_started' && guide.progress.total_words_added > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Прогресс изучения</span>
                        <span className="font-medium text-gray-900">
                          {guide.progress.words_completed}/{guide.progress.total_words_added} слов
                        </span>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(guide.progress.completion_percentage, 100)}%` }}
                        />
                      </div>
                      
                      <div className="flex items-center text-xs text-gray-500">
                        <span>{Math.round(guide.progress.completion_percentage)}% завершено</span>
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="mt-6">
                    {guide.status === 'not_started' ? (
                      <button
                        onClick={() => handleStartGuide(guide.id)}
                        disabled={startGuideMutation.isPending}
                        className={`w-full flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-colors ${
                          startGuideMutation.isPending
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        {startGuideMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            {t('guides:actions.starting', 'Starting...')}
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            {t('guides:actions.start', 'Start Learning')}
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleViewGuide(guide.id)}
                        className="w-full flex items-center justify-center px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {guide.status === 'completed' 
                          ? t('guides:actions.completed', 'Completed') 
                          : t('guides:actions.continue', 'Continue Learning')
                        }
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredGuides.length === 0 && (
          <div className="text-center py-12">
            <Map className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('guides:empty.title', 'No guides found')}
            </h3>
            <p className="text-gray-600">
              {searchTerm || selectedDifficulty !== 'all' 
                ? t('guides:empty.filtered', 'Try adjusting your filters')
                : t('guides:empty.none', 'No learning guides available yet')
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuidedLearningPage;