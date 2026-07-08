import { create } from "zustand";
import { Database } from "@/types/supabase";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Extended Review type for listing pages
export type ListingReview = Database["public"]["Tables"]["reviews"]["Row"] & {
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  comment_count?: number | null;
  review_images?: Array<{
    id: number;
    image_url: string;
    created_at: string;
  }> | null;
};

export interface ListingReviewsStore {
  reviews: ListingReview[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  currentListingId: number | null;
  setReviews: (reviews: ListingReview[]) => void;
  addReview: (review: ListingReview) => void;
  updateReview: (
    reviewId: number,
    updatedReview: Partial<ListingReview>,
  ) => void;
  removeReview: (reviewId: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setInitialized: (initialized: boolean) => void;
  resetForListingChange: (listingId: number) => void;
}

// Zustand store for global listing reviews state
export const useListingReviewsStore = create<ListingReviewsStore>((set) => ({
  reviews: [],
  loading: false,
  error: null,
  initialized: false,
  currentListingId: null,

  setReviews: (reviews: ListingReview[]) => {
    set({ reviews, initialized: true });
  },

  addReview: (review: ListingReview) => {
    set((state) => ({ reviews: [review, ...state.reviews] }));
  },

  updateReview: (reviewId: number, updatedReview: Partial<ListingReview>) => {
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
  resetForListingChange: (listingId: number) =>
    set({
      reviews: [],
      loading: false,
      error: null,
      initialized: false,
      currentListingId: listingId,
    }),
}));

// Custom hook with Supabase Realtime (replaces polling)
export function useListingReviewsRealtime(listingId: number) {
  const setReviews = useListingReviewsStore((state) => state.setReviews);
  const setLoading = useListingReviewsStore((state) => state.setLoading);
  const setError = useListingReviewsStore((state) => state.setError);
  const setInitialized = useListingReviewsStore(
    (state) => state.setInitialized,
  );
  const resetForListingChange = useListingReviewsStore(
    (state) => state.resetForListingChange,
  );

  useEffect(() => {
    if (!listingId) return;

    // Reset store for new listing context
    resetForListingChange(listingId);

    const supabase = createClient();
    let refreshTimer: NodeJS.Timeout | null = null;

    // Fetch reviews with comment counts and images
    const fetchReviews = async () => {
      try {
        const { data: reviews, error } = await supabase
          .from("reviews")
          .select(
            `
            *,
            profiles!reviews_user_id_fkey(full_name, avatar_url),
            review_images(id, image_url, created_at)
          `,
          )
          .eq("listing_id", listingId)
          .eq("status", "approved")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Failed to load listing reviews:", error);
          setError(error.message);
          return;
        }

        // Fetch comment counts in parallel
        const reviewsWithCommentCount = await Promise.all(
          (reviews || []).map(async (review) => {
            const { count } = await supabase
              .from("review_comments")
              .select("*", { count: "exact", head: true })
              .eq("review_id", review.id)
              .eq("status", "approved");

            return {
              ...review,
              comment_count: count || 0,
            };
          }),
        );

        setReviews(reviewsWithCommentCount);
        setError(null);
      } catch (err) {
        console.error("Error loading listing reviews:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    };

    // Initial load
    setLoading(true);
    fetchReviews().finally(() => {
      setLoading(false);
      setInitialized(true);
    });

    // Realtime subscription for reviews
    const reviewsChannel = supabase
      .channel(`listing-reviews-${listingId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reviews",
          filter: `listing_id=eq.${listingId}`,
        },
        () => {
          // Debounce refresh to avoid rapid re-fetches
          if (refreshTimer) clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => {
            void fetchReviews();
          }, 500);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "review_comments",
        },
        () => {
          // Refresh on comment changes to update comment counts
          if (refreshTimer) clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => {
            void fetchReviews();
          }, 500);
        },
      )
      .subscribe();

    // Fallback: Refresh when tab becomes visible (handles network issues)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void fetchReviews();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(reviewsChannel);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    listingId,
    setReviews,
    setLoading,
    setError,
    setInitialized,
    resetForListingChange,
  ]);
}
