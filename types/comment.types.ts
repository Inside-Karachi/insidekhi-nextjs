import { Database } from "./supabase";

// Base comment types from Supabase
export type ReviewComment =
  Database["public"]["Tables"]["review_comments"]["Row"];
export type ReviewCommentInsert =
  Database["public"]["Tables"]["review_comments"]["Insert"];
export type ReviewCommentUpdate =
  Database["public"]["Tables"]["review_comments"]["Update"];

// Extended comment types with author information
export interface CommentWithAuthor extends Omit<ReviewComment, "user_id"> {
  user_id: string;
  author_name: string | null;
  author_avatar: string | null;
  reply_count?: number;
  /** Number of pending user-submitted reports (see `content_reports`). */
  report_count?: number;
}

// Comment creation/update payloads
export interface CreateCommentPayload {
  review_id: number;
  content: string;
  parent_id?: number;
}

export interface UpdateCommentPayload {
  content: string;
}

// Comment moderation actions
export type CommentStatus = "pending" | "approved" | "rejected" | "flagged";

export interface ModerateCommentPayload {
  status: CommentStatus;
  moderated_by: string;
}

// Comment query parameters
export interface CommentQueryParams {
  page?: number;
  limit?: number;
  status?: CommentStatus;
  sort_by?: "created_at" | "updated_at";
  sort_order?: "asc" | "desc";
}

// Comment thread structure
export interface CommentThread {
  comment: CommentWithAuthor;
  replies: CommentWithAuthor[];
}

// API Response types
export interface CommentListResponse {
  comments: CommentWithAuthor[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface CommentThreadResponse {
  thread: CommentThread;
  total_replies: number;
}

// Error types
export interface CommentError {
  message: string;
  code: string;
  details?: Record<string, unknown>;
}

// Validation schemas (for client-side validation)
export const COMMENT_VALIDATION = {
  content: {
    minLength: 1,
    maxLength: 2000,
  },
} as const;

// Comment status labels for UI
export const COMMENT_STATUS_LABELS = {
  pending: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  flagged: "Flagged",
} as const;

// Comment status colors for UI
export const COMMENT_STATUS_COLORS: Record<CommentStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  flagged: "bg-orange-100 text-orange-800 border-orange-200",
} as const;
