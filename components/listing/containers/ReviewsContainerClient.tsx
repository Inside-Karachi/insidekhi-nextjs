"use client";

import { useBranchSelection } from "@/lib/context/BranchSelectionContext";
import { ReviewsSection } from "@/components/listing/ReviewsSection";

interface Branch {
  id: number;
  name: string;
}

interface BaseReview {
  id: number;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  listing_id: number;
  branch_id: number;
  helpful_count?: number | null;
  comment_count?: number | null;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface ReviewWithBranchName extends BaseReview {
  branch_name: string;
}

interface ReviewsContainerClientProps {
  initialReviews: BaseReview[];
  listingId: number;
  listingName: string;
  branches: Branch[];
}

export function ReviewsContainerClient({
  initialReviews,
  listingId,
  listingName,
  branches,
}: ReviewsContainerClientProps) {
  const { selectedBranchId } = useBranchSelection();

  // Create a branch lookup map for efficient access
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));

  // Filter reviews by selected branch FIRST, then attach branch names
  const filteredReviews = selectedBranchId
    ? initialReviews.filter((review) => review.branch_id === selectedBranchId)
    : initialReviews;

  // Attach branch names to filtered reviews
  const reviewsWithBranchNames: ReviewWithBranchName[] = filteredReviews.map(
    (review) => ({
      ...review,
      branch_name: branchMap.get(review.branch_id) || "Unknown Branch",
    }),
  );

  return (
    <ReviewsSection
      initialReviews={reviewsWithBranchNames}
      listingId={listingId}
      listingName={listingName}
      branches={branches}
    />
  );
}
