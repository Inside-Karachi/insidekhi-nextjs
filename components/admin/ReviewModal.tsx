"use client";

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Star,
  User,
  Building,
  MessageSquare,
  Image as ImageIcon,
  ThumbsUp,
  CheckCircle,
  XCircle,
  Flag,
  Edit,
  Save,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReviewModalProps, ReviewStatus } from "@/types/review.types";
import { CommentSection } from "@/components/review/CommentSection";
import { CommentStatus } from "@/types/comment.types";

export function ReviewModal({
  review,
  isOpen,
  onClose,
  onSave,
  onModerate,
}: ReviewModalProps) {
  const modalRef = React.useRef<HTMLDivElement>(null);

  // Capture initial body state on component mount - BEFORE any modal interactions
  const initialBodyState = React.useRef({
    scrollHeight: 0,
    clientHeight: 0,
    scrollWidth: 0,
    clientWidth: 0,
    marginRight: "",
    paddingRight: "",
    overflow: "",
    position: "",
    minHeight: "",
    height: "",
    maxHeight: "",
  });

  // Initialize body state capture
  React.useEffect(() => {
    const body = document.body;

    // Capture the pristine body state
    initialBodyState.current = {
      scrollHeight: body.scrollHeight,
      clientHeight: body.clientHeight,
      scrollWidth: body.scrollWidth,
      clientWidth: body.clientWidth,
      marginRight: body.style.marginRight || getComputedStyle(body).marginRight,
      paddingRight:
        body.style.paddingRight || getComputedStyle(body).paddingRight,
      overflow: body.style.overflow || getComputedStyle(body).overflow,
      position: body.style.position || getComputedStyle(body).position,
      minHeight: body.style.minHeight || getComputedStyle(body).minHeight,
      height: body.style.height || getComputedStyle(body).height,
      maxHeight: body.style.maxHeight || getComputedStyle(body).maxHeight,
    };
  }, []);

  // Prevent body height/layout shifts when modal opens - PROACTIVE APPROACH
  React.useEffect(() => {
    if (isOpen) {
      // Body stabilization active

      const body = document.body;
      const html = document.documentElement;

      // Immediately restore initial body state to prevent any shifts
      const restoreInitialState = () => {
        // Force body to maintain exact initial dimensions
        body.style.setProperty(
          "height",
          initialBodyState.current.height,
          "important",
        );
        body.style.setProperty(
          "min-height",
          initialBodyState.current.minHeight,
          "important",
        );
        body.style.setProperty(
          "max-height",
          initialBodyState.current.maxHeight,
          "important",
        );
        body.style.setProperty(
          "margin-right",
          initialBodyState.current.marginRight,
          "important",
        );
        body.style.setProperty(
          "padding-right",
          initialBodyState.current.paddingRight,
          "important",
        );
        body.style.setProperty(
          "overflow",
          initialBodyState.current.overflow,
          "important",
        );
        body.style.setProperty(
          "position",
          initialBodyState.current.position,
          "important",
        );

        // Prevent any layout shifts by fixing body dimensions
        if (
          !initialBodyState.current.height ||
          initialBodyState.current.height === "auto"
        ) {
          body.style.setProperty(
            "height",
            `${initialBodyState.current.scrollHeight}px`,
            "important",
          );
        }

        // Also ensure html doesn't change
        html.style.overflow = "visible";
        html.style.height = "auto";
      };

      // Restore immediately
      restoreInitialState();

      // Set up aggressive monitoring to prevent any changes
      const preventBodyChanges = () => {
        const currentScrollHeight = body.scrollHeight;
        const currentClientHeight = body.clientHeight;

        // If body dimensions have changed from initial state, restore them
        if (
          Math.abs(
            currentScrollHeight - initialBodyState.current.scrollHeight,
          ) > 5 ||
          Math.abs(
            currentClientHeight - initialBodyState.current.clientHeight,
          ) > 5
        ) {
          restoreInitialState();
        }

        // Also check for any style changes that might cause shifts
        const computedStyle = getComputedStyle(body);
        if (
          computedStyle.overflow !== initialBodyState.current.overflow ||
          computedStyle.position !== initialBodyState.current.position ||
          computedStyle.marginRight !== initialBodyState.current.marginRight
        ) {
          restoreInitialState();
        }
      };

      // Monitor for changes every 16ms (roughly 60fps)
      const monitorInterval = setInterval(preventBodyChanges, 16);

      // Also set up a MutationObserver to catch immediate changes
      const observer = new MutationObserver(() => {
        preventBodyChanges();
      });

      observer.observe(body, {
        attributes: true,
        attributeFilter: ["style"],
      });

      observer.observe(html, {
        attributes: true,
        attributeFilter: ["style"],
      });

      return () => {
        clearInterval(monitorInterval);
        observer.disconnect();
        // Clean up any forced styles when modal closes
        body.style.removeProperty("height");
        body.style.removeProperty("min-height");
        body.style.removeProperty("max-height");
        body.style.removeProperty("margin-right");
        body.style.removeProperty("padding-right");
        body.style.removeProperty("overflow");
        body.style.removeProperty("position");
      };
    }
  }, [isOpen]);

  // Apply additional containment to modal content
  React.useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.style.contain = "layout style paint";
      modalRef.current.style.isolation = "isolate";
      modalRef.current.style.position = "relative";
    }
  }, [isOpen]);

  const [formData, setFormData] = React.useState({
    rating: review?.rating || 5,
    comment: review?.comment || "",
    moderation_reason: "",
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (review) {
      setFormData({
        rating: review.rating,
        comment: review.comment || "",
        moderation_reason: "",
      });
    }
  }, [review]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!review) return;

    setIsSubmitting(true);
    try {
      console.log("Submitting review changes:", {
        rating: formData.rating,
        comment: formData.comment,
        originalRating: review.rating,
        originalComment: review.comment,
      });

      await onSave({
        rating: formData.rating,
        comment: formData.comment,
      });

      console.log("Review changes saved successfully");
    } catch (error) {
      console.error("Error saving review changes:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModerate = async (status: ReviewStatus) => {
    setIsSubmitting(true);
    try {
      await onModerate(status, formData.moderation_reason || undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommentModerate = async (
    commentId: number,
    status: CommentStatus,
  ) => {
    if (!review) return;

    try {
      const response = await fetch(
        `/api/reviews/${review.id}/comments/${commentId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to moderate comment");
      }

      // Refresh comments by triggering a re-fetch
      // This will be handled by the CommentSection component
      console.log(`Comment ${commentId} moderated to ${status}`);
    } catch (error) {
      console.error("Error moderating comment:", error);
      // Error handling is done in CommentItem
    }
  };

  const renderStars = (rating: number, interactive = false) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={
              interactive
                ? (e) => {
                    e.preventDefault();
                    setFormData((prev) => ({ ...prev, rating: star }));
                  }
                : undefined
            }
            className={
              interactive
                ? "cursor-pointer hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
                : "cursor-default"
            }
            disabled={!interactive}
            aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
          >
            <Star
              className={`h-6 w-6 ${
                star <= rating
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300 dark:text-gray-600"
              } transition-colors duration-150`}
            />
          </button>
        ))}
        <span className="ml-3 text-sm text-muted-foreground font-medium">
          {rating} out of 5 stars
        </span>
      </div>
    );
  };

  if (!review) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        ref={modalRef}
        className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          contain: "layout style paint",
          isolation: "isolate",
        }}
      >
        <DialogHeader className="flex-shrink-0 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">
                  Review Details
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  View and moderate review details and content
                </DialogDescription>
              </div>
            </div>
            <Badge
              variant={
                review.status === "approved"
                  ? "default"
                  : review.status === "rejected"
                    ? "destructive"
                    : review.status === "flagged"
                      ? "secondary"
                      : "outline"
              }
              className="capitalize"
            >
              {review.status}
            </Badge>
          </div>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex-1 overflow-y-auto px-6 py-2"
        >
          <Tabs defaultValue="review" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="review" className="flex items-center gap-2">
                <Edit className="h-4 w-4" />
                Review Details
              </TabsTrigger>
              <TabsTrigger value="comments" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Comments
                {review.comment_count && review.comment_count > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {review.comment_count}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="review" className="space-y-8 mt-0">
              {/* Review Information Section */}
              <div className="space-y-8">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <h3 className="text-lg font-medium">Review Information</h3>
                </div>

                <div className="space-y-6">
                  {/* User & Listing Info */}
                  <div className="p-6 bg-gradient-to-r from-background via-muted/30 to-background rounded-xl border border-border/50 shadow-sm">
                    <div className="flex items-start gap-6">
                      <Avatar className="h-16 w-16 ring-2 ring-primary/20 shadow-lg">
                        <AvatarImage src={review.user_avatar} />
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold text-lg">
                          {review.user_name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-4">
                        <div>
                          <h4 className="font-semibold text-lg text-foreground mb-1">
                            {review.user_name || "Anonymous"}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Review submitted on{" "}
                            {new Date(review.created_at).toLocaleDateString(
                              "en-US",
                              {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2 text-sm">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {review.listing_name}
                            </span>
                          </div>
                          {review.helpful_count && review.helpful_count > 0 && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <ThumbsUp className="h-4 w-4" />
                              <span>{review.helpful_count} found helpful</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Review Content Section */}
              <div className="space-y-8">
                <div className="flex items-center gap-2">
                  <Edit className="h-4 w-4 text-primary" />
                  <h3 className="text-lg font-medium">Review Content</h3>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Rating */}
                  <div className="space-y-4">
                    <Label
                      htmlFor="rating"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <Star className="h-4 w-4 text-primary" />
                      Rating
                    </Label>
                    <div className="p-6 bg-gradient-to-r from-muted/30 to-background rounded-lg border border-border/50 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {renderStars(formData.rating, true)}
                        </div>
                        <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                          Click to change rating
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Comment */}
                  <div className="space-y-4">
                    <Label
                      htmlFor="comment"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <MessageSquare className="h-4 w-4 text-primary" />
                      Review Comment
                    </Label>
                    <div className="relative">
                      <Textarea
                        id="comment"
                        value={formData.comment}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            comment: e.target.value,
                          }))
                        }
                        placeholder="Enter review comment..."
                        rows={5}
                        className="min-h-[120px] resize-y bg-background/50 backdrop-blur-sm border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                      />
                    </div>
                  </div>

                  {/* Moderation Reason - shows contextually based on current review status */}
                  {(review.status === "rejected" ||
                    review.status === "flagged") && (
                    <div className="space-y-4">
                      <Label
                        htmlFor="moderation_reason"
                        className="text-sm font-medium"
                      >
                        Moderation Reason{" "}
                        <span className="text-muted-foreground">
                          (Optional)
                        </span>
                      </Label>
                      <div className="relative">
                        <Textarea
                          id="moderation_reason"
                          value={formData.moderation_reason}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              moderation_reason: e.target.value,
                            }))
                          }
                          placeholder="Enter reason for moderation action..."
                          rows={3}
                          className="resize-none bg-background/50 backdrop-blur-sm border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                        />
                      </div>
                    </div>
                  )}
                </form>
              </div>

              <Separator />

              {/* Review Images Section */}
              {review.images && review.images.length > 0 && (
                <div className="space-y-8">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    <h3 className="text-lg font-medium">Review Images</h3>
                    <Badge variant="secondary" className="ml-auto">
                      {review.images.length} image
                      {review.images.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 bg-gradient-to-r from-muted/20 to-background rounded-lg border border-border/50">
                    {review.images.map((image) => (
                      <motion.div
                        key={image.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        className="group relative aspect-square overflow-hidden rounded-xl border border-border/50 bg-muted/20 hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md"
                      >
                        <Image
                          src={image.image_url}
                          alt="Review image"
                          width={200}
                          height={200}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Comments Section */}
              <div className="space-y-8">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <h3 className="text-lg font-medium">Comments</h3>
                  {review.comment_count && review.comment_count > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {review.comment_count} comment
                      {review.comment_count !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>

                <div className="p-6 bg-gradient-to-r from-muted/20 to-background rounded-lg border border-border/50">
                  <CommentSection
                    reviewId={review.id}
                    isAdmin={true}
                    onModerate={handleCommentModerate}
                  />
                </div>
              </div>

              <Separator />

              {/* Helpful Count */}
              {review.helpful_count && review.helpful_count > 0 && (
                <div className="text-sm text-muted-foreground">
                  {review.helpful_count} user
                  {review.helpful_count !== 1 ? "s" : ""} found this review
                  helpful
                </div>
              )}
            </TabsContent>

            <TabsContent value="comments" className="space-y-8 mt-0">
              {/* Comments Management Section */}
              <div className="space-y-8">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <h3 className="text-lg font-medium">Comments Management</h3>
                  {review.comment_count && review.comment_count > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {review.comment_count} comment
                      {review.comment_count !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>

                <div className="p-6 bg-gradient-to-r from-muted/20 to-background rounded-lg border border-border/50">
                  <CommentSection
                    reviewId={review.id}
                    isAdmin={true}
                    onModerate={handleCommentModerate}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>

        <DialogFooter className="flex-shrink-0 pt-8 border-t border-border/50 bg-gradient-to-r from-muted/20 via-background to-muted/20 -mx-6 -mb-6 px-6 py-6">
          <div className="flex items-center justify-between w-full gap-6">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-12 px-6 hover:bg-muted/50 transition-all duration-200"
            >
              Cancel
            </Button>

            <div className="flex items-center gap-4">
              {/* Quick Moderation Actions - Centered and cohesive */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleModerate("approved")}
                  disabled={isSubmitting}
                  className="h-10 px-4 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 transition-all duration-200"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleModerate("rejected")}
                  disabled={isSubmitting}
                  className="h-10 px-4 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/50 border-rose-200 dark:border-rose-800 transition-all duration-200"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleModerate("flagged")}
                  disabled={isSubmitting}
                  className="h-10 px-4 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/50 border-amber-200 dark:border-amber-800 transition-all duration-200"
                >
                  <Flag className="h-4 w-4 mr-2" />
                  Flag
                </Button>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="h-12 px-6 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
