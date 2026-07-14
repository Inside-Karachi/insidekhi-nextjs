"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { OptimizedImage } from "@/components/ui/optimized-image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Star,
  Heart,
  Clock,
  ArrowRight,
  Crown,
  MessageSquare,
  Award,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/types/supabase";
import { getListingImageUrl } from "@/lib/utils/listing-images";
import { useFavoritesStore } from "@/lib/context/favoritesStore";
import { toggleFavorite } from "@/lib/favorites";

type Listing = Database["public"]["Views"]["listings_with_details"]["Row"];

interface FeaturedListingsSectionProps {
  listings: Listing[];
}

// Premium category color schemes for listing cards
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
  "Things to Do": {
    bg: "bg-amber-100 dark:bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-500/20",
    glow: "hover:shadow-lg hover:shadow-amber-500/10",
    accent: "bg-amber-500",
    icon: "text-amber-600 dark:text-amber-400",
  },
  Events: {
    bg: "bg-violet-100 dark:bg-violet-500/10",
    border: "border-violet-200 dark:border-violet-500/20",
    glow: "hover:shadow-lg hover:shadow-violet-500/10",
    accent: "bg-violet-500",
    icon: "text-violet-600 dark:text-violet-400",
  },
};

export function FeaturedListingsSection({
  listings,
}: FeaturedListingsSectionProps) {
  const { toast } = useToast();
  const favorites = useFavoritesStore((state) => state.favorites);
  const addFavorite = useFavoritesStore((state) => state.addFavorite);
  const removeFavorite = useFavoritesStore((state) => state.removeFavorite);
  const [isFavLoading, setIsFavLoading] = useState<Record<number, boolean>>({});
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: "easeOut" as const,
      },
    },
  };

  // Get status
  const getStatus = () => {
    return "Open"; // Static status to avoid hydration issues
  };

  if (!listings || listings.length === 0) {
    return null;
  }

  return (
    <section className="relative py-12 sm:py-16 md:py-20 lg:py-24 overflow-hidden">
      {/* Premium Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background to-background/50" />

      {/* Floating Background Elements */}
      <div className="absolute top-32 left-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-32 right-32 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Mobile-First Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="mb-12 sm:mb-16"
        >
          {/* Unified Header for All Screen Sizes */}
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">
                Featured{" "}
                <span className="gradient-text-primary">Destinations</span>
              </h2>
            </div>
            <p className="max-w-2xl mx-auto text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed px-4 sm:px-0">
              Handpicked by our local experts, these are the places that define
              Karachi&apos;s unique character.
            </p>
          </div>
        </motion.div>

        {/* Featured Listings Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8"
        >
          {listings.map((listing) => {
            const status = getStatus();
            const imageUrl = getListingImageUrl(listing);
            const categoryColors = categoryColorSchemes[
              listing.category_name || ""
            ] || {
              bg: "from-gray-500/10 via-gray-500/5 to-transparent",
              border: "border-gray-500/20",
              glow: "hover:shadow-xl hover:shadow-gray-500/20",
              accent: "bg-gray-500",
              icon: "text-gray-500",
            };

            return (
              <motion.div
                key={listing.id || `listing-${listing.slug}`}
                variants={itemVariants}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                whileHover={{
                  scale: 1.02,
                  y: -8,
                  transition: { duration: 0.3, ease: "easeOut" },
                }}
                className="group"
              >
                <div className="block group">
                  <div className="relative overflow-hidden rounded-2xl bg-card border border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 transform-gpu group-hover:scale-[1.02]">
                    {/* Subtle premium glow */}
                    <div
                      className={cn(
                        "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
                        categoryColors.glow
                      )}
                    />
                    {/* Clean Image Container */}
                    <div className="relative aspect-[4/3] overflow-hidden rounded-t-2xl">
                      {/* Simple Status Badge */}
                      <div
                        className={cn(
                          "absolute left-3 top-3 z-20 px-2.5 py-1 rounded-lg text-xs font-medium shadow-sm",
                          status === "Open"
                            ? "bg-green-500 text-white"
                            : "bg-red-500 text-white"
                        )}
                      >
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            {status === "Open" ? "Open Now" : "Closed"}
                          </span>
                        </div>
                      </div>

                      {/* Favorite control moved below (outside the clickable area) */}

                      {/* Clean Featured Badge */}
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

                      {/* Member Badge */}
                      {listing.show_member_badge && (
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
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        fallbackSrc="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop&crop=center&auto=format&q=80"
                      />

                      {/* Simple gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
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
                                    i < Math.floor(listing.avg_rating || 0)
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
                          <h3 className="text-base md:text-lg font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors duration-200">
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
                            className="text-primary hover:text-primary/80 hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors duration-200"
                          >
                            View Details
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </Link>

                    {/* Favorite control placed outside the link to avoid navigation on click */}
                    <div className="absolute top-3 right-3 z-20">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 rounded-lg shadow-sm hover:scale-110 transition-transform duration-200"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const id = listing.id as number;
                          if (isFavLoading[id]) return;
                          setIsFavLoading((prev) => ({ ...prev, [id]: true }));
                          try {
                            const res = await toggleFavorite(id);
                            if (typeof res?.favorited !== "undefined") {
                              if (res.favorited) {
                                addFavorite({
                                  ...listing,
                                  favorited_at: new Date().toISOString(),
                                });
                              } else {
                                removeFavorite(String(id));
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
                            favorites.some(
                              (fav) => String(fav.id) === String(listing.id)
                            )
                              ? "fill-current text-red-500"
                              : ""
                          }`}
                        />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* View All Listings CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="text-center mt-16"
        >
          <Link href="/listings">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center space-x-3 px-6 sm:px-8 py-3 sm:py-4 rounded-2xl bg-primary/10 backdrop-blur-xl border border-primary/20 shadow-premium hover:shadow-premium-lg hover:bg-primary/20 transition-all duration-300 group"
            >
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <span className="text-base sm:text-lg font-semibold text-primary">
                Discover All Places
              </span>
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-primary group-hover:translate-x-1 transition-transform duration-300" />
            </motion.div>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
