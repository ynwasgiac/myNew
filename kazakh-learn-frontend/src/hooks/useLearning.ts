import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { learningAPI } from '../services/api';

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