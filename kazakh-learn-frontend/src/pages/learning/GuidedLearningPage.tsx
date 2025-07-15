// src/pages/learning/GuidedLearningPage.tsx - Updated with localized translations
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

// Icon mapping
const iconMap = {
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
const fetchGuides = async () => {
  const response = await api.get('/learning/guides');
  return response.data;
};

const startGuide = async (guideId: string) => {
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

  // Fetch guides from database (get basic structure, use locales for content)
  const { data: guides = [], isLoading, error } = useQuery({
    queryKey: ['learning-guides', selectedDifficulty],
    queryFn: fetchGuides,
    staleTime: 5 * 60 * 1000,
    retry: 2
  });

  // Start guide mutation
  const startGuideMutation = useMutation({
    mutationFn: startGuide,
    onSuccess: (data, guideId) => {
      queryClient.invalidateQueries({ queryKey: ['learning-guides'] });
      queryClient.invalidateQueries({ queryKey: ['learning-stats'] });
      
      // Use localized title for success message
      const localizedTitle = t(`guides:guides.${guideId}.title`, data.guide_title);
      toast.success(t('guides:messages.guideStarted', { title: localizedTitle }));
      
      navigate(`/app/practice?type=learning&guide=${guideId}`);
    },
    onError: (error: Error) => {
      console.error('Error starting guide:', error);
      toast.error(t('guides:messages.startError'));
    }
  });

  const handleStartGuide = async (guide: any) => {
    try {
      await startGuideMutation.mutateAsync(guide.id);
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleContinueGuide = (guide: any) => {
    navigate(`/app/practice?type=learning&guide=${guide.id}`);
  };

  const handleViewGuideWords = (guide: any) => {
    navigate(`/app/guides/${guide.id}/words`);
  };

  // Helper function to get localized guide content
  const getLocalizedGuide = (guide: any) => {
    const guideKey = guide.id || guide.guide_key;
    return {
      ...guide,
      title: t(`guides:guides.${guideKey}.title`, guide.title),
      description: t(`guides:guides.${guideKey}.description`, guide.description),
      topics: t(`guides:guides.${guideKey}.topics`, { returnObjects: true }) || guide.topics
    };
  };

  // Filter guides based on search term and difficulty
  const filteredGuides = guides
    .filter((guide: any) => {
      // Apply difficulty filter
      if (selectedDifficulty !== 'all' && guide.difficulty !== selectedDifficulty) {
        return false;
      }
      
      // Apply search filter using localized content
      if (!searchTerm) return true;
      
      const localizedGuide = getLocalizedGuide(guide);
      const searchLower = searchTerm.toLowerCase();
      
      return (
        localizedGuide.title.toLowerCase().includes(searchLower) ||
        localizedGuide.description.toLowerCase().includes(searchLower) ||
        (localizedGuide.topics && localizedGuide.topics.some((topic: string) => 
          topic.toLowerCase().includes(searchLower)
        ))
      );
    });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'in_progress': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text={t('guides:messages.loadError')} />;
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {t('guides:messages.loadError')}
          </h3>
          <p className="text-gray-600">
            {t('guides:messages.checkLater')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t('guides:page.title')}
        </h1>
        <p className="text-lg text-gray-600">
          {t('guides:page.description')}
        </p>
      </div>

      {/* Filters and Search */}
      <div className="mb-8 flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder={t('guides:search.placeholder')}
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">{t('guides:difficulty.all')}</option>
            <option value="beginner">{t('guides:difficulty.beginner')}</option>
            <option value="intermediate">{t('guides:difficulty.intermediate')}</option>
            <option value="advanced">{t('guides:difficulty.advanced')}</option>
          </select>
        </div>
      </div>

      {/* Guides Grid */}
      {filteredGuides.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGuides.map((guide: any) => {
            const localizedGuide = getLocalizedGuide(guide);
            const IconComponent = iconMap[guide.icon as keyof typeof iconMap] || BookOpen;
            
            return (
              <div
                key={guide.id}
                className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden"
              >
                {/* Header with Icon and Color */}
                <div 
                  className={`h-32 relative bg-gradient-to-br from-${guide.color}-400 to-${guide.color}-600`}
                  style={{
                    background: `linear-gradient(135deg, var(--color-${guide.color}-400), var(--color-${guide.color}-600))`
                  }}
                >
                  <div className="absolute inset-0 bg-black bg-opacity-10"></div>
                  <div className="relative h-full flex items-center justify-center">
                    <IconComponent className="h-12 w-12 text-white" />
                  </div>
                  
                  {/* Status Badge */}
                  <div className="absolute top-4 right-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full bg-white bg-opacity-20 text-white`}>
                      {t(`guides:status.${guide.status || 'not_started'}`)}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  {/* Title and Difficulty */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
                        {localizedGuide.title}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(guide.difficulty)}`}>
                        {t(`guides:difficulty.${guide.difficulty}`)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {localizedGuide.description}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {guide.estimated_time || '30 мин'}
                    </div>
                    <div className="flex items-center">
                      <BookOpen className="h-4 w-4 mr-1" />
                      {guide.word_count || 20} {t('guides:stats.wordCount')}
                    </div>
                  </div>

                  {/* Progress Bar (if in progress) */}
                  {guide.progress && guide.progress.completion_percentage > 0 && (
                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>{t('guides:stats.progress')}</span>
                        <span>{Math.round(guide.progress.completion_percentage)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`bg-${guide.color}-500 h-2 rounded-full transition-all duration-300`}
                          style={{ width: `${guide.progress.completion_percentage}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {guide.progress.words_completed} / {guide.progress.total_words_added} {t('guides:stats.wordsCompleted')}
                      </p>
                    </div>
                  )}

                  {/* Topics */}
                  {localizedGuide.topics && localizedGuide.topics.length > 0 && (
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-1">
                        {localizedGuide.topics.slice(0, 3).map((topic: string, index: number) => (
                          <span 
                            key={index}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full"
                          >
                            {topic}
                          </span>
                        ))}
                        {localizedGuide.topics.length > 3 && (
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                            +{localizedGuide.topics.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {guide.status === 'not_started' && (
                      <button
                        onClick={() => handleStartGuide(guide)}
                        disabled={startGuideMutation.isPending}
                        className={`flex-1 flex items-center justify-center px-4 py-2 bg-${guide.color}-500 hover:bg-${guide.color}-600 text-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-50`}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        {startGuideMutation.isPending ? t('learning:loading') : t('guides:actions.start')}
                      </button>
                    )}
                    
                    {guide.status === 'in_progress' && (
                      <button
                        onClick={() => handleContinueGuide(guide)}
                        className={`flex-1 flex items-center justify-center px-4 py-2 bg-${guide.color}-500 hover:bg-${guide.color}-600 text-white rounded-lg font-medium transition-colors duration-200`}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        {t('guides:actions.continue')}
                      </button>
                    )}
                    
                    {guide.status === 'completed' && (
                      <button
                        onClick={() => handleViewGuideWords(guide)}
                        className={`flex-1 flex items-center justify-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors duration-200`}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {t('guides:actions.view_words')}
                      </button>
                    )}
                    
                    {/* View Words Button (always available) */}
                    <button
                      onClick={() => handleViewGuideWords(guide)}
                      className="px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                      title={t('guides:actions.view_words')}
                    >
                      <BookOpen className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm ? t('guides:search.noResults') : t('guides:messages.noGuides')}
          </h3>
          <p className="text-gray-600">
            {searchTerm ? 
              t('guides:search.noResultsDescription') :
              t('guides:messages.checkLater')
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default GuidedLearningPage;