"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Star,
  CheckCircle,
  XCircle,
  Flag,
  ThumbsUp,
  Image as ImageIcon,
  MessageSquare,
  Clock,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReviewsTableProps, ReviewStatus } from "@/types/review.types";

export function ReviewsTable({
  reviews,
  isLoading,
  onEditReview,
  onDeleteReview,
  onModerateReview,
  currentPage,
  totalPages,
  onPageChange,
  selectedReviews,
  onSelectReview,
  isBulkMode = false,
}: ReviewsTableProps) {
  const [dropdownOpen, setDropdownOpen] = React.useState<
    Record<number, boolean>
  >({});

  // Prevent scroll lock when dropdown opens
  React.useEffect(() => {
    const hasOpenDropdown = Object.values(dropdownOpen).some(
      (isOpen) => isOpen,
    );

    if (hasOpenDropdown) {
      // Remove any scroll-lock attributes that Radix might add
      const body = document.body;
      const removeScrollLock = () => {
        body.removeAttribute("data-scroll-locked");
        body.style.marginRight = "";
        body.style.paddingRight = "";
        body.style.overflow = "";
      };

      // Remove immediately and set up observer to catch any future additions
      removeScrollLock();

      const observer = new MutationObserver(() => {
        if (body.hasAttribute("data-scroll-locked")) {
          removeScrollLock();
        }
      });

      observer.observe(body, {
        attributes: true,
        attributeFilter: ["data-scroll-locked", "style"],
      });

      return () => {
        observer.disconnect();
        removeScrollLock();
      };
    }
  }, [dropdownOpen]);

  const getStatusBadgeColor = (status: ReviewStatus) => {
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

  const getStatusIcon = (status: ReviewStatus) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-3 w-3" />;
      case "rejected":
        return <XCircle className="h-3 w-3" />;
      case "flagged":
        return <Flag className="h-3 w-3" />;
      case "pending":
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

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
                : "text-gray-300 dark:text-gray-600",
            )}
          />
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[600px] auto-rows-fr items-start">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse h-full">
            <CardContent className="p-5">
              <div className="flex items-start space-x-3 mb-4">
                <div className="h-12 w-12 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </div>
              <div className="space-y-3 mb-4">
                <div className="h-16 bg-muted rounded"></div>
              </div>
              <div className="flex items-center justify-between">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="h-6 bg-muted rounded w-1/6"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 min-h-[600px]">
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg mb-2">No reviews found</h3>
        <p className="text-muted-foreground text-center max-w-md">
          No reviews match the current filters. Try adjusting your search
          criteria or wait for new reviews to be submitted.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Bulk Selection Header */}
      {isBulkMode && selectedReviews && selectedReviews.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 backdrop-blur-sm rounded-xl border border-primary/20 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-primary">
              {selectedReviews.size} review
              {selectedReviews.size !== 1 ? "s" : ""} selected
            </span>
          </div>
        </motion.div>
      )}

      {/* Reviews Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr items-start min-h-[600px]">
        {reviews.map((review, index) => (
          <motion.div
            key={review.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            whileHover={{ y: -2 }}
          >
            <Card className="group relative overflow-hidden flex flex-col h-full bg-background/90 backdrop-blur-md border border-border/60 shadow-premium hover:shadow-premium-lg transition-all duration-300">
              {/* Subtle hover background - optimized for less blur */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              {/* Top right dropdown */}
              <div className="absolute top-3 right-3 z-20">
                <DropdownMenu
                  open={dropdownOpen[review.id] ?? false}
                  onOpenChange={(open) =>
                    setDropdownOpen((prev) => ({
                      ...prev,
                      [review.id]: open,
                    }))
                  }
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 bg-background/80 backdrop-blur-sm border border-border/50 shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-primary/10 hover:text-primary"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-44 bg-background/95 backdrop-blur-md shadow-premium border-border/60 rounded-xl"
                  >
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/2 rounded-xl pointer-events-none" />

                    <div className="relative z-10 p-2">
                      <DropdownMenuItem
                        onClick={() => onEditReview(review)}
                        className="cursor-pointer hover:bg-primary/10 focus:bg-primary/10 transition-colors duration-200"
                      >
                        <Edit className="h-3.5 w-3.5 mr-2" />
                        Edit Review
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onModerateReview(review, "approved")}
                        className="cursor-pointer hover:bg-primary/10 focus:bg-primary/10 transition-colors duration-200"
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-2" />
                        Approve
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onModerateReview(review, "rejected")}
                        className="cursor-pointer hover:bg-primary/10 focus:bg-primary/10 transition-colors duration-200"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-2" />
                        Reject
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onModerateReview(review, "flagged")}
                        className="cursor-pointer hover:bg-primary/10 focus:bg-primary/10 transition-colors duration-200"
                      >
                        <Flag className="h-3.5 w-3.5 mr-2" />
                        Flag
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDeleteReview(review)}
                        className="cursor-pointer text-red-600 focus:text-red-600 hover:bg-red-500/10 focus:bg-red-500/10 transition-colors duration-200"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <CardContent className="p-5 relative z-10 flex-1 flex flex-col">
                {/* Header Section */}
                <div className="flex items-start space-x-3 mb-4">
                  {/* Checkbox for bulk operations */}
                  {isBulkMode && onSelectReview && (
                    <div className="pt-0.5">
                      <Checkbox
                        checked={selectedReviews?.has(review.id) || false}
                        onCheckedChange={(checked) =>
                          onSelectReview(review.id, checked as boolean)
                        }
                        className="mt-0.5"
                      />
                    </div>
                  )}

                  {/* User Avatar */}
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-12 w-12 ring-2 ring-primary/10 dark:ring-primary/20 shadow-sm">
                      <AvatarImage src={review.user_avatar} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold text-sm">
                        {review.user_name?.charAt(0) || "U"}
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
                      <h3 className="font-semibold text-foreground truncate text-base group-hover:text-primary transition-colors duration-300 flex items-center gap-2">
                        <span className="truncate">{review.user_name || "Anonymous"}</span>
                        {!!review.report_count && review.report_count > 0 && (
                          <span
                            title={`${review.report_count} pending report${review.report_count === 1 ? "" : "s"}`}
                            className="shrink-0 inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                          >
                            🚩 {review.report_count}
                          </span>
                        )}
                      </h3>
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {new Date(review.created_at).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <div className="p-1 bg-muted/50 rounded text-xs">
                          <MessageSquare className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <span className="text-xs text-muted-foreground truncate">
                          {review.listing_name}
                        </span>
                      </div>
                      {review.branch_name && (
                        <div className="flex items-center gap-1">
                          <div className="p-1 bg-primary/10 rounded text-xs">
                            <MapPin className="h-3 w-3 text-primary" />
                          </div>
                          <span className="text-xs text-primary font-medium truncate">
                            {review.branch_name}
                          </span>
                        </div>
                      )}
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
                      getStatusBadgeColor(review.status),
                    )}
                  >
                    {getStatusIcon(review.status)}
                    <span className="capitalize">{review.status}</span>
                  </div>
                </div>

                {/* Review Images and Helpful Count */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    {review.images && review.images.length > 0 && (
                      <div className="flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" />
                        <span>{review.images.length}</span>
                      </div>
                    )}
                    {review.helpful_count !== undefined && (
                      <div className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" />
                        <span>{review.helpful_count || 0}</span>
                      </div>
                    )}
                    {review.comment_count !== undefined && (
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        <span>{review.comment_count || 0}</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onModerateReview(review, "approved")}
                      className="h-6 px-2 text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/50"
                    >
                      <CheckCircle className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onModerateReview(review, "rejected")}
                      className="h-6 px-2 text-xs bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/50"
                    >
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}
