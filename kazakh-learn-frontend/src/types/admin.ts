// src/types/admin.ts
import type { Category, CategoryTranslation, Language } from './api';

// ===== FORM DATA TYPES =====

export interface CategoryFormData {
  category_name: string;
  description: string;
  is_active: boolean;
  translations: TranslationFormData[];
}

export interface TranslationFormData {
  id?: number;
  language_code: string;
  translated_name: string;
  translated_description: string;
}

// ===== ADMIN COMPONENT PROPS =====

export interface AdminTableColumn<T = any> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (value: any, item: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface AdminTableAction<T = any> {
  label: string;
  icon?: React.ReactNode;
  onClick: (item: T) => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: (item: T) => boolean;
  hidden?: (item: T) => boolean;
}

export interface AdminTableProps<T = any> {
  data: T[];
  columns: AdminTableColumn<T>[];
  actions?: AdminTableAction<T>[];
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  loading?: boolean;
  emptyMessage?: string;
  selectable?: boolean;
  selectedItems?: T[];
  onSelectionChange?: (items: T[]) => void;
  bulkActions?: AdminTableAction<T[]>[];
}

// ===== MODAL AND FORM TYPES =====

export interface CategoryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: Category | null;
  onSave: (categoryData: CategoryFormData) => Promise<void>;
  languages: Language[];
  loading?: boolean;
}

export interface TranslationFormProps {
  languages: Language[];
  translations: TranslationFormData[];
  onChange: (translations: TranslationFormData[]) => void;
  errors?: Record<string, string>;
  required?: boolean;
}

// ===== FILTER AND SEARCH TYPES =====

export interface AdminCategoryFilters {
  search?: string;
  status?: 'all' | 'active' | 'inactive';
  hasWords?: boolean;
  sortBy?: 'name' | 'created_at' | 'word_count' | 'status';
  sortDirection?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface AdminSearchState {
  term: string;
  filters: AdminCategoryFilters;
  results: Category[];
  loading: boolean;
  total: number;
}

// ===== VALIDATION TYPES =====

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface FormValidationState {
  isValid: boolean;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
}

export interface CategoryValidationRules {
  category_name: {
    required: boolean;
    minLength: number;
    maxLength: number;
    pattern?: RegExp;
    unique?: boolean;
  };
  description: {
    maxLength: number;
  };
  translations: {
    required: boolean;
    languages: string[];
    nameMaxLength: number;
    descriptionMaxLength: number;
  };
}

// ===== ADMIN DASHBOARD TYPES =====

export interface AdminDashboardMetrics {
  categories: {
    total: number;
    active: number;
    inactive: number;
    recentlyCreated: number;
  };
  words: {
    total: number;
    withoutCategory: number;
    averagePerCategory: number;
  };
  translations: {
    complete: number;
    incomplete: number;
    missingByLanguage: Record<string, number>;
  };
  activity: {
    categoriesCreatedToday: number;
    categoriesUpdatedToday: number;
    lastActivity: string;
  };
}

export interface AdminActivityLog {
  id: string;
  timestamp: string;
  user: {
    id: number;
    username: string;
    full_name: string;
  };
  action: 'create' | 'update' | 'delete' | 'activate' | 'deactivate';
  resource_type: 'category' | 'translation' | 'word';
  resource_id: number;
  resource_name: string;
  details?: Record<string, any>;
  ip_address?: string;
}

// ===== BULK OPERATIONS =====

export interface BulkOperationConfig {
  type: 'activate' | 'deactivate' | 'delete';
  confirmMessage: string;
  successMessage: string;
  errorMessage: string;
  icon?: React.ReactNode;
  variant: 'primary' | 'secondary' | 'danger';
}

export interface BulkOperationResult {
  success: boolean;
  processed: number;
  failed: number;
  errors?: string[];
}

// ===== ADMIN PERMISSIONS =====

export interface AdminPermissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canBulkEdit: boolean;
  canViewAnalytics: boolean;
  canManageTranslations: boolean;
}

// ===== ADMIN NAVIGATION =====

export interface AdminNavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  path: string;
  children?: AdminNavItem[];
  permissions?: string[];
  badge?: {
    count: number;
    variant: 'primary' | 'secondary' | 'danger' | 'warning';
  };
}

// ===== EXPORT UTILITIES =====

export interface ExportConfig {
  format: 'csv' | 'json' | 'xlsx';
  includeTranslations: boolean;
  includeInactive: boolean;
  language?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface ImportConfig {
  format: 'csv' | 'json' | 'xlsx';
  updateExisting: boolean;
  createTranslations: boolean;
  defaultLanguage: string;
  skipValidation: boolean;
}

export interface ImportResult {
  success: boolean;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{
    row: number;
    field?: string;
    message: string;
  }>;
}

// ===== ADMIN SETTINGS =====

export interface AdminSettings {
  defaultLanguage: string;
  requireTranslations: boolean;
  enableBulkOperations: boolean;
  itemsPerPage: number;
  enableActivityLog: boolean;
  enableAnalytics: boolean;
  autoSave: boolean;
  confirmDeletions: boolean;
}

// ===== REAL-TIME UPDATES =====

export interface AdminWebSocketEvent {
  type: 'category_created' | 'category_updated' | 'category_deleted' | 'translation_updated';
  data: {
    categoryId: number;
    categoryName: string;
    userId: number;
    userName: string;
    timestamp: string;
  };
}

// ===== COMPONENT STATE TYPES =====

export interface AdminCategoriesPageState {
  categories: Category[];
  loading: boolean;
  error: string | null;
  filters: AdminCategoryFilters;
  selectedCategories: number[];
  editingCategory: Category | null;
  showEditModal: boolean;
  showDeleteConfirm: boolean;
  bulkOperation: BulkOperationConfig | null;
}

export interface CategoryTableState {
  sortKey: string;
  sortDirection: 'asc' | 'desc';
  selectedRows: number[];
  expandedRows: number[];
  hoveredRow: number | null;
}

// ===== API RESPONSE TYPES =====

export interface AdminApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  errors?: ValidationError[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export interface AdminCategoryListResponse {
  categories: Category[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  stats: {
    active: number;
    inactive: number;
    withoutTranslations: number;
  };
}

// ===== CONSTANTS =====

export const ADMIN_CONSTANTS = {
  PAGINATION: {
    DEFAULT_LIMIT: 25,
    LIMITS: [10, 25, 50, 100],
  },
  VALIDATION: {
    CATEGORY_NAME_MIN_LENGTH: 2,
    CATEGORY_NAME_MAX_LENGTH: 50,
    DESCRIPTION_MAX_LENGTH: 500,
    TRANSLATION_NAME_MAX_LENGTH: 100,
    TRANSLATION_DESCRIPTION_MAX_LENGTH: 500,
  },
  LANGUAGES: ['en', 'kk', 'ru'] as const,
  BULK_OPERATION_LIMIT: 100,
} as const;

export type SupportedLanguage = typeof ADMIN_CONSTANTS.LANGUAGES[number];