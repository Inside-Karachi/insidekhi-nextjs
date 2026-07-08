import { createServerSupabase } from "@/lib/supabase/server";
import { ReviewsContainerClient } from "./ReviewsContainerClient";

interface ReviewsContainerProps {
  listingId: number;
  listingName: string;
}

export async function ReviewsContainer({
  listingId,
  listingName,
}: ReviewsContainerProps) {
  const supabase = await createServerSupabase({ publicAnon: true });

  // Fetch branches for this listing
  const { data: branches } = await supabase
    .from("listing_branches")
    .select("id, name")
    .eq("listing_id", listingId)
    .order("is_primary", { ascending: false });

  if (!branches || branches.length === 0) {
    return null; // No branches = no reviews section
  }

  // Fetch all approved reviews for all branches of this listing
  const { data: reviewsData } = await supabase
    .from("reviews")
    .select(
      `
      *,
      helpful_count,
      profiles!user_id(full_name, avatar_url),
      review_images(id, image_url, created_at)
    `,
    )
    .eq("listing_id", listingId)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  // Type cast to include branch_id (will be added after migration)
  const reviews = (reviewsData || []) as Array<{
    id: number;
    user_id: string;
    listing_id: number;
    branch_id: number;
    rating: number;
    comment: string | null;
    created_at: string;
    status: string | null;
    helpful_count: number | null;
    profiles: {
      full_name: string | null;
      avatar_url: string | null;
    } | null;
  }>;

  // Get comment counts for each review
  let reviewsWithCommentCount = reviews || [];
  if (reviews && reviews.length > 0) {
    const reviewIds = reviews.map((r) => r.id);
    const { data: commentCounts } = await supabase
      .from("review_comments")
      .select("review_id")
      .in("review_id", reviewIds)
      .eq("status", "approved");

    // Count comments per review
    const commentCountMap = new Map<number, number>();
    commentCounts?.forEach((comment) => {
      const count = commentCountMap.get(comment.review_id) || 0;
      commentCountMap.set(comment.review_id, count + 1);
    });

    // Add comment count to each review
    reviewsWithCommentCount = reviews.map((review) => ({
      ...review,
      comment_count: commentCountMap.get(review.id) || 0,
    }));
  }

  return (
    <ReviewsContainerClient
      initialReviews={reviewsWithCommentCount}
      listingId={listingId}
      listingName={listingName}
      branches={branches}
    />
  );
}
