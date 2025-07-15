// src/App.tsx - Fixed to use your existing components and AppRoutes

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider, RequireAuth } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';

// Layout Components (your existing ones)
import Layout from './components/layout/Layout';

// Use your existing AppRoutes
import AppRoutes from './components/routing/AppRoutes';

// Auth Pages (your existing ones)
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Admin Pages (your existing ones) 
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage';
import AdminWordsPage from './pages/admin/AdminWordsPage';

// Error Pages (your existing ones)
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

// Admin Route Protection Component (using your existing useAuth)
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

// Simple Setup Checker Component (since TempSetupChecker doesn't exist)
const SetupChecker: React.FC = () => {
  const { user } = useAuth();
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Admin Setup Status
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="h-5 w-5 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">✓</span>
            </div>
            <div>
              <h3 className="font-medium text-green-900">Admin Access Verified</h3>
              <p className="text-sm text-green-700">
                User: {user?.username} | Role: {user?.role}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="h-5 w-5 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">i</span>
            </div>
            <div>
              <h3 className="font-medium text-blue-900">System Ready</h3>
              <p className="text-sm text-blue-700">
                Frontend and routing configured successfully.
              </p>
            </div>
          </div>
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
              {/* Public Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected App Routes - Now using your AppRoutes component! */}
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

              {/* Admin Routes */}
              <Route
                path="/admin"
                element={
                  <RequireAuth fallback={<Navigate to="/login" replace />}>
                    <Layout />
                  </RequireAuth>
                }
              >
                <Route index element={<Navigate to="/admin/categories" replace />} />
                
                <Route 
                  path="categories" 
                  element={
                    <AdminRoute>
                      <AdminCategoriesPage />
                    </AdminRoute>
                  } 
                />

                <Route 
                  path="words" 
                  element={
                    <AdminRoute>
                      <AdminWordsPage />
                    </AdminRoute>
                  } 
                />
                
                <Route 
                  path="setup-check" 
                  element={
                    <AdminRoute>
                      <SetupChecker />
                    </AdminRoute>
                  } 
                />
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