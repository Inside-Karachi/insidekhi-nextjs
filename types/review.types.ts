import { Database } from "./supabase";

// Review Types from Supabase (with branch support)
export type Review = Database["public"]["Tables"]["reviews"]["Row"] & {
  user_name?: string;
  user_avatar?: string;
  listing_name?: string;
  listing_slug?: string;
  branch_name?: string;
  helpful_count?: number;
  images?: ReviewImage[];
  comment_count?: number;
};

export type ReviewImage = Database["public"]["Tables"]["review_images"]["Row"];

// Rate limit check result from RPC
export interface ReviewRateLimitCheck {
  can_review: boolean;
  last_review_date: string | null;
  days_since_last_review: number | null;
  message: string;
}

// Branch review statistics from RPC
export interface BranchReviewStats {
  branch_id: number;
  total_reviews: number;
  approved_reviews: number;
  average_rating: number;
  rating_distribution: {
    "1": number;
    "2": number;
    "3": number;
    "4": number;
    "5": number;
  };
}

export type HelpfulReview =
  Database["public"]["Tables"]["helpful_reviews"]["Row"];

// Review Status for moderation
export type ReviewStatus = "pending" | "approved" | "rejected" | "flagged";

// Extended Review type with moderation fields
export interface ReviewWithModeration extends Review {
  status: ReviewStatus;
  moderated_by: string | null;
  moderated_at: string | null;
  moderation_reason?: string;
  flagged_count?: number;
  /** Number of pending user-submitted reports (see `content_reports`). */
  report_count?: number;
}

// Review Statistics
export interface ReviewStatistics {
  totalReviews: number;
  pendingReviews: number;
  approvedReviews: number;
  rejectedReviews: number;
  flaggedReviews: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  // Comment statistics
  totalComments: number;
  pendingComments: number;
  approvedComments: number;
  rejectedComments: number;
  flaggedComments: number;
}

// Review Management Props
export interface ReviewsManagementPageProps {
  currentUserRole: string;
}

export interface ReviewsTableProps {
  reviews: ReviewWithModeration[];
  isLoading: boolean;
  onEditReview: (review: ReviewWithModeration) => void;
  onDeleteReview: (review: ReviewWithModeration) => void;
  onModerateReview: (
    review: ReviewWithModeration,
    status: ReviewStatus,
    reason?: string,
  ) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  selectedReviews?: Set<number>;
  onSelectReview?: (reviewId: number, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  isBulkMode?: boolean;
}

export interface ReviewModalProps {
  review: ReviewWithModeration | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (reviewData: Partial<ReviewWithModeration>) => void;
  onModerate: (status: ReviewStatus, reason?: string) => void;
}

// Review Analytics Types
export interface ReviewAnalytics {
  dailyReviews: Array<{
    date: string;
    count: number;
    averageRating: number;
  }>;
  topRatedListings: Array<{
    listing_id: number;
    listing_name: string;
    average_rating: number;
    review_count: number;
  }>;
  reviewTrends: {
    thisWeek: number;
    lastWeek: number;
    growth: number;
  };
}

// API Response Types
export interface ReviewsApiResponse {
  success: boolean;
  data?: {
    reviews: ReviewWithModeration[];
    total: number;
    page: number;
    limit: number;
  };
  error?: string;
}

export interface ReviewStatsApiResponse {
  success: boolean;
  data?: ReviewStatistics;
  error?: string;
}

// Filter Types
export interface ReviewFilters {
  status?: ReviewStatus;
  rating?: number;
  listing_id?: number;
  user_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

// Moderation Actions
export interface ModerationAction {
  review_id: number;
  action: ReviewStatus;
  reason?: string;
  moderated_by: string;
  moderated_at: string;
}
