// src/components/layout/Navigation.tsx - Обновленная навигация с Learning Module

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
  Heart,
  Zap,         // Для Learning Module - иконка молнии (интенсивное обучение)
  GraduationCap // Альтернативная иконка для Learning Module
} from 'lucide-react';

const Navigation: React.FC = () => {
  const { t } = useTranslation(['navigation', 'common']);
  const location = useLocation();

  const navigationItems = [
    {
      path: '/app/dashboard',
      icon: Home,
      label: t('menu.dashboard', 'Dashboard'),
      description: t('descriptions.dashboard', 'Overview of progress and quick actions')
    },
    {
      path: '/app/learning',
      icon: BookOpen,
      label: t('menu.learning', 'Learning'),
      description: t('descriptions.learning', 'Your word list for studying')
    },
    {
      path: '/app/learning-module',
      icon: Zap, // Или GraduationCap
      label: t('menu.learningModule', 'Learning Modules'),
      description: t('descriptions.learningModule', 'Intensive module-based learning sessions'),
      isNew: true, // Помечаем как новую функцию
      badge: 'New' // Добавляем бэдж
    },
    {
      path: '/app/guides',
      icon: Map,
      label: t('menu.guides', 'Guides'),
      description: t('descriptions.guides', 'Themed word collections'),
      isNew: true
    },
    {
      path: '/app/practice',
      icon: Target,
      label: t('menu.practice', 'Practice'),
      description: t('descriptions.practice', 'Word training and testing')
    },
    {
      path: '/app/learned',
      icon: Trophy,
      label: t('menu.learned', 'Learned'),
      description: t('descriptions.learned', 'Your learned and favorite words'),
      isNew: true
    },
    {
      path: '/app/progress',
      icon: BarChart3,
      label: t('menu.progress', 'Progress'),
      description: t('descriptions.progress', 'Statistics and achievements')
    },
    {
      path: '/app/settings',
      icon: Settings,
      label: t('menu.settings', 'Settings'),
      description: t('descriptions.settings', 'Personalization and preferences')
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
                  className={`relative inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors group ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <IconComponent 
                    className={`w-4 h-4 mr-2 ${
                      isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'
                    }`} 
                  />
                  <span>{item.label}</span>
                  
                  {/* Бэдж для новых функций */}
                  {(item.isNew || item.badge) && (
                    <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      {item.badge || 'New'}
                    </span>
                  )}
                  
                  {/* Tooltip с описанием */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                    {item.description}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
                  </div>
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