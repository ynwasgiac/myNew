// src/pages/learning/GuidedLearningPage.tsx
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
  Search
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import api from '../../services/api';

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

const GuidedLearningPage = () => {
  const { t } = useTranslation(['guides', 'learning']);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch guides from database
  const { data: guides = [], isLoading, error } = useQuery({
    queryKey: ['learning-guides', selectedDifficulty],
    queryFn: fetchGuides,
    staleTime: 5 * 60 * 1000,
  });

  // Start guide mutation
  const startGuideMutation = useMutation({
    mutationFn: startGuide,
    onSuccess: (data) => {
      toast.success(`${data.guide_title} started! Added ${data.words_added} new words.`);
      queryClient.invalidateQueries({ queryKey: ['learning-guides'] });
      queryClient.invalidateQueries({ queryKey: ['learning-words'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to start guide');
    },
  });

  // Handle start guide
  const handleStartGuide = async (guideId: number) => {
    if (!user) {
      toast.error('Please login to start learning');
      return;
    }

    startGuideMutation.mutate(guideId);
  };

  // Handle view guide details
  const handleViewGuide = (guideId: number) => {
    navigate(`/learning/guides/${guideId}`);
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
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {t('guides:title', 'Learning Guides')}
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {t('guides:subtitle', 'Start your Kazakh learning journey with structured guides')}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder={t('guides:search', 'Search guides...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Difficulty Filter */}
            <div className="sm:w-48">
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">{t('guides:difficulty.all', 'All Levels')}</option>
                <option value="beginner">{t('guides:difficulty.beginner', 'Beginner')}</option>
                <option value="intermediate">{t('guides:difficulty.intermediate', 'Intermediate')}</option>
                <option value="advanced">{t('guides:difficulty.advanced', 'Advanced')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Guides Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGuides.map((guide: Guide) => {
            const IconComponent = iconMap[guide.icon as keyof typeof iconMap] || BookOpen;
            
            return (
              <div
                key={guide.id}
                className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-200 overflow-hidden"
              >
                {/* Header */}
                <div className={`bg-${guide.color}-500 px-6 py-4`}>
                  <div className="flex items-center justify-between">
                    <IconComponent className="h-8 w-8 text-white" />
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-${guide.color}-600 text-white`}>
                      {String(t(`guides:difficulty.${guide.difficulty}`, guide.difficulty))}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {guide.title}
                  </h3>
                  
                  <p className="text-gray-600 mb-4 line-clamp-3">
                    {guide.description}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center justify-between mb-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {guide.estimated_time}
                    </div>
                    <div className="flex items-center">
                      <BookOpen className="h-4 w-4 mr-1" />
                      {guide.word_count} {t('guides:words', 'words')}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {guide.status !== 'not_started' && (
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">
                          {t('guides:progress', 'Progress')}
                        </span>
                        <span className="text-gray-900 font-medium">
                          {guide.progress.completion_percentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`bg-${guide.color}-500 h-2 rounded-full transition-all duration-300`}
                          style={{ width: `${guide.progress.completion_percentage}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {guide.status === 'not_started' ? (
                      <button
                        onClick={() => handleStartGuide(guide.id)}
                        disabled={startGuideMutation.isPending}
                        className={`flex-1 bg-${guide.color}-500 hover:bg-${guide.color}-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center disabled:opacity-50`}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        {startGuideMutation.isPending ? 
                          t('guides:starting', 'Starting...') : 
                          t('guides:start', 'Start Guide')
                        }
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleViewGuide(guide.id)}
                          className={`flex-1 bg-${guide.color}-500 hover:bg-${guide.color}-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200`}
                        >
                          {t('guides:continue', 'Continue')}
                        </button>
                        {guide.status === 'completed' && (
                          <div className="flex items-center justify-center px-3 py-2 bg-green-100 text-green-800 rounded-lg">
                            <CheckCircle className="h-4 w-4" />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Topics */}
                  {guide.topics.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="flex flex-wrap gap-1">
                        {guide.topics.slice(0, 3).map((topic: string, index: number) => (
                          <span
                            key={index}
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-${guide.color}-100 text-${guide.color}-800`}
                          >
                            {topic}
                          </span>
                        ))}
                        {guide.topics.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{guide.topics.length - 3} {t('guides:more', 'more')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredGuides.length === 0 && (
          <div className="text-center py-12">
            <Map className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
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