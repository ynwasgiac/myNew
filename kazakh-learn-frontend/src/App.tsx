// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider, RequireAuth } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import { useTranslation } from 'react-i18next';

// Layout Components
import Layout from './components/layout/Layout';
import PublicLayout from './components/layout/PublicLayout';

// Public Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Protected Pages
import DashboardPage from './pages/DashboardPage';
import WordsPage from './pages/words/WordsPage';
import WordDetailPage from './pages/words/WordDetailPage';
import CategoriesPage from './pages/categories/CategoriesPage';
import CategoryDetailPage from './pages/categories/CategoryDetailPage';
import LearningPage from './pages/learning/LearningPage';
import PracticePage from './pages/learning/PracticePage';
import QuizPage from './pages/learning/QuizPage';
import ProgressPage from './pages/learning/ProgressPage';
import ProfilePage from './pages/profile/ProfilePage';
import SettingsPage from './pages/profile/SettingsPage';

// Admin Pages
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage';
import AdminWordsPage from './pages/admin/AdminWordsPage';

// Error Pages
import NotFoundPage from './pages/error/NotFoundPage';

import './styles/globals.css';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Admin Route Protection Component
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 mb-4">
            Administrator permissions required to access this page.
          </p>
          <p className="text-sm text-gray-500">
            Current role: {user?.role || 'none'}
          </p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
};

// Temporary Setup Checker Component (until you create the full one)
const TempSetupChecker: React.FC = () => {
  const { user } = useAuth();
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Admin Setup Checker
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="h-5 w-5 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">✓</span>
            </div>
            <div>
              <h3 className="font-medium text-green-900">Admin Access Verified</h3>
              <p className="text-sm text-green-700">
                Logged in as: {user?.username} (Role: {user?.role})
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="h-5 w-5 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">i</span>
            </div>
            <div>
              <h3 className="font-medium text-blue-900">Admin Panel Ready</h3>
              <p className="text-sm text-blue-700">
                Admin functionality is working. Navigate to Category or Words Management to start.
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="h-5 w-5 bg-yellow-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">!</span>
            </div>
            <div>
              <h3 className="font-medium text-yellow-900">Backend Setup Needed</h3>
              <p className="text-sm text-yellow-700">
                To unlock full admin features, implement the backend endpoints from the setup guide.
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Available Admin Pages:</h4>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• <a href="/admin/categories" className="text-blue-600 hover:underline">Categories Management</a> - Manage word categories</li>
            <li>• <a href="/admin/words" className="text-blue-600 hover:underline">Words Management</a> - Manage Kazakh words and translations</li>
            <li>• Setup guide documentation for backend implementation</li>
          </ul>
        </div>
        
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Words Management Features:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Create and edit Kazakh words with multiple translations</li>
            <li>• Add pronunciations, images, and example sentences</li>
            <li>• Bulk operations for efficient management</li>
            <li>• Advanced filtering and search capabilities</li>
            <li>• Progress tracking and completion statistics</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<PublicLayout />}>
                <Route index element={<HomePage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="register" element={<RegisterPage />} />
              </Route>

              {/* Protected Routes */}
              <Route
                path="/app"
                element={
                  <RequireAuth fallback={<Navigate to="/login" replace />}>
                    <Layout />
                  </RequireAuth>
                }
              >
                <Route index element={<Navigate to="/app/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                
                {/* Words Routes */}
                <Route path="words" element={<WordsPage />} />
                <Route path="words/:id" element={<WordDetailPage />} />
                
                {/* Categories Routes */}
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="categories/:id" element={<CategoryDetailPage />} />
                
                {/* Learning Routes */}
                <Route path="learn" element={<LearningPage />} />
                <Route path="practice" element={<PracticePage />} />
                <Route path="quiz" element={<QuizPage />} />
                <Route path="progress" element={<ProgressPage />} />
                
                {/* Profile Routes */}
                <Route path="profile" element={<ProfilePage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              {/* Admin Routes - Separate section within the protected app */}
              <Route
                path="/admin"
                element={
                  <RequireAuth fallback={<Navigate to="/login" replace />}>
                    <Layout />
                  </RequireAuth>
                }
              >
                <Route index element={<Navigate to="/admin/categories" replace />} />
                
                {/* Admin Categories Management */}
                <Route 
                  path="categories" 
                  element={
                    <AdminRoute>
                      <AdminCategoriesPage />
                    </AdminRoute>
                  } 
                />

                <Route path="/admin/words" element={<AdminWordsPage />} />
                
                {/* Temporary Setup Checker */}
                <Route 
                  path="setup-check" 
                  element={
                    <AdminRoute>
                      <TempSetupChecker />
                    </AdminRoute>
                  } 
                />
                
                {/* Future admin routes can be added here:
                <Route 
                  path="users" 
                  element={
                    <AdminRoute>
                      <AdminUsersPage />
                    </AdminRoute>
                  } 
                />
                <Route 
                  path="analytics" 
                  element={
                    <AdminRoute>
                      <AdminAnalyticsPage />
                    </AdminRoute>
                  } 
                />
                */}
              </Route>

              {/* 404 Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>

            {/* Toast Notifications */}
            <Toaster 
              position="top-right" 
              richColors 
              closeButton
              duration={4000}
            />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;