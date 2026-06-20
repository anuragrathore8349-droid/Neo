import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseAsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for handling async data fetching with loading and error states
 */
export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  immediate = true,
  dependencies: any[] = []
): UseAsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<Error | null>(null);
  
  // Use useRef to track the latest asyncFunction without triggering effects
  const asyncFunctionRef = useRef(asyncFunction);
  useEffect(() => {
    asyncFunctionRef.current = asyncFunction;
  }, [asyncFunction]);

  // Create a stable refetch function
  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await asyncFunctionRef.current();
      setData(response);
      setError(null);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (immediate) {
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return {
    data,
    loading,
    error,
    refetch
  };
}
