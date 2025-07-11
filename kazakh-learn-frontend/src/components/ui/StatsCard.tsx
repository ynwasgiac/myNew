// src/components/ui/StatsCard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpIcon, ArrowDownIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color?: string;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
    period?: string;
  };
  link?: string;
  description?: string;
  loading?: boolean;
  className?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon: Icon,
  color = 'bg-blue-500',
  change,
  link,
  description,
  loading = false,
  className = ''
}) => {
  const getChangeIcon = () => {
    if (!change) return null;
    
    switch (change.type) {
      case 'increase':
        return <ArrowUpIcon className="h-4 w-4 text-green-500" />;
      case 'decrease':
        return <ArrowDownIcon className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getChangeColor = () => {
    if (!change) return '';
    
    switch (change.type) {
      case 'increase':
        return 'text-green-600';
      case 'decrease':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const cardContent = (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-all duration-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {Icon && (
            <div className={`${color} p-2 rounded-lg mr-3`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          </div>
        </div>
        {link && (
          <ArrowRightIcon className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>

      {/* Value */}
      <div className="mt-4">
        {loading ? (
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-20 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-16"></div>
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold text-gray-900">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
            
            {/* Change indicator */}
            {change && (
              <div className="flex items-center mt-2">
                {getChangeIcon()}
                <span className={`text-sm font-medium ml-1 ${getChangeColor()}`}>
                  {Math.abs(change.value)}%
                </span>
                {change.period && (
                  <span className="text-sm text-gray-500 ml-1">
                    {change.period}
                  </span>
                )}
              </div>
            )}
            
            {/* Description */}
            {description && (
              <p className="text-sm text-gray-600 mt-1">{description}</p>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (link) {
    return (
      <Link to={link} className="group block">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
};

export default StatsCard;