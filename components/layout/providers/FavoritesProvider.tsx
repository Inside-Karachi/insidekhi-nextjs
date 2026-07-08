"use client";

import React from "react";

import { useFavoritesRealtime } from "@/lib/context/favoritesStore";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useSupabaseUser();

  useFavoritesRealtime(userId);

  return <>{children}</>;
}
