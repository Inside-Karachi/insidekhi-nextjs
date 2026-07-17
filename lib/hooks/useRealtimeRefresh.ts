import { useEffect, useRef } from "react";

type TableSubscription = {
  schema?: string;
  table: string;
  filter?: string;
};

// Polls for changes at a regular interval and calls onChange.
// Replaces the former Supabase Realtime WebSocket subscription.
// debounceMs / cooldownMs control the poll interval (uses the max of both, min 2s).
export function useRealtimeRefresh(
  channelName: string,
  tables: TableSubscription[],
  onChange: () => void,
  debounceMs: number = 500,
  cooldownMs: number = 0,
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onChangeRef = useRef(onChange);

  // Keep ref current so the interval closure always calls the latest callback
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!tables.length) return;

    // Poll at the larger of debounceMs/cooldownMs; floor at 2 s to avoid hammering the server
    const pollMs = Math.max(debounceMs, cooldownMs, 2_000);

    intervalRef.current = setInterval(() => {
      onChangeRef.current();
    }, pollMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, JSON.stringify(tables), debounceMs, cooldownMs]);
}
