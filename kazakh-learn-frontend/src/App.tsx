// src/App.tsx - Updated with only existing admin pages

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider, RequireAuth } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';

// Layout Components
import Layout from './components/layout/Layout';

// App Routes
import AppRoutes from './components/routing/AppRoutes';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Admin Pages - ONLY EXISTING ONES
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage';
import AdminWordsPage from './pages/admin/AdminWordsPage';
import GuidesAdminPage from './pages/admin/GuidesAdminPage';
import GuideWordsAdminPage from './pages/admin/GuideWordsAdminPage';

// Error Pages
import NotFoundPage from './pages/error/NotFoundPage';

// Utils Components (if exists)
// import SetupChecker from './components/utils/SetupChecker';

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
          <button
            onClick={() => window.location.href = '/app/dashboard'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* Public Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected App Routes */}
              <Route
                path="/app"
                element={
                  <RequireAuth fallback={<Navigate to="/login" replace />}>
                    <Layout />
                  </RequireAuth>
                }
              >
                {/* Nested routes inside Layout using Outlet */}
                <Route path="*" element={<AppRoutes />} />
              </Route>

              {/* Admin Routes - Only existing pages */}
              <Route
                path="/admin"
                element={
                  <RequireAuth fallback={<Navigate to="/login" replace />}>
                    <Layout />
                  </RequireAuth>
                }
              >
                {/* Admin Dashboard - redirect to guides */}
                <Route index element={<Navigate to="/admin/guides" replace />} />
                
                {/* Learning Guides Admin */}
                <Route 
                  path="guides" 
                  element={
                    <AdminRoute>
                      <GuidesAdminPage />
                    </AdminRoute>
                  } 
                />
                
                <Route 
                  path="guides/:guideId/words" 
                  element={
                    <AdminRoute>
                      <GuideWordsAdminPage />
                    </AdminRoute>
                  } 
                />

                {/* Words and Categories Admin */}
                <Route 
                  path="words" 
                  element={
                    <AdminRoute>
                      <AdminWordsPage />
                    </AdminRoute>
                  } 
                />
                
                <Route 
                  path="categories" 
                  element={
                    <AdminRoute>
                      <AdminCategoriesPage />
                    </AdminRoute>
                  } 
                />
                
                {/* Uncomment if you have SetupChecker component */}
                {/* 
                <Route 
                  path="setup-check" 
                  element={
                    <AdminRoute>
                      <SetupChecker />
                    </AdminRoute>
                  } 
                />
                */}
              </Route>

              {/* Root redirect */}
              <Route path="/" element={<Navigate to="/app/dashboard" replace />} />

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