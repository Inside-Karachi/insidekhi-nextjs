"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Star,
  MessageSquare,
  ThumbsUp,
  CheckCircle,
  Clock,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useReviewsStore } from "@/lib/context/reviewsStore";
import { cn } from "@/lib/utils";

const getStatusBadgeColor = (status: string | null) => {
  switch (status) {
    case "approved":
      return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    case "rejected":
      return "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
    case "flagged":
      return "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    case "pending":
    default:
      return "bg-slate-50 dark:bg-slate-950/30 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800";
  }
};

const getStatusIcon = (status: string | null) => {
  switch (status) {
    case "approved":
      return <CheckCircle className="h-3 w-3" />;
    case "rejected":
      return <Star className="h-3 w-3" />;
    case "flagged":
      return <Star className="h-3 w-3" />;
    case "pending":
    default:
      return <Clock className="h-3 w-3" />;
  }
};

export function PremiumReviewsGrid() {
  // Use individual selectors to prevent infinite re-renders
  const reviews = useReviewsStore((state) => state.reviews);
  const loading = useReviewsStore((state) => state.loading);
  const error = useReviewsStore((state) => state.error);
  const initialized = useReviewsStore((state) => state.initialized);

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              "h-3.5 w-3.5",
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300 dark:text-gray-600"
            )}
          />
        ))}
      </div>
    );
  };

  // Skeleton loading component
  const ReviewSkeleton = () => (
    <Card className="flex flex-col h-full border border-border/60 shadow-sm">
      <CardContent className="p-5 flex-1 flex flex-col">
        {/* Header skeleton */}
        <div className="flex items-start space-x-3 mb-4">
          <div className="h-12 w-12 bg-muted rounded-full animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
            <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
          </div>
        </div>
        {/* Content skeleton */}
        <div className="mb-3 flex-1 space-y-2">
          <div className="h-16 bg-muted rounded animate-pulse" />
        </div>
        {/* Footer skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-6 bg-muted rounded w-16 animate-pulse" />
          <div className="h-6 bg-muted rounded w-12 animate-pulse" />
        </div>
      </CardContent>
    </Card>
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
            <Star className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Reviews</h1>
            <p className="text-muted-foreground">
              {reviews.length > 0
                ? `${reviews.length} review${
                    reviews.length !== 1 ? "s" : ""
                  } shared`
                : "Share your experiences and help others discover great places"}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading && !initialized ? (
        // Loading skeleton
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr items-start min-h-[600px]">
          {Array.from({ length: 6 }).map((_, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <ReviewSkeleton />
            </motion.div>
          ))}
        </div>
      ) : error ? (
        // Error state
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl p-10 bg-gradient-to-br from-red-50 to-red-25 border border-red-200 text-center"
        >
          <div className="p-4 rounded-full bg-red-100 w-fit mx-auto mb-6">
            <MessageSquare className="w-12 h-12 text-red-600" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground mb-3">
            Failed to load reviews
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            {error ||
              "Something went wrong while loading your reviews. Please try again."}
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium"
          >
            Try Again
          </Button>
        </motion.div>
      ) : reviews.length === 0 && initialized ? (
        // Empty state (only show when initialized and no reviews)
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl p-10 bg-gradient-to-br from-primary/4 to-transparent border border-border/40 text-center"
        >
          <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-6">
            <MessageSquare className="w-12 h-12 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground mb-3">
            No reviews yet
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Share your experiences with restaurants, attractions, and services.
            Your reviews help others discover great places and build our
            community.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button
              asChild
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground transform transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 shadow-md hover:shadow-primary/30 font-medium"
            >
              <Link href="/listings">Explore Places</Link>
            </Button>
          </div>
        </motion.div>
      ) : (
        // Reviews grid
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr items-start min-h-[600px]"
        >
          {reviews.map((review, index) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              whileHover={{ y: -2 }}
            >
              <Card className="group relative overflow-hidden flex flex-col h-full bg-background border border-border/60 shadow-premium hover:shadow-premium-lg transition-all duration-300">
                {/* Subtle hover background */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <CardContent className="p-5 relative z-10 flex-1 flex flex-col">
                  {/* Header Section */}
                  <div className="flex items-start space-x-3 mb-4">
                    {/* User Avatar */}
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-12 w-12 ring-2 ring-primary/10 dark:ring-primary/20 shadow-sm">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold text-sm">
                          Y
                        </AvatarFallback>
                      </Avatar>
                      {/* Status indicator dot */}
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-background rounded-full flex items-center justify-center ring-1 ring-background shadow-sm">
                        {getStatusIcon(review.status)}
                      </div>
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-foreground truncate text-base group-hover:text-primary transition-colors duration-300">
                          You
                        </h3>
                        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                          {new Date(review.reviewed_at).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-muted/50 rounded text-xs">
                          <MessageSquare className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <span className="text-xs text-muted-foreground truncate">
                          {review.listing?.name ||
                            `Listing #${review.listing_id}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Review Comment */}
                  {review.comment && (
                    <div className="mb-3 flex-1">
                      <p className="text-sm text-foreground leading-relaxed line-clamp-3 bg-muted/20 rounded-md p-3 border-l-2 border-primary/20">
                        &ldquo;{review.comment}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Rating and Status */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {renderStars(review.rating)}
                      <span className="text-sm font-medium text-foreground">
                        {review.rating}/5
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border backdrop-blur-sm",
                        getStatusBadgeColor(review.status)
                      )}
                    >
                      {getStatusIcon(review.status)}
                      <span className="capitalize">{review.status}</span>
                    </div>
                  </div>

                  {/* Review Images and Helpful Count */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      {review.listing?.listing_images &&
                        review.listing.listing_images.length > 0 && (
                          <div className="flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" />
                            <span>{review.listing.listing_images.length}</span>
                          </div>
                        )}
                      {review.helpful_count !== undefined && (
                        <div className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          <span>{review.helpful_count || 0}</span>
                        </div>
                      )}
                    </div>

                    {/* View Listing Button */}
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      <Link
                        href={`/listing/${
                          review.listing?.slug || review.listing_id
                        }#reviews`}
                      >
                        View
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </>
  );
}
