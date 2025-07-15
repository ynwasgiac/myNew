// src/pages/admin/GuideWordsAdminPage.tsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  ArrowUp,
  ArrowDown,
  Book,
  Target,
  Clock,
  Users,
  Save,
  X,
  AlertCircle,
  BookOpen
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import api from '../../services/api';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';

// Types
interface GuideWordMapping {
  id: number;
  guide_id: number;
  kazakh_word_id: number;
  importance_score: number;
  order_in_guide: number | null;
  is_active: boolean;
  created_at: string;
  kazakh_word: string;
  kazakh_cyrillic: string | null;
  category_name: string;
  difficulty_level: number;
  primary_translation: string | null;
}

interface Guide {
  id: number;
  guide_key: string;
  title: string;
  description: string | null;
  difficulty_level: string;
  target_word_count: number;
  current_word_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface WordOption {
  id: number;
  kazakh_word: string;
  kazakh_cyrillic: string | null;
  category_name: string;
  difficulty_level: number;
  primary_translation: string | null;
}

// API Functions
const fetchGuideWords = async (guideId: number, search?: string, sortBy?: string, sortDirection?: string) => {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (sortBy) params.append('sort_by', sortBy);
  if (sortDirection) params.append('sort_direction', sortDirection);
  
  const response = await api.get(`/admin/guides/${guideId}/words?${params}`);
  return response.data;
};

const fetchGuide = async (guideId: number) => {
  const response = await api.get(`/admin/guides`);
  const guides = response.data;
  return guides.find((g: Guide) => g.id === guideId);
};

const fetchAvailableWords = async (search?: string) => {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  params.append('limit', '100');
  
  const response = await api.get(`/admin/words?${params}`);
  return response.data;
};

const addWordsToGuide = async (guideId: number, data: { word_ids: number[]; importance_score: number; auto_order: boolean }) => {
  const response = await api.post(`/admin/guides/${guideId}/words`, data);
  return response.data;
};

const updateGuideWordMapping = async (guideId: number, mappingId: number, data: any) => {
  const response = await api.put(`/admin/guides/${guideId}/words/${mappingId}`, data);
  return response.data;
};

const removeWordFromGuide = async (guideId: number, mappingId: number) => {
  const response = await api.delete(`/admin/guides/${guideId}/words/${mappingId}`);
  return response.data;
};

const reorderGuideWords = async (guideId: number, wordOrders: Array<{mapping_id: number; order: number}>) => {
  const response = await api.post(`/admin/guides/${guideId}/words/reorder`, wordOrders);
  return response.data;
};

const GuideWordsAdminPage: React.FC = () => {
  const { guideId } = useParams<{ guideId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('order_in_guide');
  const [sortDirection, setSortDirection] = useState('asc');
  const [showAddWordsModal, setShowAddWordsModal] = useState(false);
  const [editingMapping, setEditingMapping] = useState<GuideWordMapping | null>(null);
  const [selectedWords, setSelectedWords] = useState<number[]>([]);
  const [importanceScore, setImportanceScore] = useState(1.0);
  const [autoOrder, setAutoOrder] = useState(true);
  const [wordSearch, setWordSearch] = useState('');

  const guideIdNum = parseInt(guideId || '0');

  // Fetch guide details
  const { data: guide, isLoading: guideLoading } = useQuery({
    queryKey: ['admin-guide', guideIdNum],
    queryFn: () => fetchGuide(guideIdNum),
    enabled: !!guideIdNum
  });

  // Fetch guide words
  const { data: guideWords = [], isLoading: wordsLoading, refetch: refetchWords } = useQuery({
    queryKey: ['admin-guide-words', guideIdNum, searchTerm, sortBy, sortDirection],
    queryFn: () => fetchGuideWords(guideIdNum, searchTerm, sortBy, sortDirection),
    enabled: !!guideIdNum
  });

  // Fetch available words for adding
  const { data: availableWords = [], isLoading: availableWordsLoading } = useQuery({
    queryKey: ['admin-available-words', wordSearch],
    queryFn: () => fetchAvailableWords(wordSearch),
    enabled: showAddWordsModal
  });

  // Mutations
  const addWordsMutation = useMutation({
    mutationFn: (data: { word_ids: number[]; importance_score: number; auto_order: boolean }) =>
      addWordsToGuide(guideIdNum, data),
    onSuccess: (data) => {
      toast.success(data.message);
      setShowAddWordsModal(false);
      setSelectedWords([]);
      queryClient.invalidateQueries({ queryKey: ['admin-guide-words', guideIdNum] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to add words');
    }
  });

  const updateMappingMutation = useMutation({
    mutationFn: ({ mappingId, data }: { mappingId: number; data: any }) =>
      updateGuideWordMapping(guideIdNum, mappingId, data),
    onSuccess: () => {
      toast.success('Word mapping updated');
      setEditingMapping(null);
      refetchWords();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update mapping');
    }
  });

  const removeMutation = useMutation({
    mutationFn: (mappingId: number) => removeWordFromGuide(guideIdNum, mappingId),
    onSuccess: () => {
      toast.success('Word removed from guide');
      refetchWords();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to remove word');
    }
  });

  const reorderMutation = useMutation({
    mutationFn: (wordOrders: Array<{mapping_id: number; order: number}>) =>
      reorderGuideWords(guideIdNum, wordOrders),
    onSuccess: () => {
      toast.success('Words reordered successfully');
      refetchWords();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to reorder words');
    }
  });

  const handleAddWords = () => {
    if (selectedWords.length === 0) {
      toast.error('Please select at least one word');
      return;
    }

    addWordsMutation.mutate({
      word_ids: selectedWords,
      importance_score: importanceScore,
      auto_order: autoOrder
    });
  };

  const handleUpdateMapping = (data: any) => {
    if (!editingMapping) return;
    
    updateMappingMutation.mutate({
      mappingId: editingMapping.id,
      data
    });
  };

  const handleMoveWord = (mapping: GuideWordMapping, direction: 'up' | 'down') => {
    const currentOrder = mapping.order_in_guide || 0;
    const newOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;
    
    updateMappingMutation.mutate({
      mappingId: mapping.id,
      data: { order_in_guide: newOrder }
    });
  };

  const getDifficultyColor = (level: number) => {
    if (level <= 2) return 'bg-green-100 text-green-800';
    if (level <= 4) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getDifficultyLabel = (level: number) => {
    if (level <= 2) return 'Beginner';
    if (level <= 4) return 'Intermediate';
    return 'Advanced';
  };

  if (guideLoading) {
    return <LoadingSpinner fullScreen text="Loading guide..." />;
  }

  if (!guide) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Guide not found</h2>
          <button
            onClick={() => navigate('/admin/guides')}
            className="text-blue-600 hover:text-blue-800"
          >
            ← Back to guides
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/admin/guides')}
          className="text-blue-600 hover:text-blue-800 mb-4 inline-flex items-center"
        >
          ← Back to guides
        </button>
        
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {guide.title}
              </h1>
              <p className="text-gray-600 mb-4">{guide.description}</p>
              
              <div className="flex items-center space-x-6 text-sm">
                <div className="flex items-center">
                  <BookOpen className="h-4 w-4 text-gray-400 mr-1" />
                  <span>Current: {guide.current_word_count} words</span>
                </div>
                <div className="flex items-center">
                  <Book className="h-4 w-4 text-gray-400 mr-1" />
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    guide.difficulty_level === 'beginner' ? 'bg-green-100 text-green-800' :
                    guide.difficulty_level === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {guide.difficulty_level}
                  </span>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setShowAddWordsModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Words
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Progress towards target</span>
              <span>{Math.round((guide.current_word_count / guide.target_word_count) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((guide.current_word_count / guide.target_word_count) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search words..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="order_in_guide">Order</option>
              <option value="kazakh_word">Kazakh Word</option>
              <option value="importance_score">Importance</option>
              <option value="difficulty">Difficulty</option>
            </select>
            
            <button
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {sortDirection === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* Words List */}
      {wordsLoading ? (
        <LoadingSpinner fullScreen text="Loading words..." />
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {guideWords.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No words in this guide</h3>
              <p className="text-gray-600 mb-4">Start by adding some words to this learning guide.</p>
              <button
                onClick={() => setShowAddWordsModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Add Words
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kazakh Word
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Translation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Difficulty
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Importance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {guideWords.map((mapping: GuideWordMapping) => (
                    <tr key={mapping.id} className={!mapping.is_active ? 'opacity-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{mapping.order_in_guide || '-'}</span>
                          {mapping.order_in_guide && (
                            <div className="flex flex-col">
                              <button
                                onClick={() => handleMoveWord(mapping, 'up')}
                                className="p-1 text-gray-400 hover:text-gray-600"
                                disabled={updateMappingMutation.isPending}
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleMoveWord(mapping, 'down')}
                                className="p-1 text-gray-400 hover:text-gray-600"
                                disabled={updateMappingMutation.isPending}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {mapping.kazakh_word}
                          </div>
                          {mapping.kazakh_cyrillic && (
                            <div className="text-sm text-gray-500">
                              {mapping.kazakh_cyrillic}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {mapping.primary_translation || 'No translation'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {mapping.category_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(mapping.difficulty_level)}`}>
                          {getDifficultyLabel(mapping.difficulty_level)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {mapping.importance_score.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setEditingMapping(mapping)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to remove this word from the guide?')) {
                                removeMutation.mutate(mapping.id);
                              }
                            }}
                            className="text-red-600 hover:text-red-900"
                            disabled={removeMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Words Modal */}
      <Modal
        isOpen={showAddWordsModal}
        onClose={() => setShowAddWordsModal(false)}
        title="Add Words to Guide"
        size="large"
      >
        <div className="space-y-4">
          {/* Search for words */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Words
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search for words to add..."
                value={wordSearch}
                onChange={(e) => setWordSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Importance Score
              </label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={importanceScore}
                onChange={(e) => setImportanceScore(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Auto Order
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={autoOrder}
                  onChange={(e) => setAutoOrder(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-600">
                  Automatically assign order numbers
                </span>
              </label>
            </div>
          </div>

          {/* Available Words */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Available Words ({selectedWords.length} selected)
            </label>
            <div className="border border-gray-300 rounded-lg max-h-96 overflow-y-auto">
              {availableWordsLoading ? (
                <div className="p-4 text-center">
                  <LoadingSpinner text="Loading words..." />
                </div>
              ) : availableWords.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No words found
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {availableWords.map((word: WordOption) => (
                    <label key={word.id} className="flex items-center p-3 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedWords.includes(word.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedWords([...selectedWords, word.id]);
                          } else {
                            setSelectedWords(selectedWords.filter(id => id !== word.id));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">{word.kazakh_word}</div>
                            {word.kazakh_cyrillic && (
                              <div className="text-sm text-gray-500">{word.kazakh_cyrillic}</div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-600">{word.primary_translation}</div>
                            <div className="text-xs text-gray-500">{word.category_name}</div>
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              onClick={() => setShowAddWordsModal(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleAddWords}
              disabled={selectedWords.length === 0 || addWordsMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
            >
              {addWordsMutation.isPending ? 'Adding...' : `Add ${selectedWords.length} Words`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Mapping Modal */}
      {editingMapping && (
        <EditMappingModal
          mapping={editingMapping}
          onSave={handleUpdateMapping}
          onClose={() => setEditingMapping(null)}
          isLoading={updateMappingMutation.isPending}
        />
      )}
    </div>
  );
};

// Edit Mapping Modal Component
interface EditMappingModalProps {
  mapping: GuideWordMapping;
  onSave: (data: any) => void;
  onClose: () => void;
  isLoading: boolean;
}

const EditMappingModal: React.FC<EditMappingModalProps> = ({
  mapping,
  onSave,
  onClose,
  isLoading
}) => {
  const [importanceScore, setImportanceScore] = useState(mapping.importance_score);
  const [orderInGuide, setOrderInGuide] = useState(mapping.order_in_guide || 0);
  const [isActive, setIsActive] = useState(mapping.is_active);

  const handleSave = () => {
    onSave({
      importance_score: importanceScore,
      order_in_guide: orderInGuide || null,
      is_active: isActive
    });
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Edit Word Mapping"
    >
      <div className="space-y-4">
        {/* Word Info */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="font-medium text-gray-900">{mapping.kazakh_word}</div>
          {mapping.kazakh_cyrillic && (
            <div className="text-sm text-gray-500">{mapping.kazakh_cyrillic}</div>
          )}
          <div className="text-sm text-gray-600">{mapping.primary_translation}</div>
        </div>

        {/* Form Fields */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Importance Score (0-10)
          </label>
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={importanceScore}
            onChange={(e) => setImportanceScore(parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Order in Guide
          </label>
          <input
            type="number"
            min="0"
            value={orderInGuide}
            onChange={(e) => setOrderInGuide(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Active</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default GuideWordsAdminPage;