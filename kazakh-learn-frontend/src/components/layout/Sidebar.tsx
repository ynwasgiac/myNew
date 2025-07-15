// src/components/layout/Sidebar.tsx - Updated navigation links

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  HomeIcon, 
  BookOpenIcon, 
  AcademicCapIcon,
  ChartBarIcon,
  UserIcon,
  CogIcon,
  TagIcon,
  FolderIcon,
  ClipboardDocumentListIcon,
  StarIcon
} from '@heroicons/react/24/outline';

const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  
  const isAdmin = user?.role === 'admin';

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/app/dashboard',
      icon: HomeIcon,
    },
    {
      name: 'Learning',
      href: '/app/learning',
      icon: BookOpenIcon,
    },
    {
      name: 'Guided Learning',
      href: '/app/guides',
      icon: AcademicCapIcon,
    },
    {
      name: 'Learned Words',
      href: '/app/learned',
      icon: StarIcon,
    },
    {
      name: 'Practice',
      href: '/app/practice',
      icon: ClipboardDocumentListIcon,
    },
    {
      name: 'Quiz',
      href: '/app/quiz',
      icon: AcademicCapIcon,
    },
    {
      name: 'Progress',
      href: '/app/progress',
      icon: ChartBarIcon,
    },
    {
      name: 'Words',
      href: '/app/words',
      icon: TagIcon,
    },
    {
      name: 'Categories',
      href: '/app/categories',
      icon: FolderIcon,
    },
  ];

  const profileItems = [
    {
      name: 'Profile',
      href: '/app/profile',
      icon: UserIcon,
    },
    {
      name: 'Settings',
      href: '/app/settings',
      icon: CogIcon,
    },
  ];

  const adminItems = isAdmin ? [
    {
      name: 'Admin Words',
      href: '/admin/words',
      icon: TagIcon,
    },
    {
      name: 'Admin Categories',
      href: '/admin/categories',
      icon: FolderIcon,
    },
  ] : [];

  return (
    <div className="bg-white shadow-lg h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Kazakh Learn</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {/* Main Navigation */}
        <div className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                {item.name}
              </NavLink>
            );
          })}
        </div>

        {/* Admin Section */}
        {adminItems.length > 0 && (
          <div className="pt-4 mt-4 border-t border-gray-200">
            <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Admin
            </p>
            <div className="mt-2 space-y-1">
              {adminItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) =>
                      `group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        isActive
                          ? 'bg-red-100 text-red-700'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                      }`
                    }
                  >
                    <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                    {item.name}
                  </NavLink>
                );
              })}
            </div>
          </div>
        )}

        {/* Profile Section */}
        <div className="pt-4 mt-4 border-t border-gray-200">
          <div className="space-y-1">
            {profileItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`
                  }
                >
                  <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  {item.name}
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {user?.username.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900">{user?.username}</p>
            <p className="text-xs text-gray-500">{user?.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;