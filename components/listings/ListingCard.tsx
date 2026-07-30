"use client";

import { OptimizedImage } from "@/components/ui/optimized-image";
import { Button } from "@/components/ui/button";
import { DistanceBadge } from "@/components/listings/DistanceBadge";
import { toggleFavorite } from "@/lib/favorites";
import { useFavoritesStore } from "@/lib/context/favoritesStore";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Database } from "@/types/database";
import { getListingImageUrl } from "@/lib/utils/listing-images";
import Link from "next/link";
import {
  Star,
  MapPin,
  Heart,
  Clock,
  Crown,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  favorited?: boolean;
  distance_meters?: number;
};

interface ListingCardProps {
  listing: Listing;
  index?: number;
  showAnimation?: boolean;
  onUnfavorite?: () => void;
  /** Priority loading for above-the-fold images (first 3-4 cards) */
  priority?: boolean;
}

// Category color schemes
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
  Shopping: {
    bg: "bg-emerald-100 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-500/20",
    glow: "hover:shadow-lg hover:shadow-emerald-500/10",
    accent: "bg-emerald-500",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  Entertainment: {
    bg: "bg-purple-100 dark:bg-purple-500/10",
    border: "border-purple-200 dark:border-purple-500/20",
    glow: "hover:shadow-lg hover:shadow-purple-500/10",
    accent: "bg-purple-500",
    icon: "text-purple-600 dark:text-purple-400",
  },
  "Guides & Reviews": {
    bg: "bg-indigo-100 dark:bg-indigo-500/10",
    border: "border-indigo-200 dark:border-indigo-500/20",
    glow: "hover:shadow-lg hover:shadow-indigo-500/10",
    accent: "bg-indigo-500",
    icon: "text-indigo-600 dark:text-indigo-400",
  },
  Events: {
    bg: "bg-violet-100 dark:bg-violet-500/10",
    border: "border-violet-200 dark:border-violet-500/20",
    glow: "hover:shadow-lg hover:shadow-violet-500/10",
    accent: "bg-violet-500",
    icon: "text-violet-600 dark:text-violet-400",
  },
};

export function ListingCard({
  listing,
  index = 0,
  showAnimation = true,
  onUnfavorite,
  priority = false,
}: ListingCardProps) {
  const favorites = useFavoritesStore((state) => state.favorites);
  const addFavorite = useFavoritesStore((state) => state.addFavorite);
  const removeFavorite = useFavoritesStore((state) => state.removeFavorite);
  const [isFavLoading, setIsFavLoading] = useState(false);

  const isFavorited = favorites.some(
    (fav) => String(fav.id) === String(listing.id),
  );

  const imageUrl = getListingImageUrl(listing);
  const categoryColors = categoryColorSchemes[listing.category_name || ""] || {
    bg: "bg-gray-100 dark:bg-gray-500/10",
    border: "border-gray-200 dark:border-gray-500/20",
    glow: "hover:shadow-lg hover:shadow-gray-500/10",
    accent: "bg-gray-500",
    icon: "text-gray-600 dark:text-gray-400",
  };

  const getStatus = () => {
    return "Open"; // Static status to avoid hydration issues
  };

  const status = getStatus();

  const { toast } = useToast();

  return (
    <div
      className={cn("group", showAnimation && "animate-fade-in")}
      style={{
        animationDelay: showAnimation ? `${index * 0.06}s` : "0s",
      }}
    >
      <div className="block group">
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 transform-gpu group-hover:scale-[1.02] group-hover:-translate-y-1.5">
          {/* Glow */}
          <div
            className={cn(
              "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
              categoryColors.glow,
            )}
          />

          {/* Image Container */}
          <div className="relative aspect-[4/3] overflow-hidden rounded-t-2xl bg-muted/50 dark:bg-zinc-800/50">
            {/* Status Badge */}
            <div
              className={cn(
                "absolute left-3 top-3 z-20 px-2.5 py-1 rounded-lg text-xs font-medium shadow-sm",
                status === "Open"
                  ? "bg-green-500 text-white"
                  : "bg-red-500 text-white",
              )}
            >
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>{status === "Open" ? "Open Now" : "Closed"}</span>
              </div>
            </div>

            {/* Featured Badge */}
            {listing.is_featured && (
              <div className="absolute bottom-3 left-3 z-20">
                <div className="px-2.5 py-1 rounded-lg bg-yellow-500 text-yellow-900 text-xs font-bold shadow-sm">
                  <div className="flex items-center space-x-1">
                    <Crown className="h-3 w-3" />
                    <span>Featured</span>
                  </div>
                </div>
              </div>
            )}

            {/* Distance Badge - shown when sorting by distance */}
            {listing.distance_meters !== undefined &&
              listing.distance_meters !== null && (
                <div
                  className="absolute bottom-3 left-3 z-20"
                  style={{ marginBottom: listing.is_featured ? "2.5rem" : "0" }}
                >
                  <DistanceBadge
                    distanceMeters={listing.distance_meters}
                    compact
                  />
                </div>
              )}

            {/* Member Badge */}
            {listing.is_member && (
              <div className="absolute bottom-3 right-3 z-20">
                <div className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-sm">
                  <div className="flex items-center space-x-1">
                    <Heart className="h-3 w-3 fill-current" />
                    <span>Member</span>
                  </div>
                </div>
              </div>
            )}

            {/* Image */}
            <OptimizedImage
              src={imageUrl}
              alt={`Image of ${listing.name || "Listing"}`}
              fill
              priority={priority}
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 350px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              fallbackSrc="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop&crop=center&auto=format&q=80"
            />

            {/* overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          </div>

          {/* Favorite button outside link */}
          <Button
            size="icon"
            variant="secondary"
            className="absolute top-3 right-3 z-20 h-8 w-8 rounded-lg shadow-sm hover:scale-110 transition-transform duration-200"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isFavLoading) return;
              setIsFavLoading(true);
              try {
                const res = await toggleFavorite(listing.id as number);
                if (typeof res?.favorited !== "undefined") {
                  if (res.favorited) {
                    addFavorite({
                      ...listing,
                      favorited_at: new Date().toISOString(),
                    });
                  } else {
                    removeFavorite(String(listing.id));
                    if (typeof onUnfavorite === "function") {
                      onUnfavorite();
                    }
                  }
                }
              } catch (err) {
                console.error("Favorite toggle failed", err);
                if (
                  err instanceof Error &&
                  (err as { status?: number }).status === 401
                ) {
                  toast({
                    title: "Sign in required",
                    description: "Please sign in to save favorites.",
                  });
                  const redirect = encodeURIComponent(window.location.href);
                  window.location.href = `/login?redirect=${redirect}`;
                }
              } finally {
                setIsFavLoading(false);
              }
            }}
          >
            <Heart
              className={`h-4 w-4 ${
                isFavorited ? "fill-current text-red-500" : ""
              }`}
            />
          </Button>

          <Link
            href={`/listing/${listing.slug || "unknown"}`}
            className="block"
          >
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "px-2 py-1 rounded-md text-xs font-medium",
                    categoryColors.bg,
                    categoryColors.icon,
                  )}
                >
                  {listing.category_name || "Uncategorized"}
                </span>

                {/* Rating */}
                <div className="flex items-center space-x-1">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "h-3.5 w-3.5",
                          i < Math.floor(listing.avg_rating || 0)
                            ? "text-yellow-500 fill-yellow-500"
                            : "text-muted-foreground/30",
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-muted-foreground ml-1">
                    {Number(listing.avg_rating || 0).toFixed(1)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors duration-200">
                  {listing.name || "Unnamed Listing"}
                </h3>

                <div className="flex items-center space-x-1 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="text-sm line-clamp-1">
                    {listing.address}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/20">
                <div className="flex items-center space-x-1 text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="text-sm">
                    {listing.review_count || 0} reviews
                  </span>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-primary hover:text-primary/80 hover:bg-primary/10 transition-colors duration-200"
                >
                  View Details
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
