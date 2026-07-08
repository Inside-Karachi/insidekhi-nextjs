"use client";

import { useState, useEffect, useCallback } from "react";
import { CommentWithAuthor, CommentListResponse } from "@/types/comment.types";
import { CommentItem } from "./CommentItem";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CommentThreadProps {
  reviewId: number;
  parentCommentId: number;
  totalReplies: number;
  className?: string;
}

export function CommentThread({
  reviewId,
  parentCommentId,
  totalReplies,
  className = "",
}: CommentThreadProps) {
  const [replies, setReplies] = useState<CommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const { toast } = useToast();

  // Fetch replies
  const fetchReplies = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      try {
        if (pageNum === 1) setLoading(true);
        else setLoadingMore(true);

        const response = await fetch(
          `/api/reviews/${reviewId}/comments/${parentCommentId}/replies?page=${pageNum}&limit=5`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch replies");
        }

        const data: CommentListResponse = await response.json();

        if (append) {
          setReplies((prev) => [...prev, ...data.comments]);
        } else {
          setReplies(data.comments);
        }

        setHasMore(data.has_more);
        setPage(pageNum);
      } catch (error) {
        console.error("Error fetching replies:", error);
        toast({
          title: "Error",
          description: "Failed to load replies. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [reviewId, parentCommentId, toast]
  );

  // Load initial replies
  useEffect(() => {
    fetchReplies(1, false);
  }, [fetchReplies]);

  // Handle reply update
  const handleReplyUpdate = (updatedReply: CommentWithAuthor) => {
    setReplies((prev) =>
      prev.map((reply) => (reply.id === updatedReply.id ? updatedReply : reply))
    );
  };

  // Handle reply delete
  const handleReplyDelete = (replyId: number) => {
    setReplies((prev) => prev.filter((reply) => reply.id !== replyId));
  };

  // Handle new reply submission
  const handleNewReply = async (content: string) => {
    try {
      const response = await fetch(
        `/api/reviews/${reviewId}/comments/${parentCommentId}/replies`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit reply");
      }

      const data = await response.json();

      // Add the new reply to the list if it's approved, or show pending message
      if (data.reply.status === "approved") {
        setReplies((prev) => [data.reply, ...prev]);
      }

      toast({
        title: "Success",
        description: data.message,
      });
    } catch (error) {
      console.error("Error submitting reply:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to submit reply",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Load more replies
  const loadMoreReplies = () => {
    if (hasMore && !loadingMore) {
      fetchReplies(page + 1, true);
    }
  };

  if (loading) {
    return (
      <div className={`flex justify-center py-4 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (replies.length === 0) {
    return (
      <div
        className={`text-center py-4 text-muted-foreground text-sm ${className}`}
      >
        No replies yet
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Reply count indicator */}
      <div className="text-xs text-muted-foreground pl-2 border-l-2 border-muted">
        {replies.length} of {totalReplies} repl
        {totalReplies === 1 ? "y" : "ies"}
      </div>

      {/* Replies list */}
      <div className="space-y-3">
        {replies.map((reply) => (
          <CommentItem
            key={reply.id}
            comment={reply}
            reviewId={reviewId}
            onUpdate={handleReplyUpdate}
            onDelete={handleReplyDelete}
            onReply={handleNewReply}
            isReply={true}
            className="pl-2 border-l-2 border-muted"
          />
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadMoreReplies}
            disabled={loadingMore}
            className="text-xs"
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Loading...
              </>
            ) : (
              "Load More Replies"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
