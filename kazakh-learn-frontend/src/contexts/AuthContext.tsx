// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { User, LoginRequest, RegisterRequest } from '../types/api';
import { authAPI, tokenService, handleApiError } from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setMainLanguage: (languageCode: string) => Promise<void>;
  clearMainLanguage: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { i18n } = useTranslation();

  const isAuthenticated = !!user && !!tokenService.getToken();

  // Function to sync user language with i18next
  const syncUserLanguage = (userData: User) => {
    if (userData.main_language?.language_code) {
      const userLang = userData.main_language.language_code;
      
      // Update i18next language
      i18n.changeLanguage(userLang);
      
      // Store in localStorage for persistence
      localStorage.setItem('user-language', userLang);
      localStorage.setItem('user-data', JSON.stringify(userData));
      
      // console.log(`Language synced: ${userLang} for user ${userData.username}`);
    }
  };

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      const token = tokenService.getToken();
      if (token) {
        try {
          const userData = await authAPI.getCurrentUser();
          setUser(userData);
          
          // Sync language on app initialization
          syncUserLanguage(userData);
        } catch (error) {
          console.error('Failed to get current user:', error);
          tokenService.removeToken();
          // Clear stored language data on auth failure
          localStorage.removeItem('user-language');
          localStorage.removeItem('user-data');
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials: LoginRequest): Promise<void> => {
    try {
      setIsLoading(true);
      const authResponse = await authAPI.login(credentials);
      
      // Store the token
      tokenService.setToken(authResponse.access_token);
      
      // Get user data
      const userData = await authAPI.getCurrentUser();
      setUser(userData);
      
      // Sync language immediately after login
      syncUserLanguage(userData);
      
      toast.success(`Welcome back, ${userData.username}!`);
    } catch (error) {
      const errorMessage = handleApiError(error);
      toast.error(`Login failed: ${errorMessage}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: RegisterRequest): Promise<void> => {
    try {
      setIsLoading(true);
      const newUser = await authAPI.register(userData);
      
      // Auto-login after registration
      await login({
        username: userData.username,
        password: userData.password,
      });
      
      toast.success(`Welcome to Kazakh Learn, ${newUser.username}!`);
    } catch (error) {
      const errorMessage = handleApiError(error);
      toast.error(`Registration failed: ${errorMessage}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      tokenService.removeToken();
      
      // Clear language data and reset to browser default
      localStorage.removeItem('user-language');
      localStorage.removeItem('user-data');
      
      // Reset to default/browser language
      const browserLang = navigator.language.split('-')[0];
      const defaultLang = ['en', 'kk', 'ru'].includes(browserLang) ? browserLang : 'en';
      i18n.changeLanguage(defaultLang);
      
      toast.success('Logged out successfully');
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      if (tokenService.getToken()) {
        const userData = await authAPI.getCurrentUser();
        setUser(userData);
        
        // Sync language when refreshing user data
        syncUserLanguage(userData);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      logout();
    }
  };

  const setMainLanguage = async (languageCode: string): Promise<void> => {
    try {
      await authAPI.setMainLanguage(languageCode);
      
      // Refresh user data to get updated language
      await refreshUser();
      
      toast.success('Language preference updated successfully');
    } catch (error) {
      const errorMessage = handleApiError(error);
      toast.error(`Failed to update language: ${errorMessage}`);
      throw error;
    }
  };

  const clearMainLanguage = async (): Promise<void> => {
    try {
      await authAPI.clearMainLanguage();
      await refreshUser(); // Refresh user data
      toast.success('Language preference cleared');
    } catch (error) {
      const errorMessage = handleApiError(error);
      toast.error(`Failed to clear language: ${errorMessage}`);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    refreshUser,
    setMainLanguage,
    clearMainLanguage,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Higher-order component for protected routes
interface RequireAuthProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ 
  children, 
  fallback = <div>Please log in to access this page.</div> 
}) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

// Hook for role-based access
export const useRequireRole = (requiredRole: string | string[]) => {
  const { user } = useAuth();
  
  const hasRole = React.useMemo(() => {
    if (!user) return false;
    
    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(user.role);
    }
    
    return user.role === requiredRole;
  }, [user, requiredRole]);

  return { hasRole, userRole: user?.role };
};