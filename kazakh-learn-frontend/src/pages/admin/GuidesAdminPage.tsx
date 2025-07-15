// src/pages/admin/GuidesAdminPage.tsx - Updated with proper API calls and debugging

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Eye, 
  BookOpen, 
  Users, 
  Clock, 
  Target,
  Settings,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { adminGuidesAPI, Guide } from '../../services/adminGuidesAPI';
import AdminAPIDebug from '../../components/debug/AdminAPIDebug';

const GuidesAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showDebug, setShowDebug] = useState(false);

  // Fetch guides with error handling
  const { 
    data: guides = [], 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['admin-guides', searchTerm, filterDifficulty, filterStatus],
    queryFn: () => adminGuidesAPI.getGuides({
      search: searchTerm || undefined,
      difficulty: filterDifficulty || undefined,
      is_active: filterStatus === 'active' ? true : filterStatus === 'inactive' ? false : undefined,
      limit: 100
    }),
    retry: 1,
    staleTime: 30000, // 30 seconds
  });

  const handleCreateGuide = () => {
    // For now, show a message that this needs to be implemented
    toast.info('Create guide functionality will be implemented soon');
    // navigate('/admin/guides/create');
  };

  const handleEditGuide = (guideId: number) => {
    toast.info('Edit guide functionality will be implemented soon');
    // navigate(`/admin/guides/${guideId}/edit`);
  };

  const handleManageWords = (guideId: number) => {
    navigate(`/admin/guides/${guideId}/words`);
  };

  const handleDeleteGuide = async (guideId: number) => {
    if (window.confirm('Are you sure you want to delete this guide?')) {
      try {
        await adminGuidesAPI.deleteGuide(guideId);
        toast.success('Guide deleted successfully');
        refetch();
      } catch (error) {
        toast.error('Failed to delete guide');
        console.error('Delete error:', error);
      }
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Show error state with debug option
  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <h2 className="text-lg font-semibold text-red-900">
              Admin Guides API Error
            </h2>
          </div>
          
          <p className="text-red-800 mb-4">
            Failed to load learning guides. This usually means the admin endpoints are not properly configured.
          </p>
          
          <div className="bg-white p-4 rounded border border-red-200 mb-4">
            <p className="text-sm text-red-700 font-medium mb-2">Error Details:</p>
            <code className="text-xs text-red-600">
              {error instanceof Error ? error.message : 'Unknown error'}
            </code>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => refetch()}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </button>
            
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Settings className="h-4 w-4 mr-2" />
              {showDebug ? 'Hide' : 'Show'} Debug Tool
            </button>
          </div>

          {showDebug && (
            <div className="mt-6">
              <AdminAPIDebug />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Learning Guides</h1>
          <p className="text-gray-600">Manage learning guides and their content</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            Debug API
          </button>
          <button
            onClick={handleCreateGuide}
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Guide
          </button>
        </div>
      </div>

      {/* Debug Panel */}
      {showDebug && (
        <div className="mb-6">
          <AdminAPIDebug />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search guides..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Difficulty Filter */}
            <div className="w-full sm:w-48">
              <select
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Difficulties</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-48">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading guides...</span>
        </div>
      )}

      {/* Guides Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {guides.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No guides found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || filterDifficulty || filterStatus 
                  ? 'No guides match your current filters.'
                  : 'Get started by creating your first learning guide.'
                }
              </p>
              {!searchTerm && !filterDifficulty && !filterStatus && (
                <button
                  onClick={handleCreateGuide}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Your First Guide
                </button>
              )}
            </div>
          ) : (
            guides.map((guide) => (
              <div key={guide.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                {/* Guide Header */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                      {guide.title}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(guide.difficulty_level)}`}>
                      {guide.difficulty_level}
                    </span>
                  </div>

                  {guide.description && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {guide.description}
                    </p>
                  )}

                  {/* Guide Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center text-gray-600">
                      <Target className="h-4 w-4 mr-2" />
                      <span className="text-sm">
                        {guide.current_word_count}/{guide.target_word_count} words
                      </span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Clock className="h-4 w-4 mr-1" />
                      <span className="text-sm">
                        {guide.estimated_minutes ? `${guide.estimated_minutes} min` : 'No time set'}
                      </span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Users className="h-4 w-4 mr-1" />
                      <span className="text-sm">
                        {guide.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <BookOpen className="h-4 w-4 mr-1" />
                      <span className="text-sm">
                        ID: {guide.id}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{Math.round((guide.current_word_count / guide.target_word_count) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.min((guide.current_word_count / guide.target_word_count) * 100, 100)}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 bg-gray-50 border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleManageWords(guide.id)}
                        className="flex items-center px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                        title="Manage Words"
                      >
                        <BookOpen className="h-4 w-4 mr-1" />
                        Words ({guide.current_word_count})
                      </button>
                      <button
                        onClick={() => handleEditGuide(guide.id)}
                        className="flex items-center px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
                        title="Edit Guide"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </button>
                    </div>

                    <div className="flex space-x-1">
                      <button
                        onClick={() => navigate(`/guides/${guide.guide_key}`)}
                        className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
                        title="Preview Guide"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/admin/guides/${guide.id}/settings`)}
                        className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
                        title="Guide Settings"
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteGuide(guide.id)}
                        className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors"
                        title="Delete Guide"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                      <div>
                        Created: {new Date(guide.created_at).toLocaleDateString()}
                      </div>
                      <div>
                        Updated: {new Date(guide.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Quick Actions Footer */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">Quick Actions</h3>
            <p className="text-sm text-gray-600">Common administrative tasks</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => toast.info('Bulk import feature coming soon')}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              Bulk Import
            </button>
            <button
              onClick={() => toast.info('Analytics feature coming soon')}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              View Analytics
            </button>
            <button
              onClick={() => toast.info('Export feature coming soon')}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              Export Data
            </button>
          </div>
        </div>
      </div>

      {/* API Status Footer */}
      <div className="mt-6 text-center">
        <p className="text-xs text-gray-500">
          Loaded {guides.length} guides • 
          <button 
            onClick={() => refetch()} 
            className="ml-1 text-blue-600 hover:text-blue-800 underline"
          >
            Refresh
          </button>
        </p>
      </div>
    </div>
  );
};

export default GuidesAdminPage;