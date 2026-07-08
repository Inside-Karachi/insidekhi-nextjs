"use client";

import { useEffect, useState } from "react";
import type {
  BusinessOwnerDashboardStats,
  ApiResponse,
} from "@/types/business-owner.types";

export function useBusinessStats() {
  const [stats, setStats] = useState<BusinessOwnerDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/business/dashboard/stats");

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: ApiResponse<BusinessOwnerDashboardStats> =
          await response.json();

        if (data.success) {
          setStats(data.data);
          setError(null);
        } else {
          setError(data.error || "Failed to fetch stats");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Refresh stats every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return { stats, loading, error };
}
