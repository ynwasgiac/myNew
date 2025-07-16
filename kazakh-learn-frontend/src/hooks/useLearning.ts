import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { learningAPI } from '../services/learningAPI';
import type { LearningStatus } from '../types/learning';

export const useLearningStats = () => {
  return useQuery({
    queryKey: ['learning-stats'],
    queryFn: learningAPI.getStats,
  });
};

export const useLearningProgress = (filters = {}) => {
  return useQuery({
    queryKey: ['learning-progress', filters],
    queryFn: () => learningAPI.getProgress(filters),
  });
};

export const useUpdateWordProgress = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ wordId, data }: { wordId: number; data: any }) => 
      learningAPI.updateWordProgress(wordId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
      queryClient.invalidateQueries({ queryKey: ['learning-stats'] });
    },
  });
};

export const useAddWordToLearning = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ wordId, status }: { wordId: number; status?: LearningStatus }) =>
      learningAPI.addWordToLearning(wordId, status || 'want_to_learn'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
      queryClient.invalidateQueries({ queryKey: ['learning-stats'] });
    },
  });
};

export const useRemoveWordFromLearning = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (wordId: number) => learningAPI.removeWordFromLearning(wordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
      queryClient.invalidateQueries({ queryKey: ['learning-stats'] });
    },
  });
};