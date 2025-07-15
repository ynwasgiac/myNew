// src/components/routing/AppRoutes.tsx - Обновленные маршруты

import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

// Lazy loading для оптимизации
const DashboardPage = React.lazy(() => import('../../pages/DashboardPage'));
const LearningPage = React.lazy(() => import('../../pages/learning/LearningPage'));
const GuidedLearningPage = React.lazy(() => import('../../pages/learning/GuidedLearningPage')); // НОВАЯ
const LearnedWordsPage = React.lazy(() => import('../../pages/learning/LearnedWordsPage')); // НОВАЯ
const PracticePage = React.lazy(() => import('../../pages/learning/PracticePage'));
const ProgressPage = React.lazy(() => import('../../pages/learning/ProgressPage'));
const QuizPage = React.lazy(() => import('../../pages/learning/QuizPage'));
const WordDetailPage = React.lazy(() => import('../../pages/words/WordDetailPage'));
const CategoriesPage = React.lazy(() => import('../../pages/categories/CategoriesPage'));
const CategoryDetailPage = React.lazy(() => import('../../pages/categories/CategoryDetailPage'));
const ProfilePage = React.lazy(() => import('../../pages/profile/ProfilePage'));
const SettingsPage = React.lazy(() => import('../../pages/profile/SettingsPage'));

// Админские страницы
const AdminWordsPage = React.lazy(() => import('../../pages/admin/AdminWordsPage'));
const AdminCategoriesPage = React.lazy(() => import('../../pages/admin/AdminCategoriesPage'));

const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Routes>
        {/* Главная страница - редирект на дашборд */}
        <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
        
        {/* Основные страницы */}
        <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/app/dashboard" element={<DashboardPage />} />
        
        {/* Изучение слов */}
        <Route path="/app/learning" element={<LearningPage />} />
        <Route path="/app/guides" element={<GuidedLearningPage />} /> {/* НОВАЯ */}
        <Route path="/app/learned" element={<LearnedWordsPage />} /> {/* НОВАЯ */}
        
        {/* Практика и тестирование */}
        <Route path="/app/practice" element={<PracticePage />} />
        <Route path="/app/quiz" element={<QuizPage />} />
        <Route path="/app/progress" element={<ProgressPage />} />
        
        {/* Слова и категории */}
        <Route path="/app/words/:id" element={<WordDetailPage />} />
        <Route path="/app/categories" element={<CategoriesPage />} />
        <Route path="/app/categories/:id" element={<CategoryDetailPage />} />
        
        {/* Профиль и настройки */}
        <Route path="/app/profile" element={<ProfilePage />} />
        <Route path="/app/settings" element={<SettingsPage />} />
        
        {/* Админские страницы */}
        <Route path="/app/admin/words" element={<AdminWordsPage />} />
        <Route path="/app/admin/categories" element={<AdminCategoriesPage />} />
        
        {/* 404 - несуществующие страницы */}
        <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;