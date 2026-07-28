import { query } from "@/lib/db";
import { sortFetchedListingsBySearchRelevance } from "@/lib/listings/search-relevance";
import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q");
    const limit = parseInt(searchParams.get("limit") || "10");

    if (!q || q.length < 2) {
      return NextResponse.json(
        {
          error: "Query must be at least 2 characters long",
        },
        { status: 400 },
      );
    }

    const sanitized = sanitizeSearchTerm(q);
    if (sanitized.length < 2) {
      return NextResponse.json(
        { error: "Query must be at least 2 characters long" },
        { status: 400 },
      );
    }

    const searchTerm = `%${sanitized}%`;
    const allResults: Record<string, unknown>[] = [];

    const { rows: listingsRaw } = await query(
      `SELECT id, name, slug, description, address, category_name,
              is_featured, avg_rating, review_count
       FROM listings_with_details
       WHERE status = 'published'
         AND (
           name ILIKE $1 OR description ILIKE $1 OR address ILIKE $1
           OR EXISTS (
             SELECT 1 FROM listing_categories lc
             JOIN categories c ON c.id = lc.category_id
             WHERE lc.listing_id = listings_with_details.id AND c.name ILIKE $1
           )
         )
       LIMIT $2`,
      [searchTerm, Math.min(50, limit * 3)],
    );

    const listingsOrdered = sortFetchedListingsBySearchRelevance(
      (listingsRaw ?? []).map((row) => ({
        ...row,
        id: row.id !== null ? Number(row.id) : row.id,
      })) as never,
      sanitized,
    ).slice(0, limit);

    for (const listing of listingsOrdered) {
      allResults.push({
        ...listing,
        type: "listing",
        category: listing.category_name,
      });
    }

    // Search events
    const { rows: events } = await query(
      `SELECT id, name, slug, description,
              to_json(start_time) #>> '{}' AS start_time,
              to_json(end_time) #>> '{}' AS end_time
       FROM events
       WHERE status = 'published'
         AND (name ILIKE $1 OR description ILIKE $1)
         AND start_time >= $2
       LIMIT $3`,
      [searchTerm, new Date().toISOString(), limit],
    );

    if (events) {
      allResults.push(
        ...events.map((event) => ({
          ...event,
          id: event.id !== null ? Number(event.id) : event.id,
          type: "event",
          category: "Event",
        })),
      );
    }

    // Search posts
    const { rows: posts } = await query(
      `SELECT id, title, slug, excerpt,
              to_json(published_at) #>> '{}' AS published_at
       FROM posts
       WHERE status = 'published'
         AND (title ILIKE $1 OR excerpt ILIKE $1)
       LIMIT $2`,
      [searchTerm, limit],
    );

    if (posts) {
      allResults.push(
        ...posts.map((post) => ({
          ...post,
          id: post.id !== null ? Number(post.id) : post.id,
          type: "post",
          name: post.title,
          description: post.excerpt,
          category: "Guide/Article",
        })),
      );
    }

    return NextResponse.json(
      {
        query: q,
        results: allResults.slice(0, limit),
        total: allResults.length,
        cached: false,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "CDN-Cache-Control": "max-age=300",
          "Vercel-CDN-Cache-Control": "max-age=300",
        },
      },
    );
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
