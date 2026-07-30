import { Database } from "@/types/database";

// FavoriteListing type: combines listings_with_details view row with favorited_at
// timestamp and its images (fetched separately from listing_images).
export type FavoriteListing =
  Database["public"]["Views"]["listings_with_details"]["Row"] & {
    favorited_at: string;
    images?: Array<{
      id: number;
      listing_id: number;
      url: string;
      alt_text: string | null;
      display_order: number | null;
      is_primary: boolean | null;
      created_at: string;
      updated_at: string;
    }>;
  };

// FavoriteListingRaw: raw row from favorite_listings table
export type FavoriteListingRaw =
  Database["public"]["Tables"]["favorite_listings"]["Row"];

// Zustand store state for favorites
export interface FavoritesState {
  favorites: FavoriteListing[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  currentUserId?: string | null;
}

// Zustand store actions for favorites
export interface FavoritesActions {
  setFavorites: (favorites: FavoriteListing[]) => void;
  addFavorite: (favorite: FavoriteListing) => void;
  removeFavorite: (listingId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setInitialized: (initialized: boolean) => void;
  resetForUserChange?: (userId: string) => void;
  clearFavorites?: () => void;
}

// Combined type for Zustand store
export type FavoritesStore = FavoritesState & FavoritesActions;
