"use client";

import { useEffect, useState, useCallback } from "react";
import type {
  ApiResponse,
  PaginatedResponse,
} from "@/types/business-owner.types";

export interface BusinessReview {
  id: number;
  listing_id: number;
  listing_name: string;
  branch_id: number | null;
  branch_name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string;
  reviewer_avatar: string | null;
  reply: {
    id: number;
    content: string;
    created_at: string;
    can_edit: boolean;
  } | null;
}

interface UseBusinessReviewsOptions {
  listingId?: string | null;
  branchId?: number | null;
  rating?: number | null;
  needsReply?: boolean;
  page?: number;
  limit?: number;
  autoFetch?: boolean;
}

export function useBusinessReviews(options: UseBusinessReviewsOptions = {}) {
  const {
    listingId,
    branchId,
    rating,
    needsReply,
    page = 1,
    limit = 20,
    autoFetch = true,
  } = options;

  const [data, setData] = useState<PaginatedResponse<BusinessReview> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (listingId && listingId !== "all") {
        params.append("listingId", listingId);
      }
      if (branchId) {
        params.append("branchId", branchId.toString());
      }
      if (rating) {
        params.append("rating", rating.toString());
      }
      if (needsReply) {
        params.append("needsReply", "true");
      }

      const response = await fetch(
        `/api/business/reviews?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: ApiResponse<PaginatedResponse<BusinessReview>> =
        await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || "Failed to fetch reviews");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [listingId, branchId, rating, needsReply, page, limit]);

  useEffect(() => {
    if (autoFetch) {
      fetchReviews();
    }
  }, [fetchReviews, autoFetch]);

  return {
    reviews: data?.items || [],
    pagination: data?.pagination,
    loading,
    error,
    refetch: fetchReviews,
  };
}
