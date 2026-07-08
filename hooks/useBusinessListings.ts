"use client";

import { useEffect, useState, useCallback } from "react";
import type {
  BusinessOwnerListing,
  PaginatedResponse,
  ApiResponse,
} from "@/types/business-owner.types";

interface UseBusinessListingsOptions {
  status?: string;
  page?: number;
  limit?: number;
  autoFetch?: boolean;
}

export function useBusinessListings(options: UseBusinessListingsOptions = {}) {
  const { status, page = 1, limit = 20, autoFetch = true } = options;

  const [data, setData] =
    useState<PaginatedResponse<BusinessOwnerListing> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (status) params.append("status", status);
      params.append("page", page.toString());
      params.append("limit", limit.toString());

      const response = await fetch(
        `/api/business/listings?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: ApiResponse<PaginatedResponse<BusinessOwnerListing>> =
        await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || "Failed to fetch listings");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [status, page, limit]);

  useEffect(() => {
    if (autoFetch) {
      fetchListings();
    }
  }, [fetchListings, autoFetch]);

  return {
    listings: data?.items || [],
    pagination: data?.pagination,
    loading,
    error,
    refetch: fetchListings,
  };
}
