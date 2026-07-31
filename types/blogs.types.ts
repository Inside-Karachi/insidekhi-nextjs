export type PostStatus = "draft" | "pending_approval" | "published" | "rejected";

export interface WriterBlogListItem {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  status: PostStatus;
  created_at: string;
  published_at: string | null;
  review_notes: string | null;
}

export interface WriterBlogDetail {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image_url: string | null;
  status: PostStatus;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  category_ids: number[];
}

export interface BlogPagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginatedBlogs<T> {
  items: T[];
  pagination: BlogPagination;
}

export interface BlogApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface BlogCategory {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
}
