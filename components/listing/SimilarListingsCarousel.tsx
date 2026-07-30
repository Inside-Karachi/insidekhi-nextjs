"use client";

import { useState, useRef, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Link from "next/link";
import { toggleFavorite } from "@/lib/favorites";
import { useToast } from "@/hooks/use-toast";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MapPin,
  Star,
  Crown,
  Heart,
  Clock,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { Database } from "@/types/database";
import { useMenuModal } from "@/lib/context/MenuModalContext";
import { useFavoritesStore } from "@/lib/context/favoritesStore";
import { motion } from "framer-motion";
import {
  sectionVariants,
  viewportSettings,
} from "@/lib/utils/listing-animations";

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

interface SimilarListingsCarouselProps {
  similarListings: Listing[];
  categoryColorSchemes: Record<
    string,
    {
      bg: string;
      border: string;
      glow: string;
      accent: string;
      icon: string;
    }
  >;
  hideControls?: boolean;
}

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
    // Default fallback
    return "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop&crop=center&auto=format&q=80";
  }
}

export function SimilarListingsCarousel({
  similarListings,
  categoryColorSchemes,
  hideControls = false,
}: SimilarListingsCarouselProps) {
  const [viewportRef, embla] = useEmblaCarousel({
    loop: false,
    containScroll: "trimSnaps",
  });
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { isOpen: isModalOpen } = useMenuModal();
  const { toast } = useToast();
  const favorites = useFavoritesStore((state) => state.favorites);
  const addFavorite = useFavoritesStore((state) => state.addFavorite);
  const removeFavorite = useFavoritesStore((state) => state.removeFavorite);
  const [isFavLoading, setIsFavLoading] = useState<Record<number, boolean>>({});

  // Set mounted flag after hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Embla controls
  const scrollPrev = () => embla && embla.scrollPrev();
  const scrollNext = () => embla && embla.scrollNext();

  useEffect(() => {
    // Only initialize embla carousel after hydration
    if (!embla || !isMounted) return;
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
  }, [embla, isMounted]);

  // Refs to slide elements and content elements for equal-height calculation
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const contentRefs = useRef<Array<HTMLDivElement | null>>([]);
  // Cache heights to prevent forced reflows
  const cachedHeights = useRef<Map<HTMLDivElement, number>>(new Map());

  useEffect(() => {
    if (!similarListings || similarListings.length === 0) return;

    let raf = 0;
    const observers: ResizeObserver[] = [];
    // Capture the current ref value for cleanup
    const currentCachedHeights = cachedHeights.current;

    const recalc = () => {
      let max = 0;
      // Read phase: batch all reads to prevent layout thrashing
      for (const el of contentRefs.current) {
        if (el) {
          const cachedHeight = currentCachedHeights.get(el);
          if (cachedHeight !== undefined) {
            // Use cached height if available
            if (cachedHeight > max) max = Math.ceil(cachedHeight);
          } else {
            // Only read if not cached
            const h = el.getBoundingClientRect().height;
            currentCachedHeights.set(el, h);
            if (h > max) max = Math.ceil(h);
          }
        }
      }
      // Write phase: batch all writes after reads complete
      for (const slide of slideRefs.current) {
        if (slide) {
          if (max > 0) slide.style.height = `${max}px`;
          else slide.style.height = "auto";
        }
      }
    };

    contentRefs.current.forEach((el) => {
      if (!el) return;
      const ro = new ResizeObserver(() => {
        // Clear cache for this element when it resizes
        if (el) currentCachedHeights.delete(el);
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(recalc);
      });
      ro.observe(el);
      observers.push(ro);
    });

    raf = requestAnimationFrame(recalc);

    const onWin = () => {
      // Clear all caches on window resize
      currentCachedHeights.clear();
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recalc);
    };
    window.addEventListener("resize", onWin);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      observers.forEach((o) => o.disconnect());
      window.removeEventListener("resize", onWin);
      currentCachedHeights.clear();
    };
  }, [similarListings]);

  return (
    <motion.div
      className="w-full relative"
      initial="hidden"
      whileInView="visible"
      viewport={viewportSettings}
      variants={sectionVariants}
    >
      {/* Left fade */}
      <div className="absolute left-0 top-0 bottom-4 w-12 z-20 pointer-events-none bg-gradient-to-r from-background md:via-background/80 md:to-transparent via-background/40 to-transparent" />
      {/* Right fade */}
      <div className="absolute right-0 top-0 bottom-4 w-12 z-20 pointer-events-none bg-gradient-to-l from-background md:via-background/80 md:to-transparent via-background/40 to-transparent" />

      {/* Left control */}
      {!hideControls && !isModalOpen && canScrollLeft && (
        <button
          onClick={scrollPrev}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-background/95 backdrop-blur-md border border-border/50 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:shadow-primary/20 hover:bg-background hover:scale-110 hover:border-primary/30 transition-all duration-300 group"
          aria-label="Scroll left"
        >
          <ArrowRight className="w-4 h-4 rotate-180 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
        </button>
      )}

      {/* Right control */}
      {!hideControls && !isModalOpen && canScrollRight && (
        <button
          onClick={scrollNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-background/95 backdrop-blur-md border border-border/50 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:shadow-primary/20 hover:bg-background hover:scale-110 hover:border-primary/30 transition-all duration-300 group"
          aria-label="Scroll right"
        >
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-l from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
        </button>
      )}

      <div className="embla overflow-hidden" ref={viewportRef}>
        <div className="embla__container flex gap-6 items-stretch pb-4 snap-x snap-mandatory scrollbar-hide scroll-smooth px-3 relative">
          {similarListings.map((similar, idx) => {
            const imageUrl = getListingImageUrl(similar);
            const categoryColors = categoryColorSchemes[
              similar.category_name || ""
            ] || {
              bg: "bg-gray-100 dark:bg-gray-500/10",
              border: "border-gray-200 dark:border-gray-500/20",
              glow: "hover:shadow-xl hover:shadow-gray-500/20",
              accent: "bg-gray-500",
              icon: "text-gray-500",
            };

            return (
              <div
                key={similar.id}
                className="flex-shrink-0 w-80 snap-start group"
                ref={(el) => {
                  slideRefs.current[idx] = el;
                }}
              >
                <div
                  className="h-full"
                  ref={(el) => {
                    contentRefs.current[idx] = el;
                  }}
                >
                  <div className="block group">
                    <div className="relative overflow-hidden rounded-2xl bg-card border border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 transform-gpu group-hover:scale-[1.02]">
                      <div
                        className={cn(
                          "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
                          categoryColors.glow
                        )}
                      />

                      <div className="relative aspect-[4/3] overflow-hidden rounded-t-2xl">
                        {/* Status Badge */}
                        <div className="absolute left-3 top-3 z-20 px-2.5 py-1 rounded-lg text-xs font-medium shadow-sm bg-green-500 text-white">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>Open Now</span>
                          </div>
                        </div>
                        {similar.is_featured && (
                          <div className="absolute bottom-3 left-3 z-20">
                            <div className="px-2.5 py-1 rounded-lg bg-yellow-500 text-yellow-900 text-xs font-bold shadow-sm">
                              <div className="flex items-center space-x-1">
                                <Crown className="h-3 w-3" />
                                <span>Featured</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {similar.show_member_badge && (
                          <div className="absolute bottom-3 right-3 z-20">
                            <div className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-sm">
                              <div className="flex items-center space-x-1">
                                <Heart className="h-3 w-3 fill-current" />
                                <span>Member</span>
                              </div>
                            </div>
                          </div>
                        )}

                        <OptimizedImage
                          src={imageUrl}
                          alt={`Image of ${similar.name || "Listing"}`}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          fallbackSrc="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop&crop=center&auto=format&q=80"
                        />
                      </div>

                      <div className="absolute top-3 right-3 z-20">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-8 w-8 rounded-lg shadow-sm hover:scale-110 transition-transform duration-200"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const id = similar.id as number;
                            const isCurrentlyFavorited = favorites.some(
                              (fav) => fav.id === id
                            );

                            // Optimistic update
                            if (isCurrentlyFavorited) {
                              removeFavorite(String(id));
                            } else {
                              // Create FavoriteListing object for adding
                              const favoriteListing = {
                                ...similar,
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
                            } catch (err: unknown) {
                              console.error("Favorite toggle failed", err);
                              // Revert optimistic update on error
                              if (isCurrentlyFavorited) {
                                const favoriteListing = {
                                  ...similar,
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
                                  action: undefined,
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
                              isFavLoading[similar.id as number]
                                ? "animate-pulse"
                                : favorites.some((fav) => fav.id === similar.id)
                                ? "fill-current text-red-500"
                                : ""
                            }`}
                          />
                        </Button>
                      </div>

                      <Link
                        href={`/listing/${similar.slug || "unknown"}`}
                        className="block"
                      >
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span
                              className={cn(
                                "px-2 py-1 rounded-md text-xs font-medium",
                                categoryColors.bg,
                                categoryColors.icon
                              )}
                            >
                              {similar.category_name || "Uncategorized"}
                            </span>
                            <div className="flex items-center space-x-1">
                              <div className="flex items-center">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={cn(
                                      "h-3.5 w-3.5",
                                      i < Math.floor(similar.avg_rating || 0)
                                        ? "text-yellow-500 fill-yellow-500"
                                        : "text-muted-foreground/30"
                                    )}
                                  />
                                ))}
                              </div>
                              <span className="text-sm font-medium text-muted-foreground ml-1">
                                {Number(similar.avg_rating || 0).toFixed(1)}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors duration-200">
                              {similar.name || "Unnamed Listing"}
                            </h3>
                            <div className="flex items-center space-x-1 text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />
                              <span className="text-sm line-clamp-1">
                                {similar.address}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-border/20">
                            <div className="flex items-center space-x-1 text-muted-foreground">
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span className="text-sm">
                                {similar.review_count || 0} reviews
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-primary hover:text-primary/80 hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors duration-200"
                            >
                              View Details
                              <ArrowRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                          </div>
                        </div>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
