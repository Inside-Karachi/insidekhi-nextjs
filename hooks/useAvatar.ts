"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

interface UseAvatarReturn {
  avatarUrl: string | null;
  isLoading: boolean;
  error: string | null;
  refreshAvatar: () => Promise<void>;
}

/**
 * Custom hook for robust avatar loading with automatic signed URL refresh
 */
export function useAvatar(
  userId: string,
  initialAvatarUrl?: string | null,
): UseAvatarReturn {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    initialAvatarUrl || null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create stable supabase client
  const supabase = useMemo(() => createClient(), []);

  // Handle empty userId case
  const isValidUserId = userId && userId.trim() !== "";

  const refreshAvatar = useCallback(async () => {
    if (!isValidUserId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try to get a fresh signed URL for the user's avatar
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .single();

      if (profileError) {
        console.warn(
          "Failed to fetch profile for avatar refresh:",
          profileError,
        );
        setError("Failed to load profile");
        return;
      }

      if (profile?.avatar_url) {
        // If we have an avatar URL, try to create a fresh signed URL
        // Extract the file path from the signed URL
        let fileName = "";
        try {
          const url = new URL(profile.avatar_url);
          // Get the pathname and split into parts
          const pathParts = url.pathname.split("/").filter((part) => part);

          // Find the index of 'profiles_avatar' and take everything after it
          const bucketIndex = pathParts.indexOf("profiles_avatar");

          if (bucketIndex !== -1) {
            // Take everything after 'profiles_avatar'
            const filePathParts = pathParts.slice(bucketIndex + 1);
            fileName = filePathParts.join("/");
          } else {
            // Fallback if we can't find the bucket
            fileName = pathParts.slice(-2).join("/"); // Take last 2 parts as fallback
          }
        } catch (error) {
          console.error("useAvatar: Failed to parse avatar URL:", error);
          // Fallback: try the old method
          fileName = profile.avatar_url.split("/").pop()?.split("?")[0] || "";
        }

        if (fileName) {
          // First try to get a public URL (bucket is now public)
          try {
            const { data: publicUrl } = supabase.storage
              .from("profiles_avatar")
              .getPublicUrl(fileName);

            if (publicUrl?.publicUrl) {
              setAvatarUrl(publicUrl.publicUrl);

              // Update the profile with the public URL
              await supabase
                .from("profiles")
                .update({ avatar_url: publicUrl.publicUrl })
                .eq("id", userId);
              setIsLoading(false);
              return;
            }
          } catch (_publicUrlError) {
            // Fall back to signed URL
            const { data: signedUrl, error: signedError } =
              await supabase.storage
                .from("profiles_avatar")
                .createSignedUrl(fileName, 60 * 60 * 24 * 30); // 30 days

            if (signedError) {
              console.warn(
                "useAvatar: Failed to create signed URL:",
                signedError,
              );
              setError("Failed to refresh avatar URL");
            } else if (signedUrl?.signedUrl) {
              setAvatarUrl(signedUrl.signedUrl);

              // Update the profile with the fresh signed URL
              await supabase
                .from("profiles")
                .update({ avatar_url: signedUrl.signedUrl })
                .eq("id", userId);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error refreshing avatar:", err);
      setError("Unexpected error loading avatar");
    } finally {
      setIsLoading(false);
    }
  }, [userId, supabase, isValidUserId]);

  // Auto-refresh avatar if the initial URL fails
  useEffect(() => {
    if (!isValidUserId) {
      return;
    }

    if (avatarUrl && avatarUrl.includes("token=")) {
      // This is a signed URL, check if it might be expired
      const url = new URL(avatarUrl);
      const token = url.searchParams.get("token");

      if (token) {
        try {
          // Decode the JWT token to check expiration
          const payload = JSON.parse(atob(token.split(".")[1]));
          const expirationTime = payload.exp * 1000; // Convert to milliseconds
          const now = Date.now();

          // If token expires within 1 hour, refresh it
          if (expirationTime - now < 60 * 60 * 1000) {
            refreshAvatar();
          }
        } catch (err) {
          console.error("useAvatar: Error parsing token:", err);
          // If we can't parse the token, it's probably expired
          refreshAvatar();
        }
      }
    }
  }, [avatarUrl, refreshAvatar, isValidUserId]);

  // Auto-refresh when initialAvatarUrl changes (e.g., after upload)
  useEffect(() => {
    if (!isValidUserId || !initialAvatarUrl) {
      return;
    }

    // If the initialAvatarUrl is different from current avatarUrl, refresh immediately
    if (initialAvatarUrl !== avatarUrl) {
      refreshAvatar();
    }
  }, [initialAvatarUrl, avatarUrl, refreshAvatar, isValidUserId]);

  return {
    avatarUrl: isValidUserId ? avatarUrl : initialAvatarUrl || null,
    isLoading: isValidUserId ? isLoading : false,
    error: isValidUserId ? error : null,
    refreshAvatar,
  };
}
