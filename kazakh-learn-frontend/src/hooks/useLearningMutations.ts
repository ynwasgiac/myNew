// src/hooks/useLearningMutations.ts - Shared learning mutations for all components
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { learningAPI } from '../services/learningAPI';
import type { LearningStatus } from '../types/learning';

interface UseLearningMutationsOptions {
  // Optional callbacks for custom behavior
  onAddSuccess?: (data: any, variables: any) => void;
  onRemoveSuccess?: (data: any, variables: any) => void;
  onAddError?: (error: any) => void;
  onRemoveError?: (error: any) => void;
  // Optional custom cache keys to invalidate
  additionalQueryKeys?: string[][];
}

export const useLearningMutations = (options: UseLearningMutationsOptions = {}) => {
  const queryClient = useQueryClient();

  const addToLearningMutation = useMutation({
    mutationFn: async ({ wordIds, status }: { wordIds: number[], status?: string }) => {
      if (wordIds.length === 1) {
        // Single word - use the single word API
        return await learningAPI.addWordToLearning(wordIds[0], (status || 'want_to_learn') as LearningStatus);
      } else {
        // Multiple words - use the multiple words API
        return await learningAPI.addMultipleWords({
          word_ids: wordIds,
          status: (status || 'want_to_learn') as LearningStatus
        });
      }
    },
    onSuccess: (data, variables) => {
      // Default cache invalidation
      queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
      queryClient.invalidateQueries({ queryKey: ['learning-progress-all'] });
      queryClient.invalidateQueries({ queryKey: ['words-paginated'] });
      
      // Custom cache invalidation
      if (options.additionalQueryKeys) {
        options.additionalQueryKeys.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey });
        });
      }
      
      // Custom success callback
      if (options.onAddSuccess) {
        options.onAddSuccess(data, variables);
      }
    },
    onError: (error, variables) => {
      // Custom error callback
      if (options.onAddError) {
        options.onAddError(error);
      }
    },
  });

  const removeFromLearningMutation = useMutation({
    mutationFn: async (wordIds: number[]) => {
      // Handle multiple words by calling the single word API for each
      await Promise.all(wordIds.map(id => learningAPI.removeWordFromLearning(id)));
    },
    onSuccess: (data, variables) => {
      // Default cache invalidation
      queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
      queryClient.invalidateQueries({ queryKey: ['learning-progress-all'] });
      queryClient.invalidateQueries({ queryKey: ['words-paginated'] });
      
      // Custom cache invalidation
      if (options.additionalQueryKeys) {
        options.additionalQueryKeys.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey });
        });
      }
      
      // Custom success callback
      if (options.onRemoveSuccess) {
        options.onRemoveSuccess(data, variables);
      }
    },
    onError: (error, variables) => {
      // Custom error callback
      if (options.onRemoveError) {
        options.onRemoveError(error);
      }
    },
  });

  return {
    addToLearningMutation,
    removeFromLearningMutation,
  };
};

// Alternative: Simple version without customization options
export const useSimpleLearningMutations = () => {
  const queryClient = useQueryClient();

  const addToLearningMutation = useMutation({
    mutationFn: async ({ wordIds, status }: { wordIds: number[], status?: string }) => {
      if (wordIds.length === 1) {
        return await learningAPI.addWordToLearning(wordIds[0], (status || 'want_to_learn') as LearningStatus);
      } else {
        return await learningAPI.addMultipleWords({
          word_ids: wordIds,
          status: (status || 'want_to_learn') as LearningStatus
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
      queryClient.invalidateQueries({ queryKey: ['learning-progress-all'] });
      queryClient.invalidateQueries({ queryKey: ['words-paginated'] });
    },
  });

  const removeFromLearningMutation = useMutation({
    mutationFn: async (wordIds: number[]) => {
      await Promise.all(wordIds.map(id => learningAPI.removeWordFromLearning(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
      queryClient.invalidateQueries({ queryKey: ['learning-progress-all'] });
      queryClient.invalidateQueries({ queryKey: ['words-paginated'] });
    },
  });

  return {
    addToLearningMutation,
    removeFromLearningMutation,
  };
};