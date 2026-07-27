import { query } from "@/lib/db";
import { EventReviewsSection } from "@/components/events/EventReviewsSection";

interface EventReviewsContainerProps {
  listingId: number;
}

export async function EventReviewsContainer({
  listingId,
}: EventReviewsContainerProps) {
  const { rows } = await query(
    `SELECT
       r.id, r.user_id, r.rating, r.comment, r.branch_id, r.helpful_count,
       to_json(r.created_at) #>> '{}' AS created_at,
       CASE WHEN p.id IS NOT NULL
         THEN json_build_object('full_name', p.full_name, 'avatar_url', p.avatar_url)
         ELSE NULL
       END AS profiles
     FROM public.reviews r
     LEFT JOIN public.profiles p ON p.id = r.user_id
     WHERE r.listing_id = $1 AND r.status = 'approved'
     ORDER BY r.created_at DESC
     LIMIT 10`,
    [listingId],
  );

  if (!rows || rows.length === 0) {
    return null;
  }

  const reviews = rows.map((row) => ({
    ...row,
    id: Number(row.id),
    branch_id: row.branch_id !== null ? Number(row.branch_id) : undefined,
  }));

  return <EventReviewsSection reviews={reviews} listingId={listingId} />;
}
