import { createServerSupabase } from "@/lib/supabase/server";
import { EventReviewsSection } from "@/components/events/EventReviewsSection";

interface EventReviewsContainerProps {
  listingId: number;
}

export async function EventReviewsContainer({
  listingId,
}: EventReviewsContainerProps) {
  const supabase = await createServerSupabase({ publicAnon: true });

  const { data: reviews } = await supabase
    .from("reviews")
    .select(
      `
      *,
      profiles!user_id(full_name, avatar_url)
    `
    )
    .eq("listing_id", listingId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!reviews || reviews.length === 0) {
    return null;
  }

  return <EventReviewsSection reviews={reviews} listingId={listingId} />;
}
