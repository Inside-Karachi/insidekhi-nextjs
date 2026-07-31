"use client";

import { useEffect, useState, useCallback } from "react";
import type {
  WriterBlogListItem,
  PaginatedBlogs,
  BlogApiResponse,
} from "@/types/blogs.types";

interface UseWriterBlogsOptions {
  status?: string;
  page?: number;
  limit?: number;
  autoFetch?: boolean;
}

export function useWriterBlogs(options: UseWriterBlogsOptions = {}) {
  const { status, page = 1, limit = 20, autoFetch = true } = options;

  const [data, setData] = useState<PaginatedBlogs<WriterBlogListItem> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBlogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (status && status !== "all") params.append("status", status);
      params.append("page", page.toString());
      params.append("limit", limit.toString());

      const response = await fetch(`/api/writer/blogs?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: BlogApiResponse<PaginatedBlogs<WriterBlogListItem>> =
        await response.json();

      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || "Failed to fetch posts");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [status, page, limit]);

  useEffect(() => {
    if (autoFetch) {
      fetchBlogs();
    }
  }, [fetchBlogs, autoFetch]);

  return {
    blogs: data?.items || [],
    pagination: data?.pagination,
    loading,
    error,
    refetch: fetchBlogs,
  };
}
