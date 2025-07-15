// src/services/adminGuidesAPI.ts - API service for admin guides management

import api from './api';

export interface Guide {
  id: number;
  guide_key: string;
  title: string;
  description?: string;
  difficulty_level: string;
  target_word_count: number;
  current_word_count: number;
  estimated_minutes?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GuideWordMapping {
  id: number;
  guide_id: number;
  kazakh_word_id: number;
  order_in_guide: number;
  importance_score: number;
  is_active: boolean;
  added_at: string;
  kazakh_word: {
    id: number;
    kazakh_word: string;
    kazakh_cyrillic: string;
    category_name: string;
    difficulty_level: number;
  };
}

export interface CreateGuideRequest {
  title: string;
  description?: string;
  difficulty_level: string;
  target_word_count: number;
  estimated_minutes?: number;
  is_active?: boolean;
}

export interface AddWordsToGuideRequest {
  word_ids: number[];
  importance_score?: number;
  auto_order?: boolean;
}

class AdminGuidesAPI {
  private baseUrl = '/admin';

  /**
   * Get all learning guides for admin management
   */
  async getGuides(params?: {
    skip?: number;
    limit?: number;
    difficulty?: string;
    is_active?: boolean;
    search?: string;
  }): Promise<Guide[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString());
      if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
      if (params?.difficulty) queryParams.append('difficulty', params.difficulty);
      if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString());
      if (params?.search) queryParams.append('search', params.search);

      const url = `${this.baseUrl}/guides${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      console.log('Fetching guides from:', url);
      
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching guides:', error);
      // Fallback to empty array if endpoint doesn't exist yet
      if (error instanceof Error && error.message.includes('404')) {
        console.warn('Admin guides endpoint not found. Returning empty array.');
        return [];
      }
      throw error;
    }
  }

  /**
   * Create a new learning guide
   */
  async createGuide(data: CreateGuideRequest): Promise<Guide> {
    try {
      const response = await api.post(`${this.baseUrl}/guides`, data);
      return response.data;
    } catch (error) {
      console.error('Error creating guide:', error);
      throw error;
    }
  }

  /**
   * Update an existing guide
   */
  async updateGuide(guideId: number, data: Partial<CreateGuideRequest>): Promise<Guide> {
    try {
      const response = await api.put(`${this.baseUrl}/guides/${guideId}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating guide:', error);
      throw error;
    }
  }

  /**
   * Delete a guide
   */
  async deleteGuide(guideId: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`${this.baseUrl}/guides/${guideId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting guide:', error);
      throw error;
    }
  }

  /**
   * Get words assigned to a specific guide
   */
  async getGuideWords(
    guideId: number,
    params?: {
      skip?: number;
      limit?: number;
      search?: string;
      sort_by?: string;
      sort_direction?: string;
    }
  ): Promise<GuideWordMapping[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString());
      if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
      if (params?.search) queryParams.append('search', params.search);
      if (params?.sort_by) queryParams.append('sort_by', params.sort_by);
      if (params?.sort_direction) queryParams.append('sort_direction', params.sort_direction);

      const url = `${this.baseUrl}/guides/${guideId}/words${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching guide words:', error);
      if (error instanceof Error && error.message.includes('404')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Add words to a guide
   */
  async addWordsToGuide(guideId: number, data: AddWordsToGuideRequest): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post(`${this.baseUrl}/guides/${guideId}/words`, data);
      return response.data;
    } catch (error) {
      console.error('Error adding words to guide:', error);
      throw error;
    }
  }

  /**
   * Remove a word from a guide
   */
  async removeWordFromGuide(guideId: number, mappingId: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`${this.baseUrl}/guides/${guideId}/words/${mappingId}`);
      return response.data;
    } catch (error) {
      console.error('Error removing word from guide:', error);
      throw error;
    }
  }

  /**
   * Update word mapping in guide (order, importance, etc.)
   */
  async updateGuideWordMapping(
    guideId: number, 
    mappingId: number, 
    data: { order_in_guide?: number; importance_score?: number; is_active?: boolean }
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.put(`${this.baseUrl}/guides/${guideId}/words/${mappingId}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating guide word mapping:', error);
      throw error;
    }
  }

  /**
   * Reorder words in a guide
   */
  async reorderGuideWords(
    guideId: number, 
    wordOrders: Array<{ mapping_id: number; order: number }>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post(`${this.baseUrl}/guides/${guideId}/words/reorder`, wordOrders);
      return response.data;
    } catch (error) {
      console.error('Error reordering guide words:', error);
      throw error;
    }
  }

  /**
   * Get available words that can be added to guides
   */
  async getAvailableWords(params?: {
    search?: string;
    category_id?: number;
    difficulty_level?: number;
    limit?: number;
  }): Promise<any[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.append('search', params.search);
      if (params?.category_id) queryParams.append('category_id', params.category_id.toString());
      if (params?.difficulty_level) queryParams.append('difficulty_level', params.difficulty_level.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());

      // Use the regular words endpoint for now
      const url = `/words${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching available words:', error);
      return [];
    }
  }

  /**
   * Test if admin guides endpoints are available
   */
  async testEndpoints(): Promise<{
    available: boolean;
    endpoints: { [key: string]: boolean };
    error?: string;
  }> {
    const endpoints = {
      'GET /admin/guides': false,
      'POST /admin/guides': false,
      'GET /admin/guides/:id/words': false,
    };

    try {
      // Test the main guides endpoint
      await this.getGuides({ limit: 1 });
      endpoints['GET /admin/guides'] = true;

      return {
        available: true,
        endpoints
      };
    } catch (error) {
      return {
        available: false,
        endpoints,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const adminGuidesAPI = new AdminGuidesAPI();
export default adminGuidesAPI;