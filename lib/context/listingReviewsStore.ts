import { create } from "zustand";
import { Database } from "@/types/database";
import { useEffect } from "react";
import { useRealtimeRefresh } from "@/lib/hooks/useRealtimeRefresh";

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

// Custom hook with smart polling (replaces Supabase Realtime)
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

  const fetchReviews = async () => {
    try {
      const res = await fetch(`/api/reviews?listing_id=${listingId}`);
      const data = await res.json();

      if (!res.ok) {
        console.error("Failed to load listing reviews:", data.error);
        setError(data.error ?? "Failed to load reviews");
        return;
      }

      setReviews(data.reviews ?? []);
      setError(null);
    } catch (err) {
      console.error("Error loading listing reviews:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  useEffect(() => {
    if (!listingId) return;

    resetForListingChange(listingId);

    setLoading(true);
    fetchReviews().finally(() => {
      setLoading(false);
      setInitialized(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  useRealtimeRefresh(
    `listing-reviews-${listingId}`,
    listingId ? [{ table: "reviews" }, { table: "review_comments" }] : [],
    () => void fetchReviews(),
    10_000,
  );
}
