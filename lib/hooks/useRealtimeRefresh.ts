import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type TableSubscription = {
  schema?: string;
  table: string;
  filter?: string;
};

// Subscribes to Supabase Realtime row changes and calls onChange.
// debounceMs (default 500) coalesces bursts; cooldownMs (default 0) caps refresh frequency during bulk writes.
export function useRealtimeRefresh(
  channelName: string,
  tables: TableSubscription[],
  onChange: () => void,
  debounceMs: number = 500,
  cooldownMs: number = 0,
) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastFireRef = useRef<number>(0);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!tables.length) return;

    const supabase = createClient();
    const channel = supabase.channel(channelName);

    const scheduleRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);

      const elapsed = Date.now() - lastFireRef.current;
      const wait = Math.max(debounceMs, cooldownMs - elapsed);

      timerRef.current = setTimeout(() => {
        lastFireRef.current = Date.now();
        onChangeRef.current();
      }, wait);
    };

    tables.forEach(({ schema = "public", table, filter }) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema, table, filter },
        () => scheduleRefresh(),
      );
    });

    const subscription = channel.subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(subscription);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, JSON.stringify(tables)]);
}
