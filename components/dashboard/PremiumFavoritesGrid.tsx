"use client";

import React, { useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListingCard as PremiumListingCard } from "@/components/listings/ListingCard";
import { useFavoritesStore } from "@/lib/context/favoritesStore";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut" as const,
    },
  },
};

export function PremiumFavoritesGrid() {
  const favorites = useFavoritesStore((state) => state.favorites);
  const removeFavorite = useFavoritesStore((state) => state.removeFavorite);

  const handleUnfavorite = useCallback(
    (listingId: string | number) => {
      removeFavorite(String(listingId));
    },
    [removeFavorite],
  );

  return (
    <>
      {/* Back to Dashboard (replaces breadcrumbs) */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            <Heart className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Favorites</h1>
            <p className="text-muted-foreground">
              {favorites.length > 0
                ? `${favorites.length} favorite${
                    favorites.length !== 1 ? "s" : ""
                  } saved`
                : "Discover and save your favorite places"}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      {favorites.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl p-10 bg-gradient-to-br from-primary/4 to-transparent border border-border/40 text-center"
        >
          <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-6">
            <Heart className="w-12 h-12 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground mb-3">
            No favorites yet
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Start exploring Karachi&apos;s best restaurants, attractions, and
            experiences. Save your favorite places to easily find them later and
            never miss out on what matters most to you.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button
              asChild
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground transform transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 shadow-md hover:shadow-primary/30 font-medium"
            >
              <Link href="/listings">Explore Listings</Link>
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {favorites.map((listing, index) => (
            <motion.div key={listing.id ?? index} variants={itemVariants}>
              <PremiumListingCard
                listing={{ ...listing, favorited: true }}
                index={index}
                showAnimation={false}
                onUnfavorite={() => {
                  if (typeof listing.id === "number") {
                    handleUnfavorite(listing.id);
                  }
                }}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </>
  );
}
