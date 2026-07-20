import { create } from "zustand";
import { Database } from "@/types/supabase";
import { useEffect } from "react";

// Extended Review type with listing details
export type UserReview = Database["public"]["Tables"]["reviews"]["Row"] & {
  listing?: Database["public"]["Views"]["listings_with_details"]["Row"] & {
    listing_images?: Database["public"]["Tables"]["listing_images"]["Row"][];
  };
  reviewed_at: string;
};

export interface ReviewsStore {
  reviews: UserReview[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  currentUserId?: string | null;
  setReviews: (reviews: UserReview[]) => void;
  addReview: (review: UserReview) => void;
  updateReview: (reviewId: number, updatedReview: Partial<UserReview>) => void;
  removeReview: (reviewId: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setInitialized: (initialized: boolean) => void;
  resetForUserChange?: (userId: string) => void;
  clearReviews?: () => void;
}

// Zustand store for global reviews state
export const useReviewsStore = create<ReviewsStore>((set) => ({
  reviews: [],
  loading: false,
  error: null,
  initialized: false,
  currentUserId: null,

  setReviews: (reviews: UserReview[]) => {
    set({ reviews, initialized: true });
  },

  addReview: (review: UserReview) => {
    set((state) => ({ reviews: [review, ...state.reviews] }));
  },

  updateReview: (reviewId: number, updatedReview: Partial<UserReview>) => {
    set((state) => ({
      reviews: state.reviews.map((review) =>
        review.id === reviewId ? { ...review, ...updatedReview } : review,
      ),
    }));
  },

  removeReview: (reviewId: number) => {
    set((state) => ({
      reviews: state.reviews.filter((review) => review.id !== reviewId),
    }));
  },

  setLoading: (loading: boolean) => set({ loading }),
  setError: (error: string | null) => set({ error }),
  setInitialized: (initialized: boolean) => set({ initialized }),
  resetForUserChange: (userId: string) =>
    set((state) => {
      if (state.currentUserId === userId) {
        return {};
      }

      return {
        reviews: [],
        loading: false,
        error: null,
        initialized: false,
        currentUserId: userId,
      };
    }),
  clearReviews: () =>
    set({
      reviews: [],
      loading: false,
      error: null,
      initialized: false,
      currentUserId: null,
    }),
}));

// Custom hook with smart polling (replaces Supabase Realtime)
export function useReviewsRealtime(userId: string | null) {
  const setReviews = useReviewsStore((state) => state.setReviews);
  const setLoading = useReviewsStore((state) => state.setLoading);
  const setError = useReviewsStore((state) => state.setError);
  const setInitialized = useReviewsStore((state) => state.setInitialized);
  const resetForUserChange = useReviewsStore(
    (state) => state.resetForUserChange,
  );
  const clearReviews = useReviewsStore((state) => state.clearReviews);

  useEffect(() => {
    if (!userId) {
      clearReviews?.();
      return;
    }

    const currentUserId = useReviewsStore.getState().currentUserId;
    const initialized = useReviewsStore.getState().initialized;
    const loading = useReviewsStore.getState().loading;

    const userHasChanged = currentUserId !== userId;

    if (userHasChanged) {
      resetForUserChange?.(userId);
    }

    const shouldLoadInitial = userHasChanged || (!initialized && !loading);
    let isInitialized = initialized;

    // Function to fetch reviews
    const fetchReviews = async () => {
      // Snapshot userId before async operation to detect user context changes
      const currentUserId = userId;
      try {
        const res = await fetch("/api/dashboard/reviews", {
          cache: "no-store",
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Failed to fetch reviews (${res.status})`);
        }

        const data = await res.json();
        const userReviews: UserReview[] = data.reviews ?? [];

        // Only commit if the user hasn't changed since the fetch started
        if (useReviewsStore.getState().currentUserId === currentUserId) {
          setReviews(userReviews);
          setError(null);
        }
      } catch (err) {
        console.error("Error loading reviews:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    };

    // Initial load
    if (shouldLoadInitial) {
      setLoading(true);
      fetchReviews().finally(() => {
        setLoading(false);
        setInitialized(true);
        isInitialized = true;
      });
    }

    // Set up polling (every 10 seconds) - only when tab is active
    const pollingInterval = setInterval(() => {
      if (!document.hidden && isInitialized) {
        void fetchReviews();
      }
    }, 10000); // 10 seconds

    // Refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden && isInitialized) {
        void fetchReviews();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(pollingInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    userId,
    setReviews,
    setLoading,
    setError,
    setInitialized,
    resetForUserChange,
    clearReviews,
  ]);
}
