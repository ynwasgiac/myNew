// src/hooks/useWords.ts - Updated with pagination support
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { wordsAPI } from '../services/api';
import { learningAPI } from '../services/learningAPI';
import type { WordFilters, PaginatedWordsResponse } from '../types/api';

// New hook for paginated words
export const useWordsPaginated = (filters: WordFilters = {}) => {
  return useQuery({
    queryKey: ['words-paginated', filters],
    queryFn: () => wordsAPI.getWordsPaginated(filters),
    placeholderData: keepPreviousData, // Keep previous data while loading new page (v5 syntax)
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 300000, // Keep in cache for 5 minutes (renamed from cacheTime in v5)
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
};

// Legacy hook for backward compatibility (deprecated)
export const useWords = (filters: Omit<WordFilters, 'page' | 'page_size'> & { skip?: number; limit?: number } = {}) => {
  console.warn('useWords hook is deprecated. Use useWordsPaginated instead.');
  
  // Convert old skip/limit to page/page_size
  const limit = filters.limit || 20;
  const skip = filters.skip || 0;
  const page = Math.floor(skip / limit) + 1;
  
  const paginatedFilters: WordFilters = {
    page,
    page_size: limit,
    search: filters.search,
    category_id: filters.category_id,
    word_type_id: filters.word_type_id,
    difficulty_level_id: filters.difficulty_level_id,
    language_code: filters.language_code,
  };
  
  const result = useWordsPaginated(paginatedFilters);
  
  // Transform the result to match the old interface
  return {
    ...result,
    data: result.data?.words,
  };
};

// Single word hook
export const useWord = (id: number, languageCode?: string) => {
  return useQuery({
    queryKey: ['word', id, languageCode],
    queryFn: () => wordsAPI.getWord(id, languageCode),
    enabled: !!id,
    staleTime: 60000, // Consider fresh for 1 minute
  });
};

// Word search hook
export const useWordSearch = (query: string, languageCode?: string, limit?: number) => {
  return useQuery({
    queryKey: ['word-search', query, languageCode, limit],
    queryFn: () => wordsAPI.searchWords(query, languageCode, limit),
    enabled: query.length > 2, // Only search if query is longer than 2 characters
    staleTime: 30000,
    placeholderData: keepPreviousData, // Updated for v5
  });
};

// Learning mutations
export const useAddToLearning = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ wordIds, status }: { wordIds: number[], status?: string }) =>
      learningAPI.addWordToLearning(wordIds, status),
    onSuccess: () => {
      // Invalidate learning progress
      queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
      // Invalidate words queries to update learning status
      queryClient.invalidateQueries({ queryKey: ['words-paginated'] });
    },
  });
};

export const useRemoveFromLearning = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (wordIds: number[]) => learningAPI.removeWordFromLearning(wordIds),
    onSuccess: () => {
      // Invalidate learning progress
      queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
      // Invalidate words queries to update learning status
      queryClient.invalidateQueries({ queryKey: ['words-paginated'] });
    },
  });
};

// Prefetch next page for better UX
export const usePrefetchNextPage = () => {
  const queryClient = useQueryClient();
  
  return (filters: WordFilters) => {
    const nextPageFilters = {
      ...filters,
      page: (filters.page || 1) + 1,
    };
    
    queryClient.prefetchQuery({
      queryKey: ['words-paginated', nextPageFilters],
      queryFn: () => wordsAPI.getWordsPaginated(nextPageFilters),
      staleTime: 30000,
    });
  };
};

// Custom hook for word management with optimistic updates
export const useWordManagement = () => {
  const queryClient = useQueryClient();
  
  const addToLearning = useMutation({
    mutationFn: ({ wordIds, status }: { wordIds: number[], status?: string }) =>
      learningAPI.addWordToLearning(wordIds, status),
    onMutate: async ({ wordIds }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['learning-progress'] });
      
      // Snapshot the previous value
      const previousLearning = queryClient.getQueryData(['learning-progress']);
      
      // Optimistically update the cache
      queryClient.setQueryData(['learning-progress'], (old: any[]) => {
        if (!old) return old;
        
        // Add optimistic entries for the new words
        const newEntries = wordIds.map(wordId => ({
          kazakh_word_id: wordId,
          status: 'want_to_learn',
          id: `temp-${wordId}`,
          user_id: 0,
          times_seen: 0,
          times_correct: 0,
          times_incorrect: 0,
          added_at: new Date().toISOString(),
          repetition_interval: 1,
          ease_factor: 2.5,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        
        return [...old, ...newEntries];
      });
      
      return { previousLearning };
    },
    onError: (err, variables, context) => {
      // Revert on error
      if (context?.previousLearning) {
        queryClient.setQueryData(['learning-progress'], context.previousLearning);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
    },
  });
  
  const removeFromLearning = useMutation({
    mutationFn: (wordIds: number[]) => learningAPI.removeWordFromLearning(wordIds),
    onMutate: async (wordIds) => {
      await queryClient.cancelQueries({ queryKey: ['learning-progress'] });
      
      const previousLearning = queryClient.getQueryData(['learning-progress']);
      
      // Optimistically remove words from cache
      queryClient.setQueryData(['learning-progress'], (old: any[]) => {
        if (!old) return old;
        return old.filter((item: any) => !wordIds.includes(item.kazakh_word_id));
      });
      
      return { previousLearning };
    },
    onError: (err, variables, context) => {
      if (context?.previousLearning) {
        queryClient.setQueryData(['learning-progress'], context.previousLearning);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
    },
  });
  
  return {
    addToLearning,
    removeFromLearning,
  };
};