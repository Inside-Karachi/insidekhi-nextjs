"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface HelpfulVoteButtonProps {
  reviewId: number;
  initialHelpfulCount: number | null;
  className?: string;
}

export function HelpfulVoteButton({
  reviewId,
  initialHelpfulCount,
  className,
}: HelpfulVoteButtonProps) {
  const [helpfulCount, setHelpfulCount] = useState(initialHelpfulCount || 0);
  const [userVoted, setUserVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const checkVotingStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/reviews/${reviewId}/helpful`);
      const result = await response.json();

      if (result.success) {
        setHelpfulCount(result.data.helpful_count);
        setUserVoted(result.data.user_voted);
      }
    } catch (error) {
      console.error("Error checking voting status:", error);
    } finally {
      setIsCheckingStatus(false);
    }
  }, [reviewId]);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };
    checkAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  // Check user's voting status on component mount
  useEffect(() => {
    checkVotingStatus();
  }, [checkVotingStatus]);

  const handleVote = async () => {
    if (isLoading) return;

    // Check if user is authenticated
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to vote on reviews",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const wasVoted = userVoted;

    // Optimistic update
    setUserVoted(!wasVoted);
    setHelpfulCount((prev) => {
      const current = prev || 0;
      return wasVoted ? current - 1 : current + 1;
    });

    try {
      const method = wasVoted ? "DELETE" : "POST";
      const response = await fetch(`/api/reviews/${reviewId}/helpful`, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (result.success) {
        setHelpfulCount(result.data.helpful_count);
        setUserVoted(result.data.user_voted);

        toast({
          title: wasVoted ? "Vote removed" : "Thanks for your feedback!",
          description: wasVoted
            ? "Your helpful vote has been removed"
            : "Your vote helps others find quality reviews",
        });
      } else {
        // Revert optimistic update on error
        setUserVoted(wasVoted);
        setHelpfulCount((prev) => {
          const current = prev || 0;
          return wasVoted ? current + 1 : current - 1;
        });

        toast({
          title: "Error",
          description: result.error || "Failed to record your vote",
          variant: "destructive",
        });
      }
    } catch (error) {
      // Revert optimistic update on error
      setUserVoted(wasVoted);
      setHelpfulCount((prev) => {
        const current = prev || 0;
        return wasVoted ? current + 1 : current - 1;
      });

      console.error("Error voting:", error);
      toast({
        title: "Error",
        description: "Failed to record your vote. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingStatus) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-8 px-2 text-muted-foreground", className)}
        disabled
      >
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        <span className="text-xs">{helpfulCount}</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleVote}
      disabled={isLoading || !isAuthenticated}
      className={cn(
        "h-8 px-2 transition-colors",
        !isAuthenticated
          ? "text-muted-foreground/50 cursor-not-allowed"
          : userVoted
          ? "text-primary bg-primary/10 hover:bg-primary/20"
          : "text-muted-foreground hover:text-primary hover:bg-primary/5",
        className
      )}
      title={!isAuthenticated ? "Sign in to vote on reviews" : undefined}
    >
      {isLoading ? (
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
      ) : (
        <ThumbsUp
          className={cn(
            "w-3 h-3 mr-1 transition-colors",
            userVoted && isAuthenticated ? "fill-current" : ""
          )}
        />
      )}
      <span className="text-xs font-medium">
        {(helpfulCount || 0) > 0 ? helpfulCount : ""}
      </span>
    </Button>
  );
}
