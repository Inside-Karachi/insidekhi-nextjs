"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CommentWithAuthor,
  CommentListResponse,
  CommentStatus,
} from "@/types/comment.types";
import { CommentItem } from "./CommentItem";
import { CommentForm } from "./CommentForm";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CommentSectionProps {
  reviewId: number;
  isAdmin?: boolean;
  onModerate?: (commentId: number, status: CommentStatus) => void;
  className?: string;
}

export function CommentSection({
  reviewId,
  isAdmin = false,
  onModerate,
  className = "",
}: CommentSectionProps) {
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalComments, setTotalComments] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();

  // Fetch comments
  const fetchComments = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      try {
        if (pageNum === 1) setLoading(true);
        else setLoadingMore(true);

        const response = await fetch(
          `/api/reviews/${reviewId}/comments?page=${pageNum}&limit=10`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch comments");
        }

        const data: CommentListResponse = await response.json();

        if (append) {
          setComments((prev) => [...prev, ...data.comments]);
        } else {
          setComments(data.comments);
        }

        setTotalComments(data.total);
        setHasMore(data.has_more);
        setPage(pageNum);
      } catch (error) {
        console.error("Error fetching comments:", error);
        toast({
          title: "Error",
          description: "Failed to load comments. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [reviewId, toast]
  );

  // Load initial comments and set up smart polling for admin
  useEffect(() => {
    fetchComments(1, false);

    // If admin mode, set up smart polling to auto-refresh comments
    if (isAdmin) {
      const pollingInterval = setInterval(() => {
        if (!document.hidden) {
          // Silently refresh without showing loading state
          fetchComments(1, false);
        }
      }, 10000); // 10 seconds

      // Refresh when tab becomes visible
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          void fetchComments(1, false);
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        clearInterval(pollingInterval);
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );
      };
    }
  }, [reviewId, refreshKey, fetchComments, isAdmin]);

  // Handle new comment submission
  const handleCommentSubmit = async (content: string, parentId?: number) => {
    try {
      const response = await fetch(`/api/reviews/${reviewId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
          parent_id: parentId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit comment");
      }

      const data = await response.json();

      toast({
        title: "Success",
        description: data.message,
      });

      // Refresh comments to show the new one (if approved) or pending status
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Error submitting comment:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to submit comment",
        variant: "destructive",
      });
      throw error; // Re-throw to let the form handle it
    }
  };

  // Handle comment update
  const handleCommentUpdate = (updatedComment: CommentWithAuthor) => {
    setComments((prev) =>
      prev.map((comment) =>
        comment.id === updatedComment.id ? updatedComment : comment
      )
    );
  };

  // Handle comment delete
  const handleCommentDelete = (commentId: number) => {
    setComments((prev) => prev.filter((comment) => comment.id !== commentId));
    setTotalComments((prev) => prev - 1);
  };

  // Load more comments
  const loadMoreComments = () => {
    if (hasMore && !loadingMore) {
      fetchComments(page + 1, true);
    }
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Comments</h3>
        </div>
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        <h3 className="text-lg font-semibold">
          Comments {totalComments > 0 && `(${totalComments})`}
        </h3>
      </div>

      {/* Comment Form */}
      <CommentForm
        onSubmit={(content: string) => handleCommentSubmit(content)}
        placeholder="Share your thoughts about this review..."
        className="mb-6"
      />

      {/* Comments List */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No comments yet</p>
            <p className="text-sm">Be the first to share your thoughts!</p>
          </div>
        ) : (
          <>
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                reviewId={reviewId}
                onUpdate={handleCommentUpdate}
                onDelete={handleCommentDelete}
                onReply={(content: string) =>
                  handleCommentSubmit(content, comment.id)
                }
                isAdmin={isAdmin}
                onModerate={onModerate}
              />
            ))}

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={loadMoreComments}
                  disabled={loadingMore}
                  className="min-w-[120px]"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
