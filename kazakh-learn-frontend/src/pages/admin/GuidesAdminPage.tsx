// src/pages/admin/GuidesAdminPage.tsx
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Edit,
  BookOpen,
  Target,
  Clock,
  Users,
  Plus,
  Eye,
  Settings,
  BarChart3,
  AlertCircle
} from 'lucide-react';

import api from '../../services/api';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

// Types
interface Guide {
  id: number;
  guide_key: string;
  title: string;
  description: string | null;
  difficulty_level: string;
  estimated_minutes: number | null;
  target_word_count: number;
  current_word_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// API Functions
const fetchAdminGuides = async (search?: string, difficulty?: string, isActive?: boolean) => {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (difficulty && difficulty !== 'all') params.append('difficulty', difficulty);
  if (isActive !== undefined) params.append('is_active', isActive.toString());
  
  const response = await api.get(`/admin/guides?${params}`);
  return response.data;
};

const GuidesAdminPage: React.FC = () => {
  const navigate = useNavigate();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);

  // Fetch guides
  const { data: guides = [], isLoading, error } = useQuery({
    queryKey: ['admin-guides', searchTerm, difficultyFilter, activeFilter],
    queryFn: () => fetchAdminGuides(searchTerm, difficultyFilter, activeFilter),
    staleTime: 5 * 60 * 1000,
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressColor = (current: number, target: number) => {
    const percentage = (current / target) * 100;
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Loading guides..." />;
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error loading guides</h2>
          <p className="text-gray-600">Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Learning Guides Management</h1>
            <p className="text-lg text-gray-600 mt-2">
              Manage learning guides and their word collections
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/guides/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Guide
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search guides by title, description, or key..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Difficulties</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>

            <select
              value={activeFilter === undefined ? 'all' : activeFilter.toString()}
              onChange={(e) => {
                const value = e.target.value;
                setActiveFilter(value === 'all' ? undefined : value === 'true');
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <BookOpen className="h-8 w-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Guides</p>
              <p className="text-2xl font-semibold text-gray-900">{guides.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Active Guides</p>
              <p className="text-2xl font-semibold text-gray-900">
                {guides.filter((g: Guide) => g.is_active).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <BarChart3 className="h-8 w-8 text-purple-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Avg Progress</p>
              <p className="text-2xl font-semibold text-gray-900">
                {guides.length > 0 ? 
                  Math.round(guides.reduce((acc: number, g: Guide) => acc + (g.current_word_count / g.target_word_count * 100), 0) / guides.length) 
                  : 0}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-orange-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Words</p>
              <p className="text-2xl font-semibold text-gray-900">
                {guides.reduce((acc: number, g: Guide) => acc + g.current_word_count, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Guides Grid */}
      {guides.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No guides found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || difficultyFilter !== 'all' || activeFilter !== undefined
              ? 'Try adjusting your filters'
              : 'Get started by creating your first learning guide'
            }
          </p>
          {!searchTerm && difficultyFilter === 'all' && activeFilter === undefined && (
            <button
              onClick={() => navigate('/admin/guides/new')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Create First Guide
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {guides.map((guide: Guide) => (
            <div key={guide.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="p-6 border-b">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {guide.title}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {guide.description || 'No description'}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(guide.difficulty_level)}`}>
                    {guide.difficulty_level}
                  </span>
                </div>

                {/* Guide Key */}
                <div className="text-xs text-gray-500 mb-3">
                  Key: {guide.guide_key}
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Words Progress</span>
                    <span>{guide.current_word_count} / {guide.target_word_count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(guide.current_word_count, guide.target_word_count)}`}
                      style={{ 
                        width: `${Math.min((guide.current_word_count / guide.target_word_count) * 100, 100)}%` 
                      }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {Math.round((guide.current_word_count / guide.target_word_count) * 100)}% complete
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center text-gray-600">
                    <Clock className="h-4 w-4 mr-1" />
                    {guide.estimated_minutes ? `${guide.estimated_minutes} min` : 'No time set'}
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Users className="h-4 w-4 mr-1" />
                    {guide.is_active ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => navigate(`/admin/guides/${guide.id}/words`)}
                      className="flex items-center px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                      title="Manage Words"
                    >
                      <BookOpen className="h-4 w-4 mr-1" />
                      Words ({guide.current_word_count})
                    </button>
                    <button
                      onClick={() => navigate(`/admin/guides/${guide.id}/edit`)}
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
          ))}
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
              onClick={() => navigate('/admin/guides/bulk-import')}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              Bulk Import
            </button>
            <button
              onClick={() => navigate('/admin/guides/analytics')}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              View Analytics
            </button>
            <button
              onClick={() => navigate('/admin/guides/export')}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              Export Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidesAdminPage;