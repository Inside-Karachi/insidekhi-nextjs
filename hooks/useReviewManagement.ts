"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { ReviewWithModeration, ReviewStatus } from "@/types/review.types";

interface UseReviewManagementReturn {
  updateReview: (
    reviewId: number,
    reviewData: Partial<ReviewWithModeration>
  ) => Promise<boolean>;
  deleteReview: (reviewId: number) => Promise<boolean>;
  moderateReview: (
    reviewId: number,
    status: ReviewStatus,
    reason?: string
  ) => Promise<boolean>;
  bulkModerate: (
    reviewIds: number[],
    status: ReviewStatus,
    reason?: string
  ) => Promise<boolean>;
  isLoading: boolean;
}

export function useReviewManagement(): UseReviewManagementReturn {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const updateReview = async (
    reviewId: number,
    reviewData: Partial<ReviewWithModeration>
  ): Promise<boolean> => {
    try {
      setIsLoading(true);

      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reviewData),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to update review");
      }

      toast({
        title: "Success",
        description: "Review updated successfully",
      });

      return true;
    } catch (error) {
      console.error("Update review error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update review",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteReview = async (reviewId: number): Promise<boolean> => {
    try {
      setIsLoading(true);

      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to delete review");
      }

      toast({
        title: "Success",
        description: "Review deleted successfully",
      });

      return true;
    } catch (error) {
      console.error("Delete review error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete review",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const moderateReview = async (
    reviewId: number,
    status: ReviewStatus,
    reason?: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);

      const response = await fetch(`/api/admin/reviews/${reviewId}/moderate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, reason }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to moderate review");
      }

      toast({
        title: "Success",
        description: `Review ${status} successfully`,
      });

      return true;
    } catch (error) {
      console.error("Moderate review error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to moderate review",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const bulkModerate = async (
    reviewIds: number[],
    status: ReviewStatus,
    reason?: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);

      const response = await fetch("/api/admin/reviews/bulk-moderate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reviewIds, status, reason }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to moderate reviews");
      }

      toast({
        title: "Success",
        description: `${reviewIds.length} reviews ${status} successfully`,
      });

      return true;
    } catch (error) {
      console.error("Bulk moderate error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to moderate reviews",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    updateReview,
    deleteReview,
    moderateReview,
    bulkModerate,
    isLoading,
  };
}
