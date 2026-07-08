import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "./use-toast";

interface UseDraftPersistenceOptions<T> {
  key: string;
  defaultValue: T;
  debounceMs?: number;
  onRestore?: (data: T) => void;
  validate?: (data: unknown) => data is T;
}

interface DraftMetadata {
  timestamp: number;
  version: string;
}

const DRAFT_VERSION = "1.0";
const MAX_DRAFT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Hook for auto-saving form drafts to localStorage with automatic restoration
 * Prevents data loss during unexpected page closures or network issues
 */
export function useDraftPersistence<T>({
  key,
  defaultValue,
  debounceMs = 1000,
  onRestore,
  validate,
}: UseDraftPersistenceOptions<T>) {
  const { toast } = useToast();
  const [data, setData] = useState<T>(defaultValue);
  const [isDraftAvailable, setIsDraftAvailable] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  const storageKey = `draft_${key}`;
  const metadataKey = `draft_meta_${key}`;

  // Validate and parse stored data
  const validateDraft = useCallback(
    (storedData: unknown): T | null => {
      try {
        if (validate) {
          return validate(storedData) ? storedData : null;
        }
        return storedData as T;
      } catch {
        return null;
      }
    },
    [validate],
  );

  // Check if draft exists and is valid
  const checkDraftAvailability = useCallback(() => {
    try {
      const storedMeta = localStorage.getItem(metadataKey);
      if (!storedMeta) return false;

      const metadata: DraftMetadata = JSON.parse(storedMeta);
      const age = Date.now() - metadata.timestamp;

      // Expire old drafts
      if (age > MAX_DRAFT_AGE_MS) {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(metadataKey);
        return false;
      }

      return localStorage.getItem(storageKey) !== null;
    } catch {
      return false;
    }
  }, [storageKey, metadataKey]);

  // Restore draft from localStorage
  const restoreDraft = useCallback(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) {
        setIsRestoring(false);
        return;
      }

      const parsed = JSON.parse(stored);
      const validated = validateDraft(parsed);

      if (validated) {
        setData(validated);
        setIsDraftAvailable(true);

        if (onRestore) {
          onRestore(validated);
        }

        const metadata = localStorage.getItem(metadataKey);
        if (metadata) {
          const meta: DraftMetadata = JSON.parse(metadata);
          const minutesAgo = Math.floor((Date.now() - meta.timestamp) / 60000);

          toast({
            title: "Draft Restored",
            description: `Your work from ${minutesAgo} minute${minutesAgo !== 1 ? "s" : ""} ago has been restored.`,
          });
        }
      } else {
        // Invalid draft, clear it
        localStorage.removeItem(storageKey);
        localStorage.removeItem(metadataKey);
      }
    } catch (error) {
      console.error("Error restoring draft:", error);
      localStorage.removeItem(storageKey);
      localStorage.removeItem(metadataKey);
    } finally {
      setIsRestoring(false);
    }
  }, [storageKey, metadataKey, validateDraft, onRestore, toast]);

  // Save draft to localStorage (debounced)
  const saveDraft = useCallback(
    (value: T) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        try {
          const metadata: DraftMetadata = {
            timestamp: Date.now(),
            version: DRAFT_VERSION,
          };

          localStorage.setItem(storageKey, JSON.stringify(value));
          localStorage.setItem(metadataKey, JSON.stringify(metadata));
        } catch (error) {
          console.error("Error saving draft:", error);

          // Handle quota exceeded error
          if (
            error instanceof DOMException &&
            error.name === "QuotaExceededError"
          ) {
            toast({
              title: "Storage Full",
              description:
                "Unable to auto-save. Please clear browser data or save manually.",
              variant: "destructive",
            });
          }
        }
      }, debounceMs);
    },
    [storageKey, metadataKey, debounceMs, toast],
  );

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(metadataKey);
      setIsDraftAvailable(false);
    } catch (error) {
      console.error("Error clearing draft:", error);
    }
  }, [storageKey, metadataKey]);

  // Manual save (bypass debounce)
  const saveDraftNow = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    try {
      const metadata: DraftMetadata = {
        timestamp: Date.now(),
        version: DRAFT_VERSION,
      };

      localStorage.setItem(storageKey, JSON.stringify(data));
      localStorage.setItem(metadataKey, JSON.stringify(metadata));

      toast({
        title: "Draft Saved",
        description: "Your changes have been saved locally.",
      });
    } catch (error) {
      console.error("Error saving draft:", error);
    }
  }, [storageKey, metadataKey, data, toast]);

  // Initialize - check and restore draft
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;

      if (checkDraftAvailability()) {
        restoreDraft();
      } else {
        setIsRestoring(false);
      }
    }
  }, [checkDraftAvailability, restoreDraft]);

  // Auto-save when data changes
  useEffect(() => {
    if (isInitializedRef.current && !isRestoring) {
      saveDraft(data);
    }
  }, [data, saveDraft, isRestoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDraftAvailable) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDraftAvailable]);

  return {
    data,
    setData,
    isDraftAvailable,
    isRestoring,
    clearDraft,
    saveDraftNow,
    restoreDraft,
  };
}
