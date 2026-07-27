import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/dashboard/reviews
 * Returns the logged-in user's own reviews (approved + pending), each with
 * its listing's name/slug/images, for the "My Reviews" dashboard page.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rows: reviewRows } = await query(
      `SELECT r.id, r.listing_id, r.rating, r.comment, r.status, r.helpful_count,
         to_json(r.created_at) #>> '{}' AS created_at
       FROM public.reviews r
       WHERE r.user_id = $1 AND r.status IN ('approved', 'pending')
       ORDER BY r.created_at DESC`,
      [session.userId],
    );

    const listingIds = [...new Set(reviewRows.map((r) => Number(r.listing_id)))];

    let listingsById = new Map<number, { name: string; slug: string }>();
    let imagesByListing = new Map<number, { id: number; url: string }[]>();

    if (listingIds.length > 0) {
      const { rows: listingRows } = await query(
        `SELECT id, name, slug FROM public.listings_with_details WHERE id = ANY($1::bigint[])`,
        [listingIds],
      );
      listingsById = new Map(
        listingRows.map((l) => [Number(l.id), { name: l.name, slug: l.slug }]),
      );

      const { rows: imageRows } = await query(
        `SELECT id, listing_id, url FROM public.listing_images WHERE listing_id = ANY($1::bigint[])`,
        [listingIds],
      );
      imagesByListing = new Map();
      for (const img of imageRows) {
        const lid = Number(img.listing_id);
        const list = imagesByListing.get(lid) ?? [];
        list.push({ id: Number(img.id), url: img.url });
        imagesByListing.set(lid, list);
      }
    }

    const reviews = reviewRows.map((r) => {
      const listingId = Number(r.listing_id);
      const listing = listingsById.get(listingId);
      return {
        ...r,
        id: Number(r.id),
        listing_id: listingId,
        reviewed_at: r.created_at,
        helpful_count: r.helpful_count || 0,
        listing: listing
          ? {
              ...listing,
              listing_images: imagesByListing.get(listingId) ?? [],
            }
          : null,
      };
    });

    return NextResponse.json({ reviews });
  } catch (error) {
    console.error("Error fetching dashboard reviews:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
