"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { ListingCard as PremiumListingCard } from "@/components/listings/ListingCard";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getListingImageUrl } from "@/lib/utils/listing-images";
import Link from "next/link";
import { Star, MapPin, Phone, Globe, Grid3X3, List } from "lucide-react";
import { cn } from "@/lib/utils";

// Permissive types to allow enriched & filtered listing objects assembled server-side
interface Listing {
  id: number;
  name: string | null;
  slug: string | null;
  description: string | null;
  address: string | null;
  phone_number: string | null;
  website: string | null;
  category_name: string | null;
  is_featured: boolean | null;
  avg_rating: number | string | null;
  review_count: number | null;
  [key: string]: unknown;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  [key: string]: unknown;
}

interface ListingsGridProps {
  listings: Listing[];
  category: Category;
  searchParams: {
    search?: string;
    sort?: string;
    price?: string;
    rating?: string;
    category?: string;
  };
}

export function ListingsGrid({
  listings,
  category,
  searchParams,
}: ListingsGridProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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

  if (!listings || listings.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-lg sm:text-xl font-semibold mb-2">
          No listings found
        </h3>
        <p className="text-muted-foreground">
          Try adjusting your search or filters to find what you&apos;re looking
          for.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with view controls */}
      {/* Header with view controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">
            {listings.length} {listings.length === 1 ? "Result" : "Results"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {searchParams.search ? (
              <>
                for{" "}
                <span className="font-medium text-foreground">
                  &ldquo;{searchParams.search}&rdquo;
                </span>
              </>
            ) : (
              <>in {category?.name || "All Listings"}</>
            )}
          </p>
        </div>

        <div className="inline-flex items-center gap-1 bg-muted/30 border border-border/50 rounded-xl p-1">
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className={cn(
              "rounded-lg h-8 w-8 p-0",
              viewMode === "grid" && "shadow-sm bg-background text-foreground"
            )}
            aria-label="Grid view"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className={cn(
              "rounded-lg h-8 w-8 p-0",
              viewMode === "list" && "shadow-sm bg-background text-foreground"
            )}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Listings Grid/List */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className={cn(
          viewMode === "grid"
            ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
            : "space-y-4"
        )}
      >
        {listings.map((raw, index) => {
          const listing = raw as Listing;
          const imageUrl = getListingImageUrl(
            listing as Parameters<typeof getListingImageUrl>[0]
          );

          if (viewMode === "grid") {
            return (
              <PremiumListingCard
                key={listing.id}
                listing={
                  listing as Parameters<typeof PremiumListingCard>[0]["listing"]
                }
                index={index}
                showAnimation={false}
              />
            );
          }

          return (
            <motion.div
              key={listing.id}
              variants={itemVariants}
              className="group"
            >
              <Link href={`/listing/${listing.slug}`} className="block">
                <div className="flex bg-card border border-border/50 rounded-lg p-4 hover:shadow-md transition-all duration-300">
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                    <OptimizedImage
                      src={imageUrl}
                      alt={listing.name || "Listing"}
                      fill
                      className="object-cover"
                      fallbackSrc="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop&crop=center&auto=format&q=80"
                    />
                  </div>
                  <div className="flex-1 ml-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                          {listing.name}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {listing.description}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {listing.is_featured && (
                          <Badge className="bg-primary text-primary-foreground px-2 py-1 text-xs">
                            Featured
                          </Badge>
                        )}
                        {listing.category_name && (
                          <Badge variant="outline" className="text-xs">
                            {listing.category_name}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        {listing.address && (
                          <div className="flex items-center space-x-1">
                            <MapPin className="h-4 w-4" />
                            <span>{listing.address}</span>
                          </div>
                        )}
                        {listing.phone_number && (
                          <div className="flex items-center space-x-1">
                            <Phone className="h-4 w-4" />
                            <span>{listing.phone_number}</span>
                          </div>
                        )}
                        {listing.website && (
                          <div className="flex items-center space-x-1">
                            <Globe className="h-4 w-4" />
                            <span>Website</span>
                          </div>
                        )}
                      </div>
                      {listing.avg_rating && Number(listing.avg_rating) > 0 && (
                        <div className="flex items-center space-x-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-medium">
                            {Number(listing.avg_rating).toFixed(1)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({listing.review_count})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
