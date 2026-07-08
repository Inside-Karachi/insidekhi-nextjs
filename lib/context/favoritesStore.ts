import { create } from "zustand";
import { FavoriteListing, FavoritesStore } from "@/types/favorites.types";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Zustand store for global favorites state
export const useFavoritesStore = create<FavoritesStore>((set) => ({
  favorites: [],
  loading: false,
  error: null,
  initialized: false,
  currentUserId: null,

  setFavorites: (favorites: FavoriteListing[]) => {
    set({ favorites, initialized: true });
  },
  addFavorite: (favorite: FavoriteListing) => {
    set((state) => ({ favorites: [favorite, ...state.favorites] }));
  },
  removeFavorite: (listingId: string) => {
    set((state) => ({
      favorites: state.favorites.filter(
        (fav) => String(fav.id) !== String(listingId)
      ),
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
        favorites: [],
        loading: false,
        error: null,
        initialized: false,
        currentUserId: userId,
      };
    }),
  clearFavorites: () =>
    set({
      favorites: [],
      loading: false,
      error: null,
      initialized: false,
      currentUserId: null,
    }),
}));

// Custom hook with smart polling (replaces Supabase Realtime)
export function useFavoritesRealtime(userId: string | null) {
  const setFavorites = useFavoritesStore((state) => state.setFavorites);
  const setLoading = useFavoritesStore((state) => state.setLoading);
  const setError = useFavoritesStore((state) => state.setError);
  const setInitialized = useFavoritesStore((state) => state.setInitialized);
  const resetForUserChange = useFavoritesStore(
    (state) => state.resetForUserChange
  );
  const clearFavorites = useFavoritesStore((state) => state.clearFavorites);

  useEffect(() => {
    if (!userId) {
      clearFavorites?.();
      return;
    }

    const supabase = createClient();
    const currentUserId = useFavoritesStore.getState().currentUserId;
    const initialized = useFavoritesStore.getState().initialized;
    const loading = useFavoritesStore.getState().loading;

    const userHasChanged = currentUserId !== userId;
    if (userHasChanged) {
      resetForUserChange?.(userId);
    }

    const shouldLoadInitial = userHasChanged || (!initialized && !loading);
    let isInitialized = initialized;

    // Function to fetch favorites
    const fetchFavorites = async () => {
      // Snapshot userId before async operation to detect user context changes
      const currentUserId = userId;
      try {
        const { data: favorites, error } = await supabase
          .from("favorite_listings")
          .select(
            `created_at, listings:listings_with_details!inner(*, listing_images!fkey_listing_images_listing_id(url, alt_text, is_primary, display_order))`
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Failed to load favorites:", error);
          setError(error.message);
          return;
        }

        const favoriteListings: FavoriteListing[] =
          favorites?.map((fav) => ({
            ...fav.listings,
            favorited_at: fav.created_at,
          })) || [];

        // Only commit if the user hasn't changed since the fetch started
        if (useFavoritesStore.getState().currentUserId === currentUserId) {
          setFavorites(favoriteListings);
          setError(null);
        }
      } catch (err) {
        console.error("Error loading favorites:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    };

    // Initial load
    if (shouldLoadInitial) {
      setLoading(true);
      fetchFavorites().finally(() => {
        setLoading(false);
        setInitialized(true);
        isInitialized = true;
      });
    }

    // Set up polling (every 10 seconds) - only when tab is active
    const pollingInterval = setInterval(() => {
      if (!document.hidden && isInitialized) {
        void fetchFavorites();
      }
    }, 10000); // 10 seconds

    // Refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden && isInitialized) {
        void fetchFavorites();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(pollingInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    userId,
    setFavorites,
    setLoading,
    setError,
    setInitialized,
    resetForUserChange,
    clearFavorites,
  ]);
}
