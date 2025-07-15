// src/components/routing/AppRoutes.tsx - Updated to work properly with React Router nested routes

import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoadingSpinner from '../ui/LoadingSpinner';

// Your existing pages - using exact imports from your project
const DashboardPage = React.lazy(() => import('../../pages/DashboardPage'));
const LearningPage = React.lazy(() => import('../../pages/learning/LearningPage'));
const GuidedLearningPage = React.lazy(() => import('../../pages/learning/GuidedLearningPage'));
const LearnedWordsPage = React.lazy(() => import('../../pages/learning/LearnedWordsPage'));
const PracticePage = React.lazy(() => import('../../pages/learning/PracticePage'));
const ProgressPage = React.lazy(() => import('../../pages/learning/ProgressPage'));
const QuizPage = React.lazy(() => import('../../pages/learning/QuizPage'));

// Words and Categories (your existing)
const WordsPage = React.lazy(() => import('../../pages/words/WordsPage'));
const WordDetailPage = React.lazy(() => import('../../pages/words/WordDetailPage'));
const CategoriesPage = React.lazy(() => import('../../pages/categories/CategoriesPage'));
const CategoryDetailPage = React.lazy(() => import('../../pages/categories/CategoryDetailPage'));

// Profile and Settings (your existing)
const ProfilePage = React.lazy(() => import('../../pages/profile/ProfilePage'));
const SettingsPage = React.lazy(() => import('../../pages/profile/SettingsPage'));

const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Routes>
        {/* Root redirect to dashboard */}
        <Route index element={<Navigate to="dashboard" replace />} />
        
        {/* Main Dashboard */}
        <Route path="dashboard" element={<DashboardPage />} />
        
        {/* Learning Routes - now properly integrated! */}
        <Route path="learning" element={<LearningPage />} />
        <Route path="learn" element={<Navigate to="../learning" replace />} /> {/* Redirect old route */}
        <Route path="guides" element={<GuidedLearningPage />} />
        <Route path="learned" element={<LearnedWordsPage />} />
        
        {/* Practice and Testing */}
        <Route path="practice" element={<PracticePage />} />
        <Route path="quiz" element={<QuizPage />} />
        <Route path="progress" element={<ProgressPage />} />
        
        {/* Words and Categories - your existing system */}
        <Route path="words" element={<WordsPage />} />
        <Route path="words/:id" element={<WordDetailPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="categories/:id" element={<CategoryDetailPage />} />
        
        {/* Profile and Settings */}
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        
        {/* Catch all - redirect to dashboard */}
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;