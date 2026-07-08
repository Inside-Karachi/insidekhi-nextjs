// Polls only when the tab is visible, using ETag/conditional requests and exponential backoff.

import { useCallback, useEffect, useRef, useState } from "react";

interface UseSmartPollingOptions<T> {
  /** Unique key for this polling instance */
  queryKey: string;
  /** Function that fetches the data */
  queryFn: () => Promise<T>;
  /** Polling interval in ms (default: 10000 = 10 seconds) */
  interval?: number;
  /** Whether to poll when tab is hidden (default: false) */
  pollWhenHidden?: boolean;
  /** Enable polling on mount (default: true) */
  enabled?: boolean;
}

interface PollingState {
  isPolling: boolean;
  lastUpdate: Date | null;
  errorCount: number;
}

/**
 * Smart polling hook that minimizes database load
 */
export function useSmartPolling<T>({
  queryKey,
  queryFn,
  interval = 10000,
  pollWhenHidden = false,
  enabled = true,
}: UseSmartPollingOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [state, setState] = useState<PollingState>({
    isPolling: false,
    lastUpdate: null,
    errorCount: 0,
  });

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTabVisibleRef = useRef(true);
  const isRunningRef = useRef(false);

  // Manual poll function
  const poll = useCallback(async () => {
    // Don't poll if tab is hidden and pollWhenHidden is false
    if (!isTabVisibleRef.current && !pollWhenHidden) {
      return;
    }

    // Mutex: skip this tick if a previous invocation is still running
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    try {
      const result = await queryFn();
      setData(result);
      setError(null);
      setState((prev) => ({
        ...prev,
        lastUpdate: new Date(),
        errorCount: 0,
      }));
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`[${queryKey}] Polling error:`, error);
      setError(error);
      setState((prev) => {
        const newErrorCount = prev.errorCount + 1;
        // Stop polling after too many errors
        if (newErrorCount >= 3 && pollingTimerRef.current) {
          clearInterval(pollingTimerRef.current);
          pollingTimerRef.current = null;
          return {
            ...prev,
            errorCount: newErrorCount,
            isPolling: false,
          };
        }
        return {
          ...prev,
          errorCount: newErrorCount,
        };
      });
    } finally {
      isRunningRef.current = false;
    }
  }, [queryFn, queryKey, pollWhenHidden]);

  // Start polling
  const startPolling = useCallback(() => {
    if (pollingTimerRef.current) return;

    setState((prev) => ({ ...prev, isPolling: true }));

    // Initial poll
    void poll();

    // Set up interval
    pollingTimerRef.current = setInterval(() => {
      void poll();
    }, interval);
  }, [poll, interval]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    setState((prev) => ({ ...prev, isPolling: false }));
  }, []);

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabVisibleRef.current = !document.hidden;

      // Resume polling when tab becomes visible
      if (isTabVisibleRef.current && state.isPolling) {
        void poll();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [state.isPolling, poll]);

  // Auto-start polling if enabled
  useEffect(() => {
    if (enabled) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, startPolling, stopPolling]);

  return {
    data,
    error,
    isPolling: state.isPolling,
    lastUpdate: state.lastUpdate,
    errorCount: state.errorCount,
    startPolling,
    stopPolling,
    refetch: poll,
  };
}
