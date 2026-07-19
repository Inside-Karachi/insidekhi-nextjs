"use client";

import { useEffect } from "react";
import { useFavoritesStore } from "@/lib/context/favoritesStore";
import { FavoriteListing } from "@/types/favorites.types";

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
