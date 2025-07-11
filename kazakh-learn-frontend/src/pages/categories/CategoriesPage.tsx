// src/pages/categories/CategoriesPage.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  TagIcon, 
  BookOpenIcon,
  MagnifyingGlassIcon,
  ArrowRightIcon,
  ViewColumnsIcon,
  ListBulletIcon
} from '@heroicons/react/24/outline';

import { categoriesAPI, wordsAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next'; 
import type { Category } from '../../types/api';

import LoadingSpinner from '../../components/ui/LoadingSpinner';

const CategoriesPage: React.FC = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation('categories');
  
  // Safe debugging without getResourceBundle
  console.log('Current language:', i18n.language);
  console.log('Is i18n ready:', i18n.isInitialized);
  console.log('i18n exists:', !!i18n);
  console.log('Available languages:', i18n.languages);
  console.log('Translation test for page.title:', t('page.title'));
  console.log('Translation test with fallback:', t('page.title', 'Fallback Title'));
  console.log('Raw translation function type:', typeof t);
  
  // Test if resources are loaded
  try {
    console.log('Resources exist:', !!i18n.options.resources);
    console.log('Current language resources:', i18n.options.resources?.[i18n.language]);
    console.log('Categories namespace:', i18n.options.resources?.[i18n.language]?.categories);
  } catch (error) {
    console.error('Error accessing resources:', error);
  }
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Fetch categories
  const { data: categories, isLoading, error } = useQuery({
    queryKey: ['categories', user?.main_language?.language_code],
    queryFn: () => categoriesAPI.getCategories(user?.main_language?.language_code),
  });

  // Filter categories based on search
  const filteredCategories = categories?.filter(category => {
    const categoryName = category.translations?.[0]?.translated_name || category.category_name;
    const description = category.translations?.[0]?.translated_description || category.description;
    
    return categoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (description && description.toLowerCase().includes(searchTerm.toLowerCase()));
  }) || [];

  const getCategoryIcon = (categoryName: string) => {
    // You can customize icons based on category names
    const iconMap: Record<string, string> = {
      'food': '🍎',
      'animals': '🐾',
      'family': '👨‍👩‍👧‍👦',
      'colors': '🎨',
      'numbers': '🔢',
      'body': '👤',
      'nature': '🌱',
      'transport': '🚗',
      'clothing': '👕',
      'house': '🏠',
      'school': '🎓',
      'work': '💼',
      'time': '⏰',
      'weather': '🌤️',
      'sports': '⚽',
      'music': '🎵',
      'emotions': '😊',
      'directions': '🧭',
      'technology': '💻',
      'health': '🏥'
    };

    const key = categoryName.toLowerCase();
    return iconMap[key] || '📚';
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text={t('loading.categories')} />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{t('errors.loadingError')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('page.title')}</h1>
          <p className="text-gray-600">
            {t('page.subtitle', { count: filteredCategories.length })}
          </p>
        </div>
      </div>

      {/* Search and View Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center space-y-4 lg:space-y-0 lg:space-x-4">
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('search.placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md ${
                viewMode === 'grid' 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title={t('view.grid')}
            >
              <ViewColumnsIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md ${
                viewMode === 'list' 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title={t('view.list')}
            >
              <ListBulletIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Categories Display */}
      {filteredCategories.length > 0 ? (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredCategories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-200">
                {filteredCategories.map((category) => (
                  <CategoryListItem key={category.id} category={category} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('emptyState.title')}
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm 
              ? t('emptyState.searchMessage', { searchTerm })
              : t('emptyState.noCategories')
            }
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="btn-primary"
            >
              {t('search.clearSearch')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Category Card Component for Grid View
const CategoryCard: React.FC<{ category: Category }> = ({ category }) => {
  const { t } = useTranslation('categories');
  const categoryName = category.translations?.[0]?.translated_name || category.category_name;
  const description = category.translations?.[0]?.translated_description || category.description;

  return (
    <Link
      to={`/app/categories/${category.id}`}
      className="group block bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md hover:border-gray-300 transition-all duration-200"
    >
      <div className="text-center">
        {/* Category Icon */}
        <div className="text-4xl mb-4">
          {getCategoryIcon(category.category_name)}
        </div>

        {/* Category Name */}
        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-2">
          {categoryName}
        </h3>

        {/* Description */}
        {description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
            {description}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
          <div className="flex items-center space-x-1">
            <BookOpenIcon className="h-4 w-4" />
            <span>{t('card.viewWords')}</span>
          </div>
          <ArrowRightIcon className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </Link>
  );
};

// Category List Item Component for List View
const CategoryListItem: React.FC<{ category: Category }> = ({ category }) => {
  const { t } = useTranslation('categories');
  const categoryName = category.translations?.[0]?.translated_name || category.category_name;
  const description = category.translations?.[0]?.translated_description || category.description;

  return (
    <Link
      to={`/app/categories/${category.id}`}
      className="block p-6 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Category Icon */}
          <div className="text-2xl">
            {getCategoryIcon(category.category_name)}
          </div>

          {/* Category Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors">
              {categoryName}
            </h3>
            {description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                {description}
              </p>
            )}
            <div className="flex items-center space-x-4 mt-2">
              <span className="text-xs text-gray-500">
                {t('list.categoryId', { id: category.id })}
              </span>
              {category.created_at && (
                <span className="text-xs text-gray-500">
                  {t('list.created', { 
                    date: new Date(category.created_at).toLocaleDateString() 
                  })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Indicators */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-sm text-gray-500">
            <BookOpenIcon className="h-4 w-4" />
            <span>{t('list.browse')}</span>
          </div>
          <ArrowRightIcon className="h-5 w-5 text-gray-400" />
        </div>
      </div>
    </Link>
  );
};

// Helper function to get category icons
const getCategoryIcon = (categoryName: string) => {
  const iconMap: Record<string, string> = {
    'food': '🍎',
    'animals': '🐾', 
    'family': '👨‍👩‍👧‍👦',
    'colors': '🎨',
    'numbers': '🔢',
    'body': '👤',
    'nature': '🌱',
    'transport': '🚗',
    'clothing': '👕',
    'house': '🏠',
    'school': '🎓',
    'work': '💼',
    'time': '⏰',
    'weather': '🌤️',
    'sports': '⚽',
    'music': '🎵',
    'emotions': '😊',
    'directions': '🧭',
    'technology': '💻',
    'health': '🏥'
  };

  const key = categoryName.toLowerCase();
  return iconMap[key] || '📚';
};

export default CategoriesPage;