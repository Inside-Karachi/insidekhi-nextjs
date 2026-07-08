"use client";

import { useState, useCallback } from 'react';
import { LoadingStates } from '@/types/filter.types';

interface UseLoadingStatesResult {
  loading: LoadingStates;
  setLoading: (key: keyof LoadingStates, value: boolean) => void;
  setMultipleLoading: (updates: Partial<LoadingStates>) => void;
  isAnyLoading: boolean;
  resetLoading: () => void;
}

const initialLoadingState: LoadingStates = {
  initialLoad: false,
  filterApply: false,
  cardVariants: false,
  categories: false,
};

/**
 * Custom hook for managing multiple loading states efficiently
 * Provides granular control over different loading indicators
 */
export function useLoadingStates(
  initialState: Partial<LoadingStates> = {}
): UseLoadingStatesResult {
  const [loading, setLoadingState] = useState<LoadingStates>({
    ...initialLoadingState,
    ...initialState,
  });

  // Set a single loading state
  const setLoading = useCallback((key: keyof LoadingStates, value: boolean) => {
    setLoadingState(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  // Set multiple loading states at once
  const setMultipleLoading = useCallback((updates: Partial<LoadingStates>) => {
    setLoadingState(prev => ({
      ...prev,
      ...updates,
    }));
  }, []);

  // Check if any loading state is active
  const isAnyLoading = Object.values(loading).some(Boolean);

  // Reset all loading states to false
  const resetLoading = useCallback(() => {
    setLoadingState(initialLoadingState);
  }, []);

  return {
    loading,
    setLoading,
    setMultipleLoading,
    isAnyLoading,
    resetLoading,
  };
}