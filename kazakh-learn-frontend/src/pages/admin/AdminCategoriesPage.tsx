// src/pages/admin/AdminCategoriesPage.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
  Cog6ToothIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  FolderIcon,
  BookOpenIcon,
  CalendarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

import { categoriesAPI, languagesAPI } from '../../services/api';
import { adminAPI } from '../../services/adminAPI';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import TranslationForm, { TranslationFormData } from '../../components/admin/TranslationForm';

import type { Category, Language } from '../../types/api';

// Types for this component
interface CategoryFormData {
  category_name: string;
  description: string;
  is_active: boolean;
  translations: TranslationFormData[];
}

interface CategoryFilters {
  search: string;
  status: 'all' | 'active' | 'inactive';
  hasWords: boolean | undefined;
  sortBy: 'name' | 'created_at' | 'status' | 'word_count';
  sortDirection: 'asc' | 'desc';
}

const AdminCategoriesPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation('admin');
  const queryClient = useQueryClient();

  // State management
  const [filters, setFilters] = useState<CategoryFilters>({
    search: '',
    status: 'all',
    hasWords: undefined,
    sortBy: 'name',
    sortDirection: 'asc',
  });

  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [expandedRows, setExpandedRows] = useState<number[]>([]);

  // Fetch data with conditional enabling
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => adminAPI.getAdminCategories(true, user?.main_language?.language_code),
    enabled: user?.role === 'admin',
  });

  const { data: languages = [] } = useQuery({
    queryKey: ['languages'],
    queryFn: () => languagesAPI.getLanguages(),
    enabled: user?.role === 'admin',
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminAPI.getAdminStats(),
    enabled: user?.role === 'admin',
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CategoryFormData) => adminAPI.createCategory({
      category_name: data.category_name,
      description: data.description,
      is_active: data.is_active,
      translations: data.translations.map(t => ({
        language_code: t.language_code,
        translated_name: t.translated_name,
        translated_description: t.translated_description,
      })),
    }),
    onSuccess: () => {
      toast.success(t('categories.created'));
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setShowCreateModal(false);
    },
    onError: (error) => {
      toast.error(t('categories.createError'));
      console.error('Create error:', error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CategoryFormData }) => 
      adminAPI.updateCategory(id, {
        category_name: data.category_name,
        description: data.description,
        is_active: data.is_active,
        translations: data.translations.map(t => ({
          id: t.id,
          language_code: t.language_code,
          translated_name: t.translated_name,
          translated_description: t.translated_description,
        })),
      }),
    onSuccess: () => {
      toast.success(t('categories.updated'));
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setEditingCategory(null);
    },
    onError: (error) => {
      toast.error(t('categories.updateError'));
      console.error('Update error:', error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (categoryId: number) => adminAPI.deleteCategory(categoryId),
    onSuccess: () => {
      toast.success(t('categories.deleted'));
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (error) => {
      toast.error(t('categories.deleteError'));
      console.error('Delete error:', error);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => 
      adminAPI.toggleCategoryStatus(id, isActive),
    onSuccess: () => {
      toast.success(t('categories.statusUpdated'));
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    },
    onError: (error) => {
      toast.error(t('categories.statusUpdateError'));
      console.error('Toggle status error:', error);
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: ({ ids, updates }: { ids: number[]; updates: { is_active?: boolean } }) =>
      adminAPI.bulkUpdateCategories(ids, updates),
    onSuccess: () => {
      toast.success(t('categories.bulkUpdated'));
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setSelectedCategories([]);
    },
    onError: (error) => {
      toast.error(t('categories.bulkUpdateError'));
      console.error('Bulk update error:', error);
    },
  });

  // Filter and sort categories
  const filteredCategories = useMemo(() => {
    let filtered = categories.filter(category => {
      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const name = category.category_name.toLowerCase();
        const translatedName = category.translations?.[0]?.translated_name?.toLowerCase() || '';
        const description = category.description?.toLowerCase() || '';
        
        if (!name.includes(searchTerm) && 
            !translatedName.includes(searchTerm) && 
            !description.includes(searchTerm)) {
          return false;
        }
      }

      // Status filter
      if (filters.status !== 'all') {
        const isActive = filters.status === 'active';
        if (category.is_active !== isActive) return false;
      }

      // Word count filter
      if (filters.hasWords !== undefined) {
        const hasWords = (category as any).word_count > 0;
        if (hasWords !== filters.hasWords) return false;
      }

      return true;
    });

    // Sort categories
    filtered.sort((a, b) => {
      const direction = filters.sortDirection === 'asc' ? 1 : -1;
      
      switch (filters.sortBy) {
        case 'name':
          return direction * a.category_name.localeCompare(b.category_name);
        case 'created_at':
          return direction * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        case 'word_count':
          return direction * ((a as any).word_count - (b as any).word_count);
        case 'status':
          return direction * (Number(a.is_active) - Number(b.is_active));
        default:
          return 0;
      }
    });

    return filtered;
  }, [categories, filters]);

  // Event handlers
  const handleFilterChange = useCallback((key: keyof CategoryFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSort = useCallback((key: string) => {
    setFilters(prev => ({
      ...prev,
      sortBy: key as any,
      sortDirection: prev.sortBy === key && prev.sortDirection === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedCategories.length === filteredCategories.length) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories(filteredCategories.map(c => c.id));
    }
  }, [selectedCategories.length, filteredCategories]);

  const handleSelectCategory = useCallback((categoryId: number) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  }, []);

  const handleCreateCategory = useCallback(() => {
    setEditingCategory(null);
    setShowCreateModal(true);
  }, []);

  const handleEditCategory = useCallback((category: Category) => {
    setEditingCategory(category);
    setShowCreateModal(true);
  }, []);

  const handleDeleteCategory = useCallback((categoryId: number) => {
    if (window.confirm(t('categories.deleteConfirm'))) {
      deleteMutation.mutate(categoryId);
    }
  }, [deleteMutation, t]);

  const handleToggleStatus = useCallback((categoryId: number, isActive: boolean) => {
    toggleStatusMutation.mutate({ id: categoryId, isActive });
  }, [toggleStatusMutation]);

  const handleBulkActivate = useCallback(() => {
    bulkUpdateMutation.mutate({ ids: selectedCategories, updates: { is_active: true } });
  }, [bulkUpdateMutation, selectedCategories]);

  const handleBulkDeactivate = useCallback(() => {
    bulkUpdateMutation.mutate({ ids: selectedCategories, updates: { is_active: false } });
  }, [bulkUpdateMutation, selectedCategories]);

  const handleBulkDelete = useCallback(() => {
    if (window.confirm(t('categories.bulkDeleteConfirm', { count: selectedCategories.length }))) {
      selectedCategories.forEach(id => deleteMutation.mutate(id));
    }
  }, [deleteMutation, selectedCategories, t]);

  const toggleRowExpansion = useCallback((categoryId: number) => {
    setExpandedRows(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  }, []);

  const getSortIcon = (columnKey: string) => {
    if (filters.sortBy !== columnKey) return null;
    return filters.sortDirection === 'asc' 
      ? <ChevronUpIcon className="w-4 h-4" />
      : <ChevronDownIcon className="w-4 h-4" />;
  };

  const getTranslationSummary = (category: Category) => {
    const translations = category.translations || [];
    const totalLanguages = languages.length;
    const hasTranslations = translations.filter(t => t.translated_name).length;
    
    return {
      completed: hasTranslations,
      total: totalLanguages,
      percentage: Math.round((hasTranslations / Math.max(totalLanguages, 1)) * 100),
    };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Permission check - after all hooks
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

  // Loading state
  if (categoriesLoading) {
    return <LoadingSpinner fullScreen text="Loading categories..." />;
  }

  // Error state
  if (categoriesError) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Error Loading Categories
        </h2>
        <p className="text-gray-600 mb-4">
          Unable to load categories. Please try again.
        </p>
        <Button 
          onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-categories'] })}
          variant="primary"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Category Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage {filteredCategories.length} word categories with translations
          </p>
        </div>

        <div className="flex items-center space-x-3 mt-4 lg:mt-0">
          <Button
            onClick={() => toast.info('Import feature coming soon')}
            variant="secondary"
            icon={<ArrowUpTrayIcon className="h-4 w-4" />}
          >
            Import
          </Button>
          
          <Button
            onClick={() => toast.info('Export feature coming soon')}
            variant="secondary"
            icon={<ArrowDownTrayIcon className="h-4 w-4" />}
          >
            Export
          </Button>

          <Button
            onClick={handleCreateCategory}
            variant="primary"
            icon={<PlusIcon className="h-4 w-4" />}
          >
            Create Category
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Categories</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_categories}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-50">
                <FolderIcon className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.active_categories}</p>
              </div>
              <div className="p-3 rounded-full bg-green-50">
                <CheckCircleIcon className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inactive</p>
                <p className="text-2xl font-bold text-gray-600">{stats.inactive_categories}</p>
              </div>
              <div className="p-3 rounded-full bg-gray-50">
                <EyeSlashIcon className="h-6 w-6 text-gray-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">With Words</p>
                <p className="text-2xl font-bold text-purple-600">
                  {stats.categories_by_word_count?.filter(c => c.word_count > 0).length || 0}
                </p>
              </div>
              <div className="p-3 rounded-full bg-purple-50">
                <BookOpenIcon className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center space-y-4 lg:space-y-0 lg:space-x-4">
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10 pr-10 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            {filters.search && (
              <button
                onClick={() => handleFilterChange('search', '')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* Clear Filters */}
          {(filters.search || filters.status !== 'all') && (
            <Button
              onClick={() => setFilters({
                search: '',
                status: 'all',
                hasWords: undefined,
                sortBy: 'name',
                sortDirection: 'asc',
              })}
              variant="secondary"
              size="sm"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedCategories.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-blue-900">
                  {selectedCategories.length} items selected
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  onClick={handleBulkActivate}
                  variant="secondary"
                  size="sm"
                  icon={<EyeIcon className="h-4 w-4" />}
                  disabled={bulkUpdateMutation.isPending}
                >
                  Activate
                </Button>
                
                <Button
                  onClick={handleBulkDeactivate}
                  variant="secondary"
                  size="sm"
                  icon={<EyeSlashIcon className="h-4 w-4" />}
                  disabled={bulkUpdateMutation.isPending}
                >
                  Deactivate
                </Button>
                
                <Button
                  onClick={handleBulkDelete}
                  variant="danger"
                  size="sm"
                  icon={<TrashIcon className="h-4 w-4" />}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </Button>
              </div>
            </div>

            <Button
              onClick={() => setSelectedCategories([])}
              variant="secondary"
              size="sm"
              icon={<XMarkIcon className="h-4 w-4" />}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Categories Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredCategories.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {/* Select All */}
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedCategories.length === filteredCategories.length && filteredCategories.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>

                  {/* Name */}
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort('name')}
                      className="group flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                    >
                      <span>Name</span>
                      {getSortIcon('name')}
                    </button>
                  </th>

                  {/* Status */}
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort('status')}
                      className="group flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                    >
                      <span>Status</span>
                      {getSortIcon('status')}
                    </button>
                  </th>

                  {/* Translations */}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Translations
                  </th>

                  {/* Created */}
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort('created_at')}
                      className="group flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                    >
                      <span>Created</span>
                      {getSortIcon('created_at')}
                    </button>
                  </th>

                  {/* Actions */}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCategories.map((category) => {
                  const isSelected = selectedCategories.includes(category.id);
                  const isExpanded = expandedRows.includes(category.id);
                  const translationSummary = getTranslationSummary(category);
                  const translatedName = category.translations?.[0]?.translated_name || category.category_name;

                  return (
                    <React.Fragment key={category.id}>
                      {/* Main Row */}
                      <tr className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                        {/* Checkbox */}
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectCategory(category.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </td>

                        {/* Name */}
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {translatedName}
                                </p>
                                {category.translations && category.translations.length > 0 && (
                                  <button
                                    onClick={() => toggleRowExpansion(category.id)}
                                    className="text-blue-600 hover:text-blue-800"
                                    title="View translations"
                                  >
                                    <InformationCircleIcon className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                              {category.description && (
                                <p className="text-sm text-gray-500 truncate mt-1">
                                  {category.description}
                                </p>
                              )}
                              <p className="text-xs text-gray-400 mt-1">
                                ID: {category.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <Badge
                            variant={category.is_active ? 'success' : 'secondary'}
                            size="sm"
                          >
                            {category.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>

                        {/* Translations */}
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <div className="flex-1">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    translationSummary.percentage === 100 ? 'bg-green-500' :
                                    translationSummary.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${translationSummary.percentage}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-xs text-gray-600 whitespace-nowrap">
                              {translationSummary.completed}/{translationSummary.total}
                            </span>
                          </div>
                        </td>

                        {/* Created */}
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-1">
                            <CalendarIcon className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-500">
                              {formatDate(category.created_at)}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Button
                              onClick={() => handleToggleStatus(category.id, !category.is_active)}
                              variant="secondary"
                              size="sm"
                              icon={category.is_active ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                              title={category.is_active ? 'Deactivate' : 'Activate'}
                            />
                            
                            <Button
                              onClick={() => handleEditCategory(category)}
                              variant="secondary"
                              size="sm"
                              icon={<PencilIcon className="h-4 w-4" />}
                              title="Edit"
                            />
                            
                            <Button
                              onClick={() => handleDeleteCategory(category.id)}
                              variant="danger"
                              size="sm"
                              icon={<TrashIcon className="h-4 w-4" />}
                              title="Delete"
                            />
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Row */}
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="space-y-3">
                              <h4 className="text-sm font-medium text-gray-900">
                                Translation Details
                              </h4>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {category.translations?.map((translation) => (
                                  <div key={translation.id} className="bg-white rounded-md p-3 border border-gray-200">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-medium text-gray-900">
                                        {translation.language_code.toUpperCase()}
                                      </span>
                                      <Badge
                                        variant={translation.translated_name ? 'success' : 'secondary'}
                                        size="xs"
                                      >
                                        {translation.translated_name ? 'Complete' : 'Missing'}
                                      </Badge>
                                    </div>
                                    
                                    {translation.translated_name && (
                                      <>
                                        <p className="text-sm text-gray-900 font-medium mb-1">
                                          {translation.translated_name}
                                        </p>
                                        {translation.translated_description && (
                                          <p className="text-xs text-gray-600 line-clamp-2">
                                            {translation.translated_description}
                                          </p>
                                        )}
                                      </>
                                    )}
                                    
                                    {!translation.translated_name && (
                                      <p className="text-xs text-gray-400 italic">
                                        No translation provided
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Categories Found
            </h3>
            <p className="text-gray-600 mb-4">
              {filters.search || filters.status !== 'all' 
                ? 'No categories match your current filters.'
                : 'Get started by creating your first category.'
              }
            </p>
            {(filters.search || filters.status !== 'all') ? (
              <Button
                onClick={() => setFilters({
                  search: '',
                  status: 'all',
                  hasWords: undefined,
                  sortBy: 'name',
                  sortDirection: 'asc',
                })}
                variant="secondary"
              >
                Clear Filters
              </Button>
            ) : (
              <Button
                onClick={handleCreateCategory}
                variant="primary"
                icon={<PlusIcon className="h-4 w-4" />}
              >
                Create First Category
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <CategoryEditModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingCategory(null);
        }}
        category={editingCategory}
        languages={languages}
        onSave={async (data) => {
          if (editingCategory) {
            await updateMutation.mutateAsync({ id: editingCategory.id, data });
          } else {
            await createMutation.mutateAsync(data);
          }
        }}
        loading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
};

// Category Edit Modal Component
interface CategoryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: Category | null;
  languages: Language[];
  onSave: (data: CategoryFormData) => Promise<void>;
  loading?: boolean;
}

const CategoryEditModal: React.FC<CategoryEditModalProps> = ({
  isOpen,
  onClose,
  category,
  languages,
  onSave,
  loading = false,
}) => {
  const { t } = useTranslation('admin');
  const isEditing = Boolean(category);

  const [formData, setFormData] = useState<CategoryFormData>({
    category_name: '',
    description: '',
    is_active: true,
    translations: [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'basic' | 'translations'>('basic');

  // Initialize form data when modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (category) {
        setFormData({
          category_name: category.category_name,
          description: category.description || '',
          is_active: category.is_active,
          translations: languages.map(lang => {
            const existingTranslation = category.translations?.find(
              t => t.language_code === lang.language_code
            );
            return {
              id: existingTranslation?.id,
              language_code: lang.language_code,
              translated_name: existingTranslation?.translated_name || '',
              translated_description: existingTranslation?.translated_description || '',
            };
          }),
        });
      } else {
        setFormData({
          category_name: '',
          description: '',
          is_active: true,
          translations: languages.map(lang => ({
            language_code: lang.language_code,
            translated_name: '',
            translated_description: '',
          })),
        });
      }
      setErrors({});
      setActiveTab('basic');
    }
  }, [isOpen, category, languages]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.category_name.trim()) {
      newErrors.category_name = 'Category name is required';
    } else if (formData.category_name.length < 2) {
      newErrors.category_name = 'Category name must be at least 2 characters';
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description cannot exceed 500 characters';
    }

    const hasValidTranslation = formData.translations.some(t => t.translated_name.trim());
    if (!hasValidTranslation) {
      newErrors.translations = 'At least one translation name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the errors before submitting');
      return;
    }

    try {
      await onSave(formData);
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save category');
    }
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="4xl">
      <div className="px-6 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Category' : 'Create New Category'}
            </h2>
            <p className="text-sm text-gray-600">
              {isEditing 
                ? `Editing "${category?.category_name}"`
                : 'Add a new word category with translations'
              }
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('basic')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'basic'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Basic Information
            </button>
            <button
              onClick={() => setActiveTab('translations')}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'translations'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>Translations</span>
              {formData.translations.filter(t => t.translated_name.trim()).length > 0 && (
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                  {formData.translations.filter(t => t.translated_name.trim()).length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {activeTab === 'basic' && (
            <div className="space-y-6">
              {/* Category Name */}
              <div>
                <label htmlFor="category_name" className="block text-sm font-medium text-gray-700 mb-2">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="category_name"
                  value={formData.category_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, category_name: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                    errors.category_name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter category name..."
                  disabled={loading}
                />
                {errors.category_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.category_name}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                    errors.description ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter category description..."
                  disabled={loading}
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {formData.description.length}/500 characters
                </p>
              </div>

              {/* Active Status */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={loading}
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                  Active (visible to users)
                </label>
              </div>
            </div>
          )}

          {activeTab === 'translations' && (
            <div className="space-y-6">
              {errors.translations && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <p className="text-sm text-red-600">{errors.translations}</p>
                </div>
              )}

              <TranslationForm
                languages={languages}
                translations={formData.translations}
                onChange={(translations) => setFormData(prev => ({ ...prev, translations }))}
                errors={errors}
                disabled={loading}
                required={true}
                showGuidelines={true}
              />
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              {!Object.keys(errors).length && (
                <div className="flex items-center text-green-600">
                  <CheckCircleIcon className="h-4 w-4 mr-1" />
                  <span className="text-sm">Form is valid</span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <Button
                type="button"
                onClick={handleClose}
                variant="secondary"
                disabled={loading}
              >
                Cancel
              </Button>
              
              <Button
                type="submit"
                variant="primary"
                disabled={Object.keys(errors).length > 0 || loading}
                loading={loading}
              >
                {isEditing ? 'Update Category' : 'Create Category'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default AdminCategoriesPage;