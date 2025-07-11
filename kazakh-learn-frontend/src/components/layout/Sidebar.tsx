// src/components/layout/Sidebar.tsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  HomeIcon, 
  BookOpenIcon, 
  AcademicCapIcon,
  ChartBarIcon,
  UserIcon,
  Cog6ToothIcon,
  TagIcon,
  PuzzlePieceIcon,
  TrophyIcon,
  FolderIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  current?: boolean;
  badge?: string;
}

const Sidebar: React.FC = () => {
  const { t } = useTranslation('navigation');
  const location = useLocation();
  const { user } = useAuth();

  const navigation: NavigationItem[] = [
    { name: t('menu.dashboard'), href: '/app/dashboard', icon: HomeIcon },
    { name: t('menu.words'), href: '/app/words', icon: BookOpenIcon },
    { name: t('menu.categories'), href: '/app/categories', icon: TagIcon },
    { name: t('menu.learn'), href: '/app/learn', icon: AcademicCapIcon },
    { name: t('menu.practice'), href: '/app/practice', icon: PuzzlePieceIcon },
    { name: t('menu.quiz'), href: '/app/quiz', icon: TrophyIcon },
    { name: t('menu.progress'), href: '/app/progress', icon: ChartBarIcon },
    { name: t('menu.profile'), href: '/app/profile', icon: UserIcon },
    { name: t('menu.settings'), href: '/app/settings', icon: Cog6ToothIcon },
  ];

  const adminNavigation: NavigationItem[] = [
    { 
      name: 'Categories Management', 
      href: '/admin/categories', 
      icon: FolderIcon 
    },
    {
      name: t('Words'),
      href: '/admin/words',
      icon: BookOpenIcon, // or any appropriate icon
      current: location.pathname === '/admin/words'
    },
    { 
      name: 'Setup Check', 
      href: '/admin/setup-check', 
      icon: WrenchScrewdriverIcon 
    },
  ];

  const isCurrentPath = (href: string) => {
    if (href === '/app/dashboard') {
      return location.pathname === '/app' || location.pathname === '/app/dashboard';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center">
        <Link to="/app/dashboard" className="flex items-center space-x-2">
          <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">KL</span>
          </div>
          <span className="text-xl font-bold text-gray-900">{t('sidebar.appName')}</span>
        </Link>
      </div>

      {/* User info */}
      <div className="flex items-center space-x-3 py-3 px-3 bg-gray-50 rounded-lg">
        <div className="h-10 w-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
          <span className="text-white font-semibold text-sm">
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {user?.full_name || user?.username}
          </p>
          <p className="text-xs text-gray-500 capitalize">
            {user?.role}
            {user?.role === 'admin' && (
              <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                <ShieldCheckIcon className="w-3 h-3 mr-1" />
                Admin
              </span>
            )}
          </p>
          {user?.main_language && (
            <p className="text-xs text-blue-600">
              {t('sidebar.learningIn', { language: user.main_language.language_name })}
            </p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          {/* Main Navigation */}
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {navigation.map((item) => {
                const current = isCurrentPath(item.href);
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={`
                        group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold
                        ${current
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:text-blue-700 hover:bg-gray-50'
                        }
                      `}
                    >
                      <item.icon
                        className={`
                          h-6 w-6 shrink-0
                          ${current ? 'text-blue-700' : 'text-gray-400 group-hover:text-blue-700'}
                        `}
                        aria-hidden="true"
                      />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>

          {/* Admin Navigation - Only show for admin users */}
          {user?.role === 'admin' && (
            <li>
              <div className="text-xs font-semibold leading-6 text-gray-400 flex items-center">
                <ShieldCheckIcon className="h-4 w-4 mr-2 text-red-500" />
                ADMINISTRATION
              </div>
              <ul role="list" className="-mx-2 mt-2 space-y-1">
                {adminNavigation.map((item) => {
                  const current = isCurrentPath(item.href);
                  return (
                    <li key={item.name}>
                      <Link
                        to={item.href}
                        className={`
                          group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold relative
                          ${current
                            ? 'bg-red-50 text-red-700 border-l-2 border-red-500'
                            : 'text-gray-700 hover:text-red-700 hover:bg-red-50'
                          }
                        `}
                      >
                        <item.icon
                          className={`
                            h-6 w-6 shrink-0
                            ${current ? 'text-red-700' : 'text-gray-400 group-hover:text-red-700'}
                          `}
                          aria-hidden="true"
                        />
                        <span className="flex-1">{item.name}</span>
                        
                        {/* Badges */}
                        <div className="flex items-center space-x-1">
                          {item.badge && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {item.badge}
                            </span>
                          )}
                          {item.href === '/admin/setup-check' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              DEV
                            </span>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {/* Admin Quick Stats */}
              <div className="mt-4 mx-2">
                <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-medium text-red-800">
                        Admin Dashboard
                      </h4>
                      <p className="text-xs text-red-600 mt-1">
                        Manage content & users
                      </p>
                    </div>
                    <ShieldCheckIcon className="h-5 w-5 text-red-400" />
                  </div>
                  
                  {/* Quick Action Links */}
                  <div className="mt-3 flex space-x-2">
                    <Link
                      to="/admin/words"
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-700 bg-white border border-red-200 rounded hover:bg-red-50 transition-colors"
                    >
                      <DocumentTextIcon className="h-3 w-3 mr-1" />
                      Words
                    </Link>
                    <Link
                      to="/admin/categories"
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-700 bg-white border border-red-200 rounded hover:bg-red-50 transition-colors"
                    >
                      <FolderIcon className="h-3 w-3 mr-1" />
                      Categories
                    </Link>
                  </div>
                </div>
              </div>
            </li>
          )}
        </ul>
      </nav>

      {/* Footer */}
      <div className="mt-auto">
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
          <div className="text-center">
            <h3 className="text-sm font-semibold text-gray-900">
              {t('sidebar.motivation.title')}
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              {t('sidebar.motivation.description')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;