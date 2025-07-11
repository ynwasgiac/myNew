// src/components/admin/BulkActionsBar.tsx
import React from 'react';
import { 
  EyeIcon, 
  EyeSlashIcon, 
  TrashIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline';

import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';

interface BulkActionsBarProps {
  selectedCount: number;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  onClear?: () => void;
  loading?: boolean;
}

const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  onActivate,
  onDeactivate,
  onDelete,
  onClear,
  loading = false,
}) => {
  const { t } = useTranslation('admin');

  if (selectedCount === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium text-blue-900">
              {t('bulk.selectedItems', { count: selectedCount })}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              onClick={onActivate}
              variant="secondary"
              size="sm"
              icon={<EyeIcon className="h-4 w-4" />}
              disabled={loading}
            >
              {t('bulk.activate')}
            </Button>
            
            <Button
              onClick={onDeactivate}
              variant="secondary"
              size="sm"
              icon={<EyeSlashIcon className="h-4 w-4" />}
              disabled={loading}
            >
              {t('bulk.deactivate')}
            </Button>
            
            <Button
              onClick={onDelete}
              variant="danger"
              size="sm"
              icon={<TrashIcon className="h-4 w-4" />}
              disabled={loading}
            >
              {t('bulk.delete')}
            </Button>
          </div>
        </div>

        {onClear && (
          <Button
            onClick={onClear}
            variant="secondary"
            size="sm"
            icon={<XMarkIcon className="h-4 w-4" />}
            disabled={loading}
          >
            {t('actions.clearSelection', 'Clear')}
          </Button>
        )}
      </div>
    </div>
  );
};

export default BulkActionsBar;