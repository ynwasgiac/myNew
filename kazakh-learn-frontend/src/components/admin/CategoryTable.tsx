// src/components/admin/CategoryTable.tsx
import React, { useState } from 'react';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  GlobeAltIcon,
  BookOpenIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

import { useTranslation } from 'react-i18next';
import type { Category } from '../../types/api';

import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface CategoryTableProps {
  categories: Category[];
  selectedCategories: number[];
  onSelectionChange: (selectedIds: number[]) => void;
  onSort: (key: string) => void;
  sortKey: string;
  sortDirection: 'asc' | 'desc';
  onEdit: (category: Category) => void;
  onDelete: (categoryId: number) => void;
  onToggleStatus: (categoryId: number, isActive: boolean) => void;
  loading?: boolean;
}

const CategoryTable: React.FC<CategoryTableProps> = ({
  categories,
  selectedCategories,
  onSelectionChange,
  onSort,
  sortKey,
  sortDirection,
  onEdit,
  onDelete,
  onToggleStatus,
  loading = false,
}) => {
  const { t } = useTranslation('admin');
  const [expandedRows, setExpandedRows] = useState<number[]>([]);

  const toggleSelectAll = () => {
    if (selectedCategories.length === categories.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(categories.map(c => c.id));
    }
  };

  const toggleSelectCategory = (categoryId: number) => {
    if (selectedCategories.includes(categoryId)) {
      onSelectionChange(selectedCategories.filter(id => id !== categoryId));
    } else {
      onSelectionChange([...selectedCategories, categoryId]);
    }
  };

  const toggleExpandRow = (categoryId: number) => {
    if (expandedRows.includes(categoryId)) {
      setExpandedRows(expandedRows.filter(id => id !== categoryId));
    } else {
      setExpandedRows([...expandedRows, categoryId]);
    }
  };

  const getSortIcon = (columnKey: string) => {
    if (sortKey !== columnKey) {
      return <div className="w-4 h-4" />; // Placeholder for spacing
    }
    return sortDirection === 'asc' 
      ? <ChevronUpIcon className="w-4 h-4" />
      : <ChevronDownIcon className="w-4 h-4" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTranslationSummary = (category: Category) => {
    const translations = category.translations || [];
    const totalLanguages = 3; // en, kk, ru
    const hasTranslations = translations.filter(t => t.translated_name).length;
    
    return {
      completed: hasTranslations,
      total: totalLanguages,
      percentage: Math.round((hasTranslations / totalLanguages) * 100),
    };
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <LoadingSpinner text={t('loading.categories')} />
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="text-6xl mb-4">📚</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {t('table.noCategories')}
        </h3>
        <p className="text-gray-600">
          {t('table.noCategoriesMessage')}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          {/* Table Header */}
          <thead className="bg-gray-50">
            <tr>
              {/* Select All Checkbox */}
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedCategories.length === categories.length && categories.length > 0}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </th>

              {/* Category Name */}
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => onSort('name')}
                  className="group flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                >
                  <span>{t('table.columns.name')}</span>
                  {getSortIcon('name')}
                </button>
              </th>

              {/* Status */}
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => onSort('status')}
                  className="group flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                >
                  <span>{t('table.columns.status')}</span>
                  {getSortIcon('status')}
                </button>
              </th>

              {/* Translations */}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.columns.translations')}
              </th>

              {/* Word Count */}
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => onSort('word_count')}
                  className="group flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                >
                  <span>{t('table.columns.words')}</span>
                  {getSortIcon('word_count')}
                </button>
              </th>

              {/* Created Date */}
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => onSort('created_at')}
                  className="group flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                >
                  <span>{t('table.columns.created')}</span>
                  {getSortIcon('created_at')}
                </button>
              </th>

              {/* Actions */}
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.columns.actions')}
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="bg-white divide-y divide-gray-200">
            {categories.map((category) => {
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
                        onChange={() => toggleSelectCategory(category.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>

                    {/* Category Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {translatedName}
                            </p>
                            {category.translations && category.translations.length > 0 && (
                              <button
                                onClick={() => toggleExpandRow(category.id)}
                                className="text-blue-600 hover:text-blue-800"
                                title={t('table.actions.viewTranslations')}
                              >
                                <GlobeAltIcon className="h-4 w-4" />
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
                        {category.is_active ? t('status.active') : t('status.inactive')}
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

                    {/* Word Count */}
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1">
                        <BookOpenIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {(category as any).word_count || 0}
                        </span>
                      </div>
                    </td>

                    {/* Created Date */}
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
                          onClick={() => onToggleStatus(category.id, !category.is_active)}
                          variant="secondary"
                          size="sm"
                          icon={category.is_active ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                          title={category.is_active ? t('table.actions.deactivate') : t('table.actions.activate')}
                        />
                        
                        <Button
                          onClick={() => onEdit(category)}
                          variant="secondary"
                          size="sm"
                          icon={<PencilIcon className="h-4 w-4" />}
                          title={t('table.actions.edit')}
                        />
                        
                        <Button
                          onClick={() => onDelete(category.id)}
                          variant="danger"
                          size="sm"
                          icon={<TrashIcon className="h-4 w-4" />}
                          title={t('table.actions.delete')}
                        />
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Translation Details */}
                  {isExpanded && (
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-900">
                            {t('table.translationDetails')}
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
                                    {translation.translated_name ? t('status.complete') : t('status.missing')}
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
                                    {t('table.noTranslation')}
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
    </div>
  );
};

export default CategoryTable;