"use client";

import { useEffect, useState, useCallback } from "react";
import type {
  BusinessOwnerAnalytics,
  ApiResponse,
} from "@/types/business-owner.types";

interface UseBusinessAnalyticsOptions {
  listingId?: string | null;
  startDate: string;
  endDate: string;
  timezone?: string;
  granularity?: "day" | "week" | "month";
  autoFetch?: boolean;
}

export function useBusinessAnalytics(options: UseBusinessAnalyticsOptions) {
  const {
    listingId,
    startDate,
    endDate,
    timezone = "Asia/Karachi",
    granularity = "day",
    autoFetch = true,
  } = options;

  const [data, setData] = useState<BusinessOwnerAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!startDate || !endDate) {
      setError("Start date and end date are required");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        startDate,
        endDate,
        timezone,
        granularity,
      });

      if (listingId) {
        params.append("listingId", listingId);
      }

      const response = await fetch(
        `/api/business/analytics?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: ApiResponse<BusinessOwnerAnalytics> = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || "Failed to fetch analytics");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [listingId, startDate, endDate, timezone, granularity]);

  useEffect(() => {
    if (autoFetch && startDate && endDate) {
      fetchAnalytics();
    }
  }, [fetchAnalytics, autoFetch, startDate, endDate]);

  return {
    data,
    loading,
    error,
    refetch: fetchAnalytics,
  };
}
