"use client";

import { useEffect } from "react";
import { useFavoritesStore } from "@/lib/context/favoritesStore";
import { Database } from "@/types/supabase";

type FavoriteListing =
  Database["public"]["Views"]["listings_with_details"]["Row"] & {
    favorited_at: string;
  };

/**
 * Seeds the client favorites store from server-fetched data (JWT session path).
 */
export function FavoritesHydrator({
  favorites,
}: {
  favorites: FavoriteListing[];
}) {
  const setFavorites = useFavoritesStore((state) => state.setFavorites);

  useEffect(() => {
    setFavorites(favorites);
  }, [favorites, setFavorites]);

  return null;
}
