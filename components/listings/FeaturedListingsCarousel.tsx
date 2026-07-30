"use client";

import React, { useState, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { toggleFavorite } from "@/lib/favorites";
import Link from "next/link";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useFavoritesStore } from "@/lib/context/favoritesStore";
import {
  MapPin,
  Star,
  Crown,
  Heart,
  Clock,
  MessageSquare,
  ArrowRight,
  Award,
} from "lucide-react";

import { Database } from "@/types/database";

type Listing = Database["public"]["Views"]["listings_with_details"]["Row"] & {
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

interface FeaturedListingsCarouselProps {
  featuredListings: Listing[];
  className?: string;
}

// Category color schemes - matching SimilarListingsCarousel exactly
const categoryColorSchemes: Record<
  string,
  {
    bg: string;
    border: string;
    glow: string;
    accent: string;
    icon: string;
  }
> = {
  "Eat & Drink": {
    bg: "bg-orange-100 dark:bg-orange-500/10",
    border: "border-orange-200 dark:border-orange-500/20",
    glow: "hover:shadow-lg hover:shadow-orange-500/10",
    accent: "bg-orange-500",
    icon: "text-orange-600 dark:text-orange-400",
  },
  "Where to Stay": {
    bg: "bg-blue-100 dark:bg-blue-500/10",
    border: "border-blue-200 dark:border-blue-500/20",
    glow: "hover:shadow-lg hover:shadow-blue-500/10",
    accent: "bg-blue-500",
    icon: "text-blue-600 dark:text-blue-400",
  },
  "Things to Do": {
    bg: "bg-amber-100 dark:bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-500/20",
    glow: "hover:shadow-lg hover:shadow-amber-500/10",
    accent: "bg-amber-500",
    icon: "text-amber-600 dark:text-amber-400",
  },
  Entertainment: {
    bg: "bg-purple-100 dark:bg-purple-500/10",
    border: "border-purple-200 dark:border-purple-500/20",
    glow: "hover:shadow-lg hover:shadow-purple-500/10",
    accent: "bg-purple-500",
    icon: "text-purple-600 dark:text-purple-400",
  },
  Shopping: {
    bg: "bg-emerald-100 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-500/20",
    glow: "hover:shadow-lg hover:shadow-emerald-500/10",
    accent: "bg-emerald-500",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  Events: {
    bg: "bg-violet-100 dark:bg-violet-500/10",
    border: "border-violet-200 dark:border-violet-500/20",
    glow: "hover:shadow-lg hover:shadow-violet-500/10",
    accent: "bg-violet-500",
    icon: "text-violet-600 dark:text-violet-400",
  },
};

// Helper function to get listing image URL
function getListingImageUrl(listing: Listing): string {
  // Try to get image from listing.images array (primary method)
  if (
    listing.images &&
    Array.isArray(listing.images) &&
    listing.images.length > 0
  ) {
    // Find primary image or return first image
    const primaryImage = listing.images.find((img) => img.is_primary);
    if (primaryImage) {
      return primaryImage.url;
    }
    // Sort by display_order and return first
    const sortedImages = listing.images.sort(
      (a, b) => (a.display_order || 0) - (b.display_order || 0)
    );
    if (sortedImages.length > 0) {
      return sortedImages[0].url;
    }
  }

  // Try to get image from custom_attributes
  if (
    listing.custom_attributes &&
    typeof listing.custom_attributes === "object" &&
    !Array.isArray(listing.custom_attributes)
  ) {
    const attributes = listing.custom_attributes as { image_url?: string };
    if (attributes.image_url) {
      return attributes.image_url;
    }
  }

  // Category-based fallbacks
  const categoryName = listing.category_name?.toLowerCase() || "";

  if (
    categoryName.includes("eat") ||
    categoryName.includes("drink") ||
    categoryName.includes("restaurant") ||
    categoryName.includes("food")
  ) {
    return "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=400&fit=crop&crop=center&auto=format&q=80";
  } else if (categoryName.includes("stay") || categoryName.includes("hotel")) {
    return "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=400&fit=crop&crop=center&auto=format&q=80";
  } else if (
    categoryName.includes("shopping") ||
    categoryName.includes("mall")
  ) {
    return "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=600&h=400&fit=crop&crop=center&auto=format&q=80";
  } else if (
    categoryName.includes("entertainment") ||
    categoryName.includes("fun")
  ) {
    return "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&h=400&fit=crop&crop=center&auto=format&q=80";
  } else if (
    categoryName.includes("things to do") ||
    categoryName.includes("attraction")
  ) {
    return "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop&crop=center&auto=format&q=80";
  } else {
    return "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop&crop=center&auto=format&q=80";
  }
}

export function FeaturedListingsCarousel({
  featuredListings,
  className,
}: FeaturedListingsCarouselProps) {
  const [viewportRef, embla] = useEmblaCarousel({
    loop: false,
    containScroll: "trimSnaps",
  });
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const { toast } = useToast();
  const favorites = useFavoritesStore((state) => state.favorites);
  const addFavorite = useFavoritesStore((state) => state.addFavorite);
  const removeFavorite = useFavoritesStore((state) => state.removeFavorite);
  const [isFavLoading, setIsFavLoading] = useState<Record<number, boolean>>({});

  // Embla controls
  const scrollPrev = () => embla && embla.scrollPrev();
  const scrollNext = () => embla && embla.scrollNext();

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => {
      setCanScrollLeft(embla.canScrollPrev());
      setCanScrollRight(embla.canScrollNext());
    };
    onSelect();
    embla.on("select", onSelect);
    embla.on("reInit", onSelect);
    return () => {
      embla.off("select", onSelect);
      embla.off("reInit", onSelect);
    };
  }, [embla]);

  if (!featuredListings || featuredListings.length === 0) {
    return null;
  }

  return (
    <div className={cn("relative", className)}>
      {/* Section Header - Matching FeaturedListingsSection style */}
      <div className="mb-8">
        <div className="flex flex-col items-center justify-center sm:flex-row sm:items-center sm:justify-start gap-2 sm:gap-3 w-full">
          <div className="p-2 sm:p-3 rounded-2xl bg-primary/10 border border-primary/20 flex-shrink-0 mb-2 sm:mb-0">
            <Award className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">
              Featured <span className="gradient-text-primary">This Week</span>
            </h2>
            <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground leading-relaxed">
              Handpicked featured experiences in Karachi
            </p>
          </div>
        </div>
      </div>

      {/* Carousel Container */}
      <div className="relative overflow-hidden">
        {/* Left Fade Gradient (less intense on mobile) */}
        <div
          className={
            `absolute left-0 top-0 bottom-4 w-20 z-20 pointer-events-none ` +
            `bg-gradient-to-r from-background ` +
            `md:via-background/80 md:to-transparent ` +
            `via-background/40 to-transparent `
          }
          style={
            {
              // On mobile, fade is less intense (via 40% instead of 80%)
            }
          }
        />
        {/* Right Fade Gradient (less intense on mobile) */}
        <div
          className={
            `absolute right-0 top-0 bottom-4 w-20 z-20 pointer-events-none ` +
            `bg-gradient-to-l from-background ` +
            `md:via-background/80 md:to-transparent ` +
            `via-background/40 to-transparent `
          }
        />

        {/* Left Scroll Button (dynamic) */}
        {canScrollLeft && (
          <button
            onClick={scrollPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 bg-background/95 backdrop-blur-md border border-border/50 rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl hover:shadow-primary/20 hover:bg-background hover:scale-110 hover:border-primary/30 transition-all duration-300 group"
            aria-label="Scroll left"
          >
            <ArrowRight className="w-5 h-5 rotate-180 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
            {/* Glow Effect */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
          </button>
        )}

        {/* Right Scroll Button (dynamic) */}
        {canScrollRight && (
          <button
            onClick={scrollNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 bg-background/95 backdrop-blur-md border border-border/50 rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl hover:shadow-primary/20 hover:bg-background hover:scale-110 hover:border-primary/30 transition-all duration-300 group"
            aria-label="Scroll right"
          >
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
            {/* Glow Effect */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-l from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
          </button>
        )}

        {/* Carousel with Embla */}
        <div className="embla overflow-hidden" ref={viewportRef}>
          <div className="embla__container flex gap-6 items-stretch pb-4 snap-x snap-mandatory scrollbar-hide scroll-smooth px-3 relative">
            {/* Subtle animated background pattern */}
            <div className="absolute inset-0 opacity-5 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-pulse" />
            </div>
            {featuredListings.map((listing, slideIndex) => {
              const imageUrl = getListingImageUrl(listing);
              const categoryColors = categoryColorSchemes[
                listing.category_name || ""
              ] || {
                bg: "bg-gray-100 dark:bg-gray-500/10",
                border: "border-gray-200 dark:border-gray-500/20",
                glow: "hover:shadow-xl hover:shadow-gray-500/20",
                accent: "bg-gray-500",
                icon: "text-gray-500",
              };

              return (
                <div
                  key={listing.id}
                  className="flex-shrink-0 w-80 snap-start group"
                >
                  <div className="block group relative">
                    <div className="relative overflow-hidden rounded-2xl bg-card border border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 transform-gpu group-hover:scale-[1.02]">
                      {/* Subtle glow */}
                      <div
                        className={cn(
                          "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
                          categoryColors.glow
                        )}
                      />

                      {/* Clean Image Container */}
                      <div className="relative aspect-[4/3] overflow-hidden rounded-t-2xl">
                        {/* Simple Status Badge */}
                        <div className="absolute left-3 top-3 z-20 px-2.5 py-1 rounded-lg text-xs font-medium shadow-sm bg-green-500 text-white">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>Open Now</span>
                          </div>
                        </div>

                        {/* Favorite control moved outside clickable link to avoid navigation on click */}

                        {/* Clean Featured Badge */}
                        <div className="absolute bottom-3 left-3 z-20">
                          <div className="px-2.5 py-1 rounded-lg bg-yellow-500 text-yellow-900 text-xs font-bold shadow-sm">
                            <div className="flex items-center space-x-1">
                              <Crown className="h-3 w-3" />
                              <span>Featured</span>
                            </div>
                          </div>
                        </div>

                        {/* Member Badge */}
                        {(listing as unknown as { is_member?: boolean })
                          .is_member && (
                          <div className="absolute bottom-3 right-3 z-20">
                            <div className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-sm">
                              <div className="flex items-center space-x-1">
                                <Heart className="h-3 w-3 fill-current" />
                                <span>Member</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Clean Image with Subtle Hover */}
                        <OptimizedImage
                          src={imageUrl}
                          alt={`Image of ${listing.name || "Listing"}`}
                          fill
                          priority={slideIndex === 0}
                          sizes="(max-width: 640px) 100vw, (max-width: 768px) 90vw, (max-width: 1024px) 80vw, 1200px"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          draggable="false"
                          fallbackSrc="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop&crop=center&auto=format&q=80"
                        />
                      </div>

                      {/* Clean Content Section - clickable area */}
                      <Link
                        href={`/listing/${listing.slug || "unknown"}`}
                        className="block"
                      >
                        <div className="p-4 space-y-3">
                          {/* Simple Category and Rating */}
                          <div className="flex items-center justify-between">
                            <span
                              className={cn(
                                "px-2 py-1 rounded-md text-xs font-medium",
                                categoryColors.bg,
                                categoryColors.icon
                              )}
                            >
                              {listing.category_name || "Uncategorized"}
                            </span>

                            {/* Clean Rating */}
                            <div className="flex items-center space-x-1">
                              <div className="flex items-center">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={cn(
                                      "h-3.5 w-3.5",
                                      i <
                                        Math.floor(
                                          Number(listing.avg_rating) || 0
                                        )
                                        ? "text-yellow-500 fill-yellow-500"
                                        : "text-muted-foreground/30"
                                    )}
                                  />
                                ))}
                              </div>
                              <span className="text-sm font-medium text-muted-foreground ml-1">
                                {Number(listing.avg_rating || 0).toFixed(1)}
                              </span>
                            </div>
                          </div>

                          {/* Clean Title */}
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors duration-200">
                              {listing.name || "Unnamed Listing"}
                            </h3>

                            {/* Simple Address */}
                            <div className="flex items-center space-x-1 text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />
                              <span className="text-sm line-clamp-1">
                                {listing.address}
                              </span>
                            </div>
                          </div>

                          {/* Clean Footer */}
                          <div className="flex items-center justify-between pt-2 border-t border-border/20">
                            <div className="flex items-center space-x-1 text-muted-foreground">
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span className="text-sm">
                                {listing.review_count || 0} reviews
                              </span>
                            </div>

                            {/* Simple Action Button */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-primary hover:text-primary/80 hover:bg-primary/10 transition-colors duration-200"
                            >
                              View Details
                              <ArrowRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                          </div>
                        </div>
                      </Link>

                      {/* Favorite control placed outside the link */}
                      <div className="absolute top-3 right-3 z-20">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-8 w-8 rounded-lg shadow-sm hover:scale-110 transition-transform duration-200"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const id = listing.id as number;
                            const isCurrentlyFavorited = favorites.some(
                              (fav) => fav.id === id
                            );

                            // Optimistic update
                            if (isCurrentlyFavorited) {
                              removeFavorite(String(id));
                            } else {
                              // Create FavoriteListing object for adding
                              const favoriteListing = {
                                ...listing,
                                favorited_at: new Date().toISOString(),
                              };
                              addFavorite(favoriteListing);
                            }

                            setIsFavLoading((prev) => ({
                              ...prev,
                              [id]: true,
                            }));

                            try {
                              await toggleFavorite(id);
                              // The global store will be updated via real-time subscription
                              // No need to manually update local state
                            } catch (err) {
                              console.error("Favorite toggle failed", err);
                              // Revert optimistic update on error
                              if (isCurrentlyFavorited) {
                                const favoriteListing = {
                                  ...listing,
                                  favorited_at: new Date().toISOString(),
                                };
                                addFavorite(favoriteListing);
                              } else {
                                removeFavorite(String(id));
                              }
                              if (
                                err instanceof Error &&
                                (err as { status?: number }).status === 401
                              ) {
                                toast({
                                  title: "Sign in required",
                                  description:
                                    "Please sign in to save favorites.",
                                });
                                const redirect = encodeURIComponent(
                                  window.location.href
                                );
                                window.location.href = `/login?redirect=${redirect}`;
                              }
                            } finally {
                              setIsFavLoading((prev) => ({
                                ...prev,
                                [id]: false,
                              }));
                            }
                          }}
                        >
                          <Heart
                            className={`h-4 w-4 ${
                              isFavLoading[listing.id as number]
                                ? "animate-pulse"
                                : favorites.some((fav) => fav.id === listing.id)
                                ? "fill-current text-red-500"
                                : ""
                            }`}
                          />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
