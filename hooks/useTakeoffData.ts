'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { MaterialTakeoff } from '@/types/takeoff';

interface UseTakeoffDataReturn {
  takeoffs: MaterialTakeoff[];
  selectedTakeoff: MaterialTakeoff | null;
  loading: boolean;
  error: Error | null;
  fetchTakeoffs: () => Promise<void>;
  selectTakeoff: (takeoff: MaterialTakeoff) => void;
  refreshTakeoffs: () => Promise<void>;
  setTakeoffs: React.Dispatch<React.SetStateAction<MaterialTakeoff[]>>;
  setSelectedTakeoff: React.Dispatch<React.SetStateAction<MaterialTakeoff | null>>;
}

/**
 * Hook for managing takeoff data fetching and state
 * 
 * @param projectSlug - The project slug to fetch takeoffs for
 * @returns Object containing takeoffs, selected takeoff, loading state, and control functions
 */
export function useTakeoffData(projectSlug: string): UseTakeoffDataReturn {
  const [takeoffs, setTakeoffs] = useState<MaterialTakeoff[]>([]);
  const [selectedTakeoff, setSelectedTakeoff] = useState<MaterialTakeoff | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTakeoffs = useCallback(async () => {
    if (!projectSlug) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/projects/${projectSlug}/takeoffs`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch takeoffs');
      }

      const data = await response.json();
      const fetchedTakeoffs = data.takeoffs || [];
      setTakeoffs(fetchedTakeoffs);
      
      // Auto-select first takeoff if available and none selected
      if (fetchedTakeoffs.length > 0 && !selectedTakeoff) {
        setSelectedTakeoff(fetchedTakeoffs[0]);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load material takeoffs');
      setError(error);
      console.error('Error fetching takeoffs:', error);
      toast.error('Failed to load material takeoffs');
    } finally {
      setLoading(false);
    }
  }, [projectSlug, selectedTakeoff]);

  const refreshTakeoffs = useCallback(async () => {
    await fetchTakeoffs();
  }, [fetchTakeoffs]);

  const selectTakeoff = useCallback((takeoff: MaterialTakeoff) => {
    setSelectedTakeoff(takeoff);
  }, []);

  useEffect(() => {
    if (projectSlug) {
      fetchTakeoffs();
    }
  }, [projectSlug, fetchTakeoffs]);

  return {
    takeoffs,
    selectedTakeoff,
    loading,
    error,
    fetchTakeoffs,
    selectTakeoff,
    refreshTakeoffs,
    setTakeoffs,
    setSelectedTakeoff,
  };
}
