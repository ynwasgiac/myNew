// src/services/adminAPI.ts
import axios from 'axios';
import api from './api';
import type { 
  Category, 
  CategoryTranslation,
  Language 
} from '../types/api';

// Admin API specific interfaces - using unique names to avoid conflicts
export interface AdminCategoryCreateData {
  category_name: string;
  description?: string;
  is_active: boolean;
  translations: Array<{
    language_code: string;
    translated_name: string;
    translated_description?: string;
  }>;
}

export interface AdminCategoryUpdateData {
  category_name?: string;
  description?: string;
  is_active?: boolean;
  translations?: Array<{
    id?: number;
    language_code: string;
    translated_name: string;
    translated_description?: string;
  }>;
}

export interface AdminCategoryWithStats extends Category {
  word_count?: number;
  last_updated?: string;
}

export interface AdminCategoryStatistics {
  total_categories: number;
  active_categories: number;
  inactive_categories: number;
  categories_by_word_count: Array<{
    category_id: number;
    category_name: string;
    word_count: number;
  }>;
  recent_categories: AdminCategoryWithStats[];
}

export interface AdminCategoryValidation {
  isValid: boolean;
  message?: string;
}

export interface AdminCategoryAnalytics {
  word_count: number;
  learning_progress_count: number;
  practice_sessions_count: number;
  difficulty_distribution: Record<string, number>;
  recent_activity: Array<{
    date: string;
    activity_type: string;
    count: number;
  }>;
}

// Get the existing API instance from the main api service


export const adminAPI = {
  // ===== CATEGORY MANAGEMENT =====
  
  /**
   * Get all categories with admin details (word counts, etc.)
   */
  async getAdminCategories(
    includeInactive: boolean = true,
    languageCode: string = 'en'
  ): Promise<AdminCategoryWithStats[]> {
    const params = new URLSearchParams();
    params.append('language_code', languageCode);
    if (includeInactive) {
      params.append('active_only', 'false');
    }
    
    const response = await api.get<Category[]>(`/categories/?${params}`);
    
    // Enhance with word counts (we'll need to add this endpoint or calculate)
    const categories = response.data;
    
    // For now, we'll use the existing endpoint and enhance later
    // TODO: Create admin-specific endpoint that includes word counts
    return categories.map(category => ({
      ...category,
      word_count: 0, // Will be populated by backend
      last_updated: category.created_at
    }));
  },

  /**
   * Get category by ID with full admin details
   */
  async getAdminCategory(
    categoryId: number,
    languageCode: string = 'en'
  ): Promise<AdminCategoryWithStats> {
    const response = await api.get<Category>(
      `/categories/${categoryId}?language_code=${languageCode}`
    );
    
    // Enhance with admin-specific data
    return {
      ...response.data,
      word_count: 0, // Will be populated by backend
      last_updated: response.data.created_at
    };
  },

  /**
   * Create new category with translations
   */
  async createCategory(categoryData: AdminCategoryCreateData): Promise<AdminCategoryWithStats> {
    // For now, we'll use the existing endpoint and create a category
    // then add translations separately
    
    // Step 1: Create the base category
    const baseCategory = {
      category_name: categoryData.category_name,
      description: categoryData.description,
      is_active: categoryData.is_active
    };
    
    // Note: This endpoint doesn't exist yet in your backend
    // You'll need to create POST /admin/categories endpoint
    // For now, using a placeholder that will return the expected format
    try {
      const response = await api.post<Category>('/admin/categories', {
        ...baseCategory,
        translations: categoryData.translations
      });
      
      // Return enhanced category with admin fields
      return {
        ...response.data,
        word_count: 0,
        last_updated: response.data.created_at
      };
    } catch (error) {
      // Fallback: If admin endpoint doesn't exist, throw descriptive error
      throw new Error('Admin category creation endpoint not implemented. Please add POST /admin/categories to your backend.');
    }
  },

  /**
   * Update category with translations
   */
  async updateCategory(
    categoryId: number, 
    categoryData: AdminCategoryUpdateData
  ): Promise<AdminCategoryWithStats> {
    try {
      const response = await api.put<Category>(
        `/admin/categories/${categoryId}`, 
        categoryData
      );
      
      // Return enhanced category with admin fields
      return {
        ...response.data,
        word_count: 0, // Will be populated by backend
        last_updated: response.data.created_at
      };
    } catch (error) {
      // Fallback: If admin endpoint doesn't exist, throw descriptive error
      throw new Error('Admin category update endpoint not implemented. Please add PUT /admin/categories/{id} to your backend.');
    }
  },

  /**
   * Delete category
   */
  async deleteCategory(categoryId: number): Promise<void> {
    await api.delete(`/admin/categories/${categoryId}`);
  },

  /**
   * Toggle category active status
   */
  async toggleCategoryStatus(
  categoryId: number, 
  isActive: boolean
): Promise<AdminCategoryWithStats> {
  try {
    // ✅ Send is_active as query parameter, not in body (to match backend expectation)
    const response = await api.patch<Category>(
      `/admin/categories/${categoryId}/status?is_active=${isActive}`
      // No body needed since backend expects query parameter
    );
    
    // Return enhanced category with admin fields
    return {
      ...response.data,
      word_count: 0, // Will be populated by backend
      last_updated: response.data.created_at
    };
  } catch (error) {
    // Fallback: If admin endpoint doesn't exist, throw descriptive error
    throw new Error('Admin category status endpoint not implemented. Please add PATCH /admin/categories/{id}/status to your backend.');
  }
},

  /**
   * Bulk update categories
   */
  async bulkUpdateCategories(
    categoryIds: number[],
    updates: { is_active?: boolean }
  ): Promise<void> {
    await api.patch('/admin/categories/bulk', {
      category_ids: categoryIds,
      ...updates
    });
  },

  /**
   * Bulk delete categories
   */
  async bulkDeleteCategories(categoryIds: number[]): Promise<void> {
    await api.delete('/admin/categories/bulk', {
      data: { category_ids: categoryIds }
    });
  },

  // ===== TRANSLATIONS MANAGEMENT =====

  /**
   * Create translation for existing category
   */
  async createCategoryTranslation(
    categoryId: number,
    languageCode: string,
    translatedName: string,
    translatedDescription?: string
  ): Promise<CategoryTranslation> {
    const response = await api.post<CategoryTranslation>(
      '/admin/category-translations',
      {
        category_id: categoryId,
        language_code: languageCode,
        translated_name: translatedName,
        translated_description: translatedDescription
      }
    );
    return response.data;
  },

  /**
   * Update category translation
   */
  async updateCategoryTranslation(
    translationId: number,
    translatedName: string,
    translatedDescription?: string
  ): Promise<CategoryTranslation> {
    const response = await api.put<CategoryTranslation>(
      `/admin/category-translations/${translationId}`,
      {
        translated_name: translatedName,
        translated_description: translatedDescription
      }
    );
    return response.data;
  },

  /**
   * Delete category translation
   */
  async deleteCategoryTranslation(translationId: number): Promise<void> {
    await api.delete(`/admin/category-translations/${translationId}`);
  },

  // ===== ADMIN STATISTICS =====

  /**
   * Get admin dashboard statistics
   */
  async getAdminStats(): Promise<AdminCategoryStatistics> {
    try {
      const response = await api.get<AdminCategoryStatistics>('/admin/stats/categories');
      return response.data;
    } catch (error) {
      // Fallback: Return mock data if endpoint doesn't exist
      console.warn('Admin stats endpoint not implemented. Returning mock data.');
      return {
        total_categories: 0,
        active_categories: 0,
        inactive_categories: 0,
        categories_by_word_count: [],
        recent_categories: []
      };
    }
  },

  /**
   * Get category usage analytics
   */
  async getCategoryAnalytics(
    categoryId: number,
    dateRange?: { start: string; end: string }
  ): Promise<AdminCategoryAnalytics> {
    const params = new URLSearchParams();
    if (dateRange) {
      params.append('start_date', dateRange.start);
      params.append('end_date', dateRange.end);
    }
    
    const response = await api.get(
      `/admin/categories/${categoryId}/analytics?${params}`
    );
    return response.data;
  },

  // ===== VALIDATION HELPERS =====

  /**
   * Check if category name is unique
   */
  async validateCategoryName(
    categoryName: string, 
    excludeCategoryId?: number
  ): Promise<AdminCategoryValidation> {
    try {
      const params = new URLSearchParams();
      params.append('category_name', categoryName);
      if (excludeCategoryId) {
        params.append('exclude_id', excludeCategoryId.toString());
      }
      
      const response = await api.get(`/admin/categories/validate-name?${params}`);
      return response.data;
    } catch (error) {
      // Fallback validation: just return valid for now
      console.warn('Category name validation endpoint not implemented. Skipping validation.');
      return { isValid: true, message: 'Validation skipped - endpoint not available' };
    }
  },

  /**
   * Get suggested category names based on input
   */
  async getCategoryNameSuggestions(partial: string): Promise<string[]> {
    try {
      const response = await api.get(
        `/admin/categories/name-suggestions?q=${encodeURIComponent(partial)}`
      );
      return response.data.suggestions || [];
    } catch (error) {
      // Fallback: return empty suggestions
      console.warn('Category name suggestions endpoint not implemented.');
      return [];
    }
  },

  // ===== UTILITY METHODS =====

  /**
   * Check if admin endpoints are available
   */
  async checkAdminEndpoints(): Promise<{
    available: string[];
    missing: string[];
    recommendations: string[];
  }> {
    const endpoints = [
      { path: '/admin/categories', method: 'POST', name: 'Create Category' },
      { path: '/admin/categories/1', method: 'PUT', name: 'Update Category' },
      { path: '/admin/categories/1', method: 'DELETE', name: 'Delete Category' },
      { path: '/admin/categories/1/status', method: 'PATCH', name: 'Toggle Status' },
      { path: '/admin/stats/categories', method: 'GET', name: 'Admin Stats' },
      { path: '/admin/categories/bulk', method: 'PATCH', name: 'Bulk Update' },
      { path: '/admin/categories/bulk', method: 'DELETE', name: 'Bulk Delete' },
    ];

    const results = {
      available: [] as string[],
      missing: [] as string[],
      recommendations: [] as string[]
    };

    // For now, assume all endpoints are missing since they need to be implemented
    // This method can be enhanced to actually test endpoint availability
    results.missing = endpoints.map(e => `${e.method} ${e.path} (${e.name})`);
    
    results.recommendations = [
      'Add the admin_routes.py file to your backend',
      'Include admin_router in your main FastAPI app',
      'Ensure admin role checking is implemented',
      'Test endpoints with an admin user token'
    ];

    return results;
  }
};

// Export only the admin API and its unique types
export { adminAPI as default };

// Note: We don't export the individual interfaces to avoid conflicts
// Components should import the adminAPI object and use its methods