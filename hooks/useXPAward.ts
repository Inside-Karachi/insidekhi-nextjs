/**
 * Hook for awarding XP to current user
 * Handles API calls, optimistic updates, error handling
 */

import { useCallback, useState } from "react";
import type {
  XPAwardRequest,
  XPAwardResult,
  ActivitySlug,
} from "@/types/gamification.types";

interface UseXPAwardOptions {
  onSuccess?: (result: XPAwardResult) => void;
  onError?: (error: Error) => void;
  showNotification?: (message: string, type: "success" | "error") => void;
}

export function useXPAward(options?: UseXPAwardOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastResult, setLastResult] = useState<XPAwardResult | null>(null);

  const awardXP = useCallback(
    async (
      userId: string,
      activitySlug: ActivitySlug,
      relatedId?: string | number,
      metadata?: Record<string, unknown>
    ): Promise<XPAwardResult | null> => {
      try {
        setIsLoading(true);
        setError(null);

        const request: XPAwardRequest = {
          user_id: userId,
          activity_slug: activitySlug,
          related_id: relatedId,
          metadata,
        };

        const response = await fetch("/api/xp/award", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        const result: XPAwardResult = await response.json();
        setLastResult(result);

        // Call success callback
        options?.onSuccess?.(result);

        // Show notification if handler provided
        if (options?.showNotification) {
          if (result.rank_up) {
            options.showNotification(
              `Rank up! You're now a ${result.new_rank?.name}!`,
              "success"
            );
          } else {
            options.showNotification(`+${result.xp_awarded} XP`, "success");
          }
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        options?.onError?.(error);

        if (options?.showNotification) {
          options.showNotification(error.message, "error");
        }

        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [options]
  );

  return {
    awardXP,
    isLoading,
    error,
    lastResult,
  };
}
