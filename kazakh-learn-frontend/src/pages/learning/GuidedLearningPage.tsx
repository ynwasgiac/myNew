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
import api from '../../services/api';  // ✅ Use global API instance

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

// Simple API functions using global api instance
const fetchGuides = async (difficulty?: string, languageCode?: string) => {
  const params = new URLSearchParams();
  if (difficulty && difficulty !== 'all') {
    params.append('difficulty', difficulty);
  }
  if (languageCode) {
    params.append('language_code', languageCode);
  }

  const response = await api.get(`/learning/guides?${params}`);
  return response.data;
};

const startGuide = async (guideId: string) => {
  const response = await api.post(`/learning/guides/${guideId}/start`);
  return response.data;
};

const GuidedLearningPage = () => {
  const { t } = useTranslation(['learning', 'guides']);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Get user's language preference
  const userLanguage = user?.main_language?.language_code || 'en';

  // Fetch guides from database with user's language
  const { data: guides = [], isLoading, error } = useQuery({
    queryKey: ['learning-guides', selectedDifficulty, userLanguage],
    queryFn: () => fetchGuides(selectedDifficulty, userLanguage),
    staleTime: 5 * 60 * 1000,
    retry: 2
  });

  // Start guide mutation
  const startGuideMutation = useMutation({
    mutationFn: startGuide,
    onSuccess: (data, guideId) => {
      queryClient.invalidateQueries({ queryKey: ['learning-guides'] });
      queryClient.invalidateQueries({ queryKey: ['learning-stats'] });
      
      toast.success(`Путеводитель "${data.guide_title}" начат! Добавлено ${data.words_added} слов.`);
      navigate(`/app/practice?type=learning&guide=${guideId}`);
    },
    onError: (error: Error) => {
      console.error('Error starting guide:', error);
      toast.error(error.message || 'Не удалось начать путеводитель');
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

  // Filter guides based on search term
  const filteredGuides = guides.filter((guide: any) => {
    const matchesSearch = !searchTerm || 
      guide.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      guide.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      guide.topics.some((topic: string) => topic.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesSearch;
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Завершен';
      case 'in_progress': return 'В процессе';
      default: return 'Не начат';
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Загрузка путеводителей..." />;
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Ошибка загрузки
          </h3>
          <p className="text-gray-600 mb-4">
            Не удалось загрузить путеводители
          </p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['learning-guides'] })}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Map className="w-8 h-8 text-blue-500" />
          <h1 className="text-3xl font-bold text-gray-900">
            Путеводители по изучению
          </h1>
          {/* Language indicator */}
          {userLanguage && userLanguage !== 'en' && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              {userLanguage.toUpperCase()}
            </span>
          )}
        </div>
        <p className="text-gray-600 max-w-3xl">
          Структурированные коллекции слов по темам. Каждый путеводитель поможет вам выучить необходимую лексику для конкретных ситуаций.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Поиск путеводителей..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Difficulty filter */}
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Все уровни</option>
            <option value="beginner">Начинающий</option>
            <option value="intermediate">Средний</option>
            <option value="advanced">Продвинутый</option>
          </select>
        </div>
      </div>

      {/* Guides Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGuides.map((guide: any) => {
          const IconComponent = iconMap[guide.icon as keyof typeof iconMap] || BookOpen;
          const progressPercentage = guide.progress?.completion_percentage || 0;
          const isStarted = guide.status !== 'not_started';
          const isCompleted = guide.status === 'completed';

          return (
            <div key={guide.id} className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="flex items-start gap-4 mb-4">
                <div className={`p-3 rounded-lg bg-${guide.color}-100`}>
                  <IconComponent className={`w-6 h-6 text-${guide.color}-600`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {guide.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {guide.description}
                  </p>
                </div>
              </div>

              {/* Metadata */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(guide.difficulty)}`}>
                  {guide.difficulty}
                </span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                  {guide.word_count} слов
                </span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  {guide.estimated_time}
                </span>
              </div>

              {/* Progress */}
              {isStarted && (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">
                      Прогресс
                    </span>
                    <span className={`text-sm font-medium ${getStatusColor(guide.status)}`}>
                      {getStatusText(guide.status)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`bg-${guide.color}-600 h-2 rounded-full transition-all duration-300`}
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>
                      {guide.progress?.words_completed || 0} / {guide.progress?.total_words_added || 0}
                    </span>
                    <span>{Math.round(progressPercentage)}%</span>
                  </div>
                </div>
              )}

              {/* Topics */}
              <div className="mb-4">
                <div className="flex flex-wrap gap-1">
                  {guide.topics?.slice(0, 3).map((topic: string, index: number) => (
                    <span key={index} className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                      {topic}
                    </span>
                  ))}
                  {guide.topics?.length > 3 && (
                    <span className="text-xs text-gray-400">
                      +{guide.topics.length - 3}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {!isStarted ? (
                  <button
                    onClick={() => handleStartGuide(guide)}
                    disabled={startGuideMutation.isPending}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-${guide.color}-600 text-white rounded-md hover:bg-${guide.color}-700 transition-colors disabled:opacity-50`}
                  >
                    <Plus className="w-4 h-4" />
                    {startGuideMutation.isPending ? 'Запуск...' : 'Начать'}
                  </button>
                ) : isCompleted ? (
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => handleContinueGuide(guide)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Повторить
                    </button>
                    <button
                      onClick={() => handleViewGuideWords(guide)}
                      className="px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                    >
                      <BookOpen className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => handleContinueGuide(guide)}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-${guide.color}-600 text-white rounded-md hover:bg-${guide.color}-700 transition-colors`}
                    >
                      <Play className="w-4 h-4" />
                      Продолжить
                    </button>
                    <button
                      onClick={() => handleViewGuideWords(guide)}
                      className="px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                    >
                      <BookOpen className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Last accessed */}
              {guide.last_accessed && (
                <div className="mt-3 text-xs text-gray-400">
                  Последний доступ: {new Date(guide.last_accessed).toLocaleDateString()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {filteredGuides.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🗺️</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm ? 'Путеводители не найдены' : 'Нет доступных путеводителей'}
          </h3>
          <p className="text-gray-600">
            {searchTerm ? 
              'Попробуйте изменить параметры поиска' :
              'Проверьте позже или обратитесь к администратору'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default GuidedLearningPage;