"use client";

import { useState } from "react";
import { User } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import {
  Star,
  MessageCircle,
  Filter,
  Calendar,
  Building,
  User as UserIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { useBusinessListings } from "@/hooks/useBusinessListings";
import { useBusinessReviews } from "@/hooks/useBusinessReviews";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  BusinessOwnerPageHeader,
  BUSINESS_OWNER_CARD_SURFACE,
  BUSINESS_OWNER_EMPTY_STATE,
  BUSINESS_OWNER_FILTER_BAR,
} from "./BusinessOwnerPageHeader";

interface BusinessReviewsPageProps {
  user: User;
}

export function BusinessReviewsPage(_props: BusinessReviewsPageProps) {
  const [selectedListing, setSelectedListing] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [needsReplyOnly, setNeedsReplyOnly] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { toast } = useToast();
  const { listings } = useBusinessListings({ limit: 100 });
  const { reviews, loading, pagination, refetch } = useBusinessReviews({
    listingId: selectedListing,
    rating: ratingFilter === "all" ? null : parseInt(ratingFilter),
    needsReply: needsReplyOnly,
  });

  const handleSubmitReply = async (reviewId: number) => {
    if (!replyContent.trim()) return;

    try {
      setSubmitting(true);
      const response = await fetch("/api/business/reviews/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId,
          content: replyContent,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Reply submitted",
          description: "Your reply has been submitted for moderation",
        });
        setReplyingTo(null);
        setReplyContent("");
        refetch();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to submit reply",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <BusinessOwnerPageHeader
        icon={Star}
        title="Reviews"
        description="Read and respond to customer reviews for your listings"
      />

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={cn(
          "flex flex-col sm:flex-row flex-wrap gap-4 mb-8",
          BUSINESS_OWNER_FILTER_BAR,
        )}
      >
        <Select value={selectedListing} onValueChange={setSelectedListing}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <Building className="mr-2 h-4 w-4" />
            <SelectValue placeholder="All Listings" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Listings</SelectItem>
            {listings.map((listing) => (
              <SelectItem key={listing.id} value={listing.id.toString()}>
                {listing.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <Star className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ratings</SelectItem>
            {[5, 4, 3, 2, 1].map((r) => (
              <SelectItem key={r} value={r.toString()}>
                {r} Stars
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={needsReplyOnly ? "default" : "outline"}
          onClick={() => setNeedsReplyOnly(!needsReplyOnly)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Needs Reply
        </Button>
      </motion.div>

      {/* Reviews List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        {loading ? (
          <>
            {[...Array(5)].map((_, i) => (
              <Card key={i} className={BUSINESS_OWNER_CARD_SURFACE}>
                <CardContent className="p-6">
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : reviews.length === 0 ? (
          <div className={BUSINESS_OWNER_EMPTY_STATE}>
            <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-6">
              <MessageCircle className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-2xl font-semibold text-foreground mb-3">
              {needsReplyOnly ? "You’re all caught up" : "No reviews yet"}
            </h3>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {needsReplyOnly
                ? "Every review in this view already has a reply, or try turning off “Needs reply”."
                : "Reviews from customers will show up here as they come in."}
            </p>
          </div>
        ) : (
          reviews.map((review) => (
            <Card
              key={review.id}
              className={cn(BUSINESS_OWNER_CARD_SURFACE, "hover:shadow-md")}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <Avatar>
                      <AvatarImage src={review.reviewer_avatar || undefined} />
                      <AvatarFallback>
                        <UserIcon className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold">{review.reviewer_name}</p>
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "h-4 w-4",
                                i < review.rating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-300",
                              )}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {review.listing_name}
                        {review.branch_name && ` - ${review.branch_name}`}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(new Date(review.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {review.comment && (
                  <p className="text-sm leading-relaxed">{review.comment}</p>
                )}

                {review.reply ? (
                  <div className="bg-muted/50 p-4 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Building className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold text-primary">
                        Your Response
                      </p>
                    </div>
                    <p className="text-sm mb-2">{review.reply.content}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(review.reply.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {replyingTo === review.id ? (
                      <>
                        <Textarea
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          placeholder="Write your professional reply..."
                          className="min-h-[100px]"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setReplyingTo(null);
                              setReplyContent("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSubmitReply(review.id)}
                            disabled={!replyContent.trim() || submitting}
                          >
                            {submitting ? "Submitting..." : "Submit Reply"}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReplyingTo(review.id)}
                        className="gap-2"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Reply to Customer
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </motion.div>

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="outline"
            disabled={!pagination.has_prev}
            onClick={() => {
              // TODO: Implement pagination
            }}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.total_pages}
          </span>
          <Button
            variant="outline"
            disabled={!pagination.has_next}
            onClick={() => {
              // TODO: Implement pagination
            }}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
