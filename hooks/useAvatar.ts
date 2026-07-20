"use client";

import { useState, useEffect, useCallback } from "react";

interface UseAvatarReturn {
  avatarUrl: string | null;
  isLoading: boolean;
  error: string | null;
  refreshAvatar: () => Promise<void>;
}

/**
 * Custom hook for avatar loading.
 *
 * Avatars are uploaded to a public-read DigitalOcean Spaces path (see
 * /api/profile/avatar), so `avatar_url` is always a plain, non-expiring
 * public URL - there is no signed-URL refresh to do anymore. This hook
 * simply mirrors `initialAvatarUrl` (kept fresh by the caller from
 * server-rendered profile data), matching its previous public API
 * (avatarUrl / isLoading / error / refreshAvatar) so existing callers don't
 * need to change.
 */
export function useAvatar(
  userId: string,
  initialAvatarUrl?: string | null,
): UseAvatarReturn {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    initialAvatarUrl || null,
  );
  const [error] = useState<string | null>(null);

  // Handle empty userId case
  const isValidUserId = userId && userId.trim() !== "";

  const refreshAvatar = useCallback(async () => {
    // Public URLs never expire - nothing to fetch. Kept as an async no-op so
    // existing call sites (which await/invoke it) keep working unchanged.
    setAvatarUrl(initialAvatarUrl || null);
  }, [initialAvatarUrl]);

  // Keep in sync when the caller passes a fresh initialAvatarUrl (e.g. after
  // a new upload updates the profile server-side).
  useEffect(() => {
    if (!isValidUserId) {
      return;
    }

    if (initialAvatarUrl !== avatarUrl) {
      setAvatarUrl(initialAvatarUrl || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAvatarUrl, isValidUserId]);

  return {
    avatarUrl: isValidUserId ? avatarUrl : initialAvatarUrl || null,
    isLoading: false,
    error: isValidUserId ? error : null,
    refreshAvatar,
  };
}
