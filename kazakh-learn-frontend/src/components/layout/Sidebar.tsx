// src/components/layout/Sidebar.tsx - Updated with Learning Module

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
  StarIcon,
  MapIcon,
  ShieldCheckIcon,
  BoltIcon  // Import for Learning Module icon
} from '@heroicons/react/24/outline';

const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  
  const isAdmin = user?.role === 'admin';
  const isAdminPath = location.pathname.startsWith('/admin');

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/app/dashboard',
      icon: HomeIcon,
    },
    // {
    //   name: 'Learning',
    //   href: '/app/learning',
    //   icon: BookOpenIcon,
    // },
    {
      name: 'Learning Module',
      href: '/app/learning-module',
      icon: BoltIcon,  // Using BoltIcon for intensive learning
      isNew: true,     // Mark as new feature
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

  // Admin Menu Items - Only existing pages
  const adminItems = isAdmin ? [
    {
      name: 'Learning Guides',
      href: '/admin/guides',
      icon: MapIcon,
      description: 'Manage learning guides and content',
    },
    {
      name: 'Admin Words',
      href: '/admin/words',
      icon: TagIcon,
      description: 'Manage word database',
    },
    {
      name: 'Admin Categories',
      href: '/admin/categories',
      icon: FolderIcon,
      description: 'Manage word categories',
    },
  ] : [];

  const renderNavItem = (item: any, isActive: boolean, isAdminItem = false) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.name}
        to={item.href}
        className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors relative ${
          isActive
            ? isAdminItem 
              ? 'bg-red-100 text-red-700 border-r-2 border-red-500'
              : 'bg-blue-100 text-blue-700 border-r-2 border-blue-500'
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
        }`}
        title={item.description}
      >
        <Icon
          className={`mr-3 h-5 w-5 ${
            isActive 
              ? isAdminItem 
                ? 'text-red-700' 
                : 'text-blue-700'
              : 'text-gray-400 group-hover:text-gray-500'
          }`}
        />
        {item.name}
        
        {/* New feature badge */}
        {item.isNew && (
          <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            New
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-gray-200">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">KL</span>
            </div>
          </div>
          <div className="ml-3">
            <h1 className="text-lg font-semibold text-gray-900">Kazakh Learn</h1>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-6 overflow-y-auto">
        {/* Admin Toggle - Only for admins */}
        {isAdmin && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Mode
              </h3>
            </div>
            <div className="flex rounded-lg bg-gray-100 p-1">
              <NavLink
                to="/app/dashboard"
                className={`flex-1 text-center py-1 px-2 text-xs font-medium rounded-md transition-colors ${
                  !isAdminPath 
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Student Mode
              </NavLink>
              <NavLink
                to="/admin/guides"
                className={`flex-1 text-center py-1 px-2 text-xs font-medium rounded-md transition-colors ${
                  isAdminPath 
                    ? 'bg-red-100 text-red-700 border border-red-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Admin Mode
              </NavLink>
            </div>
          </div>
        )}

        {/* Main Navigation or Admin Navigation */}
        {isAdminPath && isAdmin ? (
          // Admin Menu
          <div className="space-y-1">
            <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Administration
            </h3>
            {adminItems.map((item) => {
              const isActive = location.pathname === item.href || 
                              (item.href === '/admin/guides' && location.pathname.startsWith('/admin/guides'));
              return renderNavItem(item, isActive, true);
            })}
          </div>
        ) : (
          // Regular User Menu
          <div className="space-y-1">
            <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Learning
            </h3>
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.href ||
                              (item.href === '/app/dashboard' && location.pathname === '/app');
              return renderNavItem(item, isActive);
            })}
          </div>
        )}

        {/* Profile Section - Always Visible */}
        <div className="space-y-1 border-t border-gray-200 pt-4">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Account
          </h3>         
          {profileItems.map((item) => {
            const isActive = location.pathname === item.href;
            return renderNavItem(item, isActive);
          })}
        </div>

        {/* Admin Status Indicator */}
        {isAdminPath && isAdmin && (
          <div className="border-t border-gray-200 pt-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center">
                <ShieldCheckIcon className="h-5 w-5 text-red-600 mr-2" />
                <div>
                  <p className="text-sm font-medium text-red-800">Admin Mode Active</p>
                  <p className="text-xs text-red-600">Full system access enabled</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900">{user?.username}</p>
            <p className="text-xs text-gray-500">
              {isAdmin ? 'Administrator' : 'Student'}
              {isAdminPath && ' • Admin Mode'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;