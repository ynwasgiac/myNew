import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  Map, 
  Star, 
  Play, 
  BookOpen, 
  Users, 
  Coffee, 
  Home, 
  Car,
  Heart,
  Globe,
  Utensils,
  GraduationCap,
  Briefcase,
  Clock,
  Target,
  CheckCircle,
  Plus
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import { wordsAPI } from '../../services/api';
import { learningAPI } from '../../services/learningAPI';
import type { KazakhWordSummary } from '../../types/api';
import { LEARNING_STATUSES } from '../../types/learning';
import { useAuth } from '../../contexts/AuthContext'; // Добавляем импорт useAuth
import LoadingSpinner from '../../components/ui/LoadingSpinner';

// Типы для путеводителей
interface LearningGuide {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  wordCount: number;
  topics: string[];
  keywords: string[]; // Ключевые слова для поиска в базе
}

interface GuideProgress {
  guideId: string;
  completedWords: number;
  totalWords: number;
  isStarted: boolean;
  isCompleted: boolean;
}

const GuidedLearningPage: React.FC = () => {
  const { t } = useTranslation(['learning', 'guides']);
  const { user } = useAuth(); // Добавляем user из useAuth
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Предопределенные путеводители
  const learningGuides: LearningGuide[] = [
    {
      id: 'greetings',
      title: t('guides.greetings.title', 'Приветствие и знакомство'),
      description: t('guides.greetings.description', 'Основные фразы для знакомства и приветствия'),
      icon: Users,
      color: 'blue',
      difficulty: 'beginner',
      estimatedTime: '15-20 мин',
      wordCount: 15,
      topics: ['Приветствие', 'Знакомство', 'Вежливость'],
      keywords: ['сәлем', 'кешіріңіз', 'рахмет', 'қоштасу', 'таныстыру']
    },
    {
      id: 'family',
      title: t('guides.family.title', 'Семья и родственники'),
      description: t('guides.family.description', 'Слова для описания семейных отношений'),
      icon: Heart,
      color: 'red',
      difficulty: 'beginner',
      estimatedTime: '20-25 мин',
      wordCount: 20,
      topics: ['Семья', 'Родственники', 'Отношения'],
      keywords: ['отбасы', 'ата', 'ана', 'бала', 'туыс', 'жұбайлас']
    },
    {
      id: 'home',
      title: t('guides.home.title', 'Дом и быт'),
      description: t('guides.home.description', 'Предметы домашнего обихода и комнаты'),
      icon: Home,
      color: 'green',
      difficulty: 'beginner',
      estimatedTime: '25-30 мин',
      wordCount: 25,
      topics: ['Дом', 'Мебель', 'Комнаты', 'Быт'],
      keywords: ['үй', 'бөлме', 'жиһаз', 'ас үй', 'жатын бөлме']
    },
    {
      id: 'food',
      title: t('guides.food.title', 'Еда и напитки'),
      description: t('guides.food.description', 'Названия блюд, продуктов и напитков'),
      icon: Utensils,
      color: 'orange',
      difficulty: 'intermediate',
      estimatedTime: '30-35 мин',
      wordCount: 30,
      topics: ['Еда', 'Напитки', 'Кухня', 'Рестораны'],
      keywords: ['тамақ', 'ас', 'сусын', 'нан', 'ет', 'көкөніс']
    },
    {
      id: 'transport',
      title: t('guides.transport.title', 'Транспорт и путешествия'),
      description: t('guides.transport.description', 'Виды транспорта и слова для поездок'),
      icon: Car,
      color: 'purple',
      difficulty: 'intermediate',
      estimatedTime: '25-30 мин',
      wordCount: 22,
      topics: ['Транспорт', 'Путешествия', 'Дорога'],
      keywords: ['көлік', 'жол', 'саяхат', 'аэропорт', 'автобус']
    },
    {
      id: 'work',
      title: t('guides.work.title', 'Работа и профессии'),
      description: t('guides.work.description', 'Названия профессий и рабочая лексика'),
      icon: Briefcase,
      color: 'indigo',
      difficulty: 'intermediate',
      estimatedTime: '35-40 мин',
      wordCount: 28,
      topics: ['Профессии', 'Работа', 'Офис', 'Карьера'],
      keywords: ['жұмыс', 'маман', 'кеңсе', 'мансап', 'қызмет']
    },
    {
      id: 'education',
      title: t('guides.education.title', 'Образование и учеба'),
      description: t('guides.education.description', 'Школьная и университетская лексика'),
      icon: GraduationCap,
      color: 'blue',
      difficulty: 'advanced',
      estimatedTime: '40-45 мин',
      wordCount: 35,
      topics: ['Школа', 'Университет', 'Наука', 'Учеба'],
      keywords: ['білім', 'мектеп', 'университет', 'сабақ', 'ғылым']
    },
    {
      id: 'time',
      title: t('guides.time.title', 'Время и календарь'),
      description: t('guides.time.description', 'Дни недели, месяцы, время суток'),
      icon: Clock,
      color: 'teal',
      difficulty: 'beginner',
      estimatedTime: '20-25 мин',
      wordCount: 18,
      topics: ['Время', 'Календарь', 'Дни недели', 'Месяцы'],
      keywords: ['уақыт', 'күн', 'ай', 'жыл', 'сағат', 'апта']
    }
  ];

  // Получаем прогресс по путеводителям
  const { data: guideProgress, isLoading: progressLoading } = useQuery({
    queryKey: ['guide-progress'],
    queryFn: async () => {
      // Здесь можно реализовать API для получения прогресса
      // Пока используем mock данные
      const mockProgress: GuideProgress[] = learningGuides.map(guide => ({
        guideId: guide.id,
        completedWords: Math.floor(Math.random() * guide.wordCount),
        totalWords: guide.wordCount,
        isStarted: Math.random() > 0.5,
        isCompleted: Math.random() > 0.8
      }));
      return mockProgress;
    }
  });

  // Мутация для поиска слов по путеводителю
  const searchWordsMutation = useMutation({
    mutationFn: async (guide: LearningGuide) => {
      const promises = guide.keywords.map(keyword =>
        wordsAPI.searchWords(
          keyword, 
          user?.main_language?.language_code || 'en',
          10 // limit
        )
      );
      
      const results = await Promise.all(promises);
      const allWords = results.flatMap(result => result || []);
      
      // Удаляем дубликаты
      const uniqueWords = allWords.filter((word, index, self) =>
        index === self.findIndex(w => w.id === word.id)
      );
      
      return uniqueWords.slice(0, guide.wordCount);
    }
  });

  // Мутация для добавления слов в список изучения
  const addToLearningMutation = useMutation({
    mutationFn: async (wordIds: number[]) => {
      return learningAPI.addMultipleWords({
        word_ids: wordIds,
        status: LEARNING_STATUSES.WANT_TO_LEARN
      });
    },
    onSuccess: (_, wordIds) => {
      queryClient.invalidateQueries({ queryKey: ['learning-stats'] });
      queryClient.invalidateQueries({ queryKey: ['guide-progress'] });
      toast.success(t('messages.addedToLearning', {
        count: wordIds.length,
        defaultValue: `Добавлено ${wordIds.length} слов в список изучения`
      }));
    },
    onError: () => {
      toast.error(t('errors.addToLearningFailed', 'Не удалось добавить слова'));
    }
  });

  const handleStartGuide = async (guide: LearningGuide) => {
    try {
      const words = await searchWordsMutation.mutateAsync(guide);
      
      if (words.length === 0) {
        toast.error(t('errors.noWordsFound', 'Не найдено слов для этого путеводителя'));
        return;
      }

      // Добавляем слова в список изучения
      const wordIds = words.map(word => word.id);
      await addToLearningMutation.mutateAsync(wordIds);
      
      // Переходим к практике с этими словами
      navigate(`/app/practice?type=learning&guide=${guide.id}`);
    } catch (error) {
      console.error('Error starting guide:', error);
      toast.error(t('errors.guideStartFailed', 'Не удалось начать путеводитель'));
    }
  };

  const handleContinueGuide = (guide: LearningGuide) => {
    navigate(`/app/practice?type=learning&guide=${guide.id}`);
  };

  const filteredGuides = learningGuides.filter(guide => {
    const matchesDifficulty = selectedDifficulty === 'all' || guide.difficulty === selectedDifficulty;
    const matchesSearch = !searchTerm || 
      guide.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      guide.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      guide.topics.some(topic => topic.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesDifficulty && matchesSearch;
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getGuideProgress = (guideId: string) => {
    return guideProgress?.find(p => p.guideId === guideId);
  };

  if (progressLoading) {
    return <LoadingSpinner fullScreen text={t('loading.guides')} />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Заголовок */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Map className="w-8 h-8 text-blue-500" />
          <h1 className="text-3xl font-bold text-gray-900">
            {t('guides.title', 'Путеводители по изучению')}
          </h1>
        </div>
        <p className="text-gray-600 max-w-3xl">
          {t('guides.description', 'Структурированные коллекции слов по темам. Каждый путеводитель поможет вам выучить необходимую лексику для конкретных ситуаций.')}
        </p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-50 p-6 rounded-lg">
          <div className="flex items-center gap-3">
            <Target className="w-8 h-8 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {guideProgress?.filter(p => p.isStarted).length || 0}
              </div>
              <div className="text-sm text-blue-600">{t('stats.guidesStarted', 'Начато путеводителей')}</div>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 p-6 rounded-lg">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-600">
                {guideProgress?.filter(p => p.isCompleted).length || 0}
              </div>
              <div className="text-sm text-green-600">{t('stats.guidesCompleted', 'Завершено путеводителей')}</div>
            </div>
          </div>
        </div>
        
        <div className="bg-purple-50 p-6 rounded-lg">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-purple-600" />
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {guideProgress?.reduce((sum, p) => sum + p.completedWords, 0) || 0}
              </div>
              <div className="text-sm text-purple-600">{t('stats.wordsLearned', 'Слов изучено')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Фильтры */}
      <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Поиск */}
          <div className="flex-1">
            <input
              type="text"
              placeholder={t('search.guides', 'Поиск путеводителей...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Фильтр сложности */}
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">{t('filters.allLevels', 'Все уровни')}</option>
            <option value="beginner">{t('levels.beginner', 'Начинающий')}</option>
            <option value="intermediate">{t('levels.intermediate', 'Средний')}</option>
            <option value="advanced">{t('levels.advanced', 'Продвинутый')}</option>
          </select>
        </div>
      </div>

      {/* Список путеводителей */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGuides.map((guide) => {
          const IconComponent = guide.icon;
          const progress = getGuideProgress(guide.id);
          const progressPercentage = progress ? 
            Math.round((progress.completedWords / progress.totalWords) * 100) : 0;

          return (
            <div key={guide.id} className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
              {/* Заголовок */}
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

              {/* Метаданные */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(guide.difficulty)}`}>
                  {t(`levels.${guide.difficulty}`)}
                </span>
                <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                  {guide.wordCount} {t('common.words', 'слов')}
                </span>
                <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                  {guide.estimatedTime}
                </span>
              </div>

              {/* Темы */}
              <div className="mb-4">
                <div className="text-xs text-gray-500 mb-2">{t('guide.topics', 'Темы:')}</div>
                <div className="flex flex-wrap gap-1">
                  {guide.topics.slice(0, 3).map((topic, index) => (
                    <span key={index} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                      {topic}
                    </span>
                  ))}
                  {guide.topics.length > 3 && (
                    <span className="px-2 py-1 bg-gray-50 text-gray-500 rounded text-xs">
                      +{guide.topics.length - 3}
                    </span>
                  )}
                </div>
              </div>

              {/* Прогресс */}
              {progress?.isStarted && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>{t('progress.completed', 'Прогресс')}</span>
                    <span>{progress.completedWords}/{progress.totalWords}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`bg-${guide.color}-600 h-2 rounded-full`}
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Действия */}
              <div className="flex gap-2">
                {!progress?.isStarted ? (
                  <button
                    onClick={() => handleStartGuide(guide)}
                    disabled={searchWordsMutation.isPending || addToLearningMutation.isPending}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-${guide.color}-600 text-white rounded-md hover:bg-${guide.color}-700 transition-colors disabled:opacity-50`}
                  >
                    <Plus className="w-4 h-4" />
                    {t('actions.startGuide', 'Начать')}
                  </button>
                ) : progress.isCompleted ? (
                  <div className="flex-1 flex gap-2">
                    <button
                      onClick={() => handleContinueGuide(guide)}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors`}
                    >
                      <CheckCircle className="w-4 h-4" />
                      {t('actions.review', 'Повторить')}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleContinueGuide(guide)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-${guide.color}-600 text-white rounded-md hover:bg-${guide.color}-700 transition-colors`}
                  >
                    <Play className="w-4 h-4" />
                    {t('actions.continue', 'Продолжить')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Пустое состояние */}
      {filteredGuides.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🗺️</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {t('guides.noResults', 'Путеводители не найдены')}
          </h3>
          <p className="text-gray-600">
            {t('guides.tryDifferentSearch', 'Попробуйте изменить параметры поиска')}
          </p>
        </div>
      )}
    </div>
  );
};

export default GuidedLearningPage;