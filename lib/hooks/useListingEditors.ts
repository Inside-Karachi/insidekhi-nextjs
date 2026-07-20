import { useCallback, useEffect, useRef, useState } from "react";

export type ListingEditorInfo = { userId: string; fullName: string };

const HEARTBEAT_MS = 15_000;
/** Polling interval for who's-editing presence data (Supabase Realtime is no longer available). */
const POLL_MS = 20_000;

/**
 * Server-backed edit sessions (see /api/admin/listings/edit-presence) with:
 * - Initial fetch + interval polling on `listing_edit_sessions`
 * - Heartbeat POST while a listing modal is open
 */
export function useListingEditors() {
  const [editorsMap, setEditorsMap] = useState<Map<number, ListingEditorInfo[]>>(new Map());
  const activeListingIdRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPresenceEnabledRef = useRef(true);

  const fetchEditors = useCallback(async () => {
    if (!isPresenceEnabledRef.current) return;
    try {
      const res = await fetch("/api/admin/listings/edit-presence", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        isPresenceEnabledRef.current = false;
        setEditorsMap(new Map());
        return;
      }
      const result = await res.json();
      if (!result.success || !Array.isArray(result.data?.sessions)) return;

      const map = new Map<number, ListingEditorInfo[]>();
      for (const session of result.data.sessions) {
        const listingId = Number(session.listing_id);
        if (!listingId) continue;
        const existing = map.get(listingId) || [];
        if (!existing.some((e) => e.userId === session.user_id)) {
          existing.push({ userId: session.user_id, fullName: session.full_name || "Staff" });
        }
        map.set(listingId, existing);
      }
      setEditorsMap(map);
    } catch {
      // ignore; fallback poll or next realtime event will retry
    }
  }, []);

  const postPresence = useCallback(async (action: "start" | "heartbeat" | "stop", listingId: number) => {
    if (!isPresenceEnabledRef.current) return;
    try {
      const res = await fetch("/api/admin/listings/edit-presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, listingId }),
      });
      if (res.status === 401 || res.status === 403) {
        isPresenceEnabledRef.current = false;
        setEditorsMap(new Map());
      }
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    void fetchEditors();
  }, [fetchEditors]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!isPresenceEnabledRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return;
      void fetchEditors();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [fetchEditors]);

  const stopTracking = useCallback(() => {
    const listingId = activeListingIdRef.current;
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (listingId) {
      void postPresence("stop", listingId);
    }
    activeListingIdRef.current = null;
  }, [postPresence]);

  const trackEditing = useCallback(
    async (listingId: number) => {
      if (!listingId) return;
      if (activeListingIdRef.current && activeListingIdRef.current !== listingId) {
        await postPresence("stop", activeListingIdRef.current);
      }

      activeListingIdRef.current = listingId;
      await postPresence("start", listingId);
      await fetchEditors();

      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = setInterval(() => {
        const active = activeListingIdRef.current;
        if (!active) return;
        void postPresence("heartbeat", active);
      }, HEARTBEAT_MS);
    },
    [fetchEditors, postPresence],
  );

  useEffect(() => {
    const onUnload = () => {
      const listingId = activeListingIdRef.current;
      if (!listingId) return;
      navigator.sendBeacon(
        "/api/admin/listings/edit-presence",
        new Blob([JSON.stringify({ action: "stop", listingId })], { type: "application/json" }),
      );
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      stopTracking();
    };
  }, [stopTracking]);

  return { editorsMap, trackEditing, stopTracking, refreshEditors: fetchEditors };
}
