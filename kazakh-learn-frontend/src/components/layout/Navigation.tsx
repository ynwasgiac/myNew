// src/components/layout/Navigation.tsx - Обновленная навигация

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Home, 
  BookOpen, 
  Target, 
  Map, 
  Star, 
  BarChart3, 
  Settings,
  Trophy,
  Heart
} from 'lucide-react';

const Navigation: React.FC = () => {
  const { t } = useTranslation(['navigation', 'common']);
  const location = useLocation();

  const navigationItems = [
    {
      path: '/app/dashboard',
      icon: Home,
      label: t('dashboard', 'Главная'),
      description: t('dashboard.description', 'Обзор прогресса и быстрые действия')
    },
    {
      path: '/app/learning',
      icon: BookOpen,
      label: t('learning', 'Изучение'),
      description: t('learning.description', 'Ваш список слов для изучения')
    },
    {
      path: '/app/guides',
      icon: Map,
      label: t('guides', 'Путеводители'),
      description: t('guides.description', 'Тематические коллекции слов'),
      isNew: true // Новая страница!
    },
    {
      path: '/app/practice',
      icon: Target,
      label: t('practice', 'Практика'),
      description: t('practice.description', 'Тренировка слов и тестирование')
    },
    {
      path: '/app/learned',
      icon: Trophy,
      label: t('learned', 'Изученные'),
      description: t('learned.description', 'Ваши изученные и любимые слова'),
      isNew: true // Новая страница!
    },
    {
      path: '/app/progress',
      icon: BarChart3,
      label: t('progress', 'Прогресс'),
      description: t('progress.description', 'Статистика и достижения')
    },
    {
      path: '/app/settings',
      icon: Settings,
      label: t('settings', 'Настройки'),
      description: t('settings.description', 'Персонализация и предпочтения')
    }
  ];

  const isActivePath = (path: string) => {
    if (path === '/app/dashboard') {
      return location.pathname === '/app' || location.pathname === '/app/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex space-x-8">
            {navigationItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = isActivePath(item.path);
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  title={item.description}
                >
                  <IconComponent className="w-4 h-4 mr-2" />
                  {item.label}
                  
                  {/* Новый бейдж */}
                  {item.isNew && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {t('new', 'NEW')}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;