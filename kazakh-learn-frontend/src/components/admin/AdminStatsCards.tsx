// src/components/admin/AdminStatsCards.tsx
import React from 'react';
import { 
  FolderIcon,
  EyeIcon,
  EyeSlashIcon,
  BookOpenIcon,
  GlobeAltIcon 
} from '@heroicons/react/24/outline';

import { useTranslation } from 'react-i18next';

// Define the stats interface locally to avoid import conflicts
interface StatsData {
  total_categories: number;
  active_categories: number;
  inactive_categories: number;
  categories_by_word_count?: Array<{
    category_id: number;
    category_name: string;
    word_count: number;
  }>;
}

interface AdminStatsCardsProps {
  stats: StatsData;
}

const AdminStatsCards: React.FC<AdminStatsCardsProps> = ({ stats }) => {
  const { t } = useTranslation('admin');

  const cards = [
    {
      title: t('stats.totalCategories'),
      value: stats.total_categories || 0,
      icon: <FolderIcon className="h-6 w-6" />,
      color: 'blue',
      change: undefined,
    },
    {
      title: t('stats.activeCategories'),
      value: stats.active_categories || 0,
      icon: <EyeIcon className="h-6 w-6" />,
      color: 'green',
      change: undefined,
    },
    {
      title: t('stats.inactiveCategories'),
      value: stats.inactive_categories || 0,
      icon: <EyeSlashIcon className="h-6 w-6" />,
      color: 'gray',
      change: undefined,
    },
    {
      title: t('stats.categoriesWithWords'),
      value: stats.categories_by_word_count?.filter(c => c.word_count > 0).length || 0,
      icon: <BookOpenIcon className="h-6 w-6" />,
      color: 'purple',
      change: undefined,
    },
  ];

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
      blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'text-blue-500' },
      green: { bg: 'bg-green-50', text: 'text-green-600', icon: 'text-green-500' },
      gray: { bg: 'bg-gray-50', text: 'text-gray-600', icon: 'text-gray-500' },
      purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'text-purple-500' },
      yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600', icon: 'text-yellow-500' },
    };
    return colorMap[color] || colorMap.blue;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => {
        const colors = getColorClasses(card.color);
        
        return (
          <div
            key={index}
            className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {card.title}
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {card.value.toLocaleString()}
                </p>
                {card.change && (
                  <div className="flex items-center mt-2">
                    <BookOpenIcon className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">
                      +{card.change}% {t('stats.fromLastMonth', 'vs last month')}
                    </span>
                  </div>
                )}
              </div>
              
              <div className={`p-3 rounded-full ${colors.bg}`}>
                <div className={colors.icon}>
                  {card.icon}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AdminStatsCards;