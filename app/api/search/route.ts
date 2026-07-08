import { createServerSupabase } from "@/lib/supabase/server";
import { sortFetchedListingsBySearchRelevance } from "@/lib/listings/search-relevance";
import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const limit = parseInt(searchParams.get("limit") || "10");

    if (!query || query.length < 2) {
      return NextResponse.json(
        {
          error: "Query must be at least 2 characters long",
        },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabase({ publicAnon: true });

    const sanitized = sanitizeSearchTerm(query);
    if (sanitized.length < 2) {
      return NextResponse.json(
        { error: "Query must be at least 2 characters long" },
        { status: 400 },
      );
    }

    // Quoted ILIKE pattern (PostgREST) - same style as pre-refactor; do not require DB functions.
    const searchTerm = `%${sanitized}%`;
    const allResults: Record<string, unknown>[] = [];

    const { data: listingsRaw } = await supabase
      .from("listings_with_details")
      .select(
        `
        id,
        name,
        slug,
        description,
        address,
        category_name,
        is_featured,
        avg_rating,
        review_count
      `,
      )
      .eq("status", "published")
      .or(
        `name.ilike."${searchTerm}",description.ilike."${searchTerm}",address.ilike."${searchTerm}",category_name.ilike."${searchTerm}"`,
      )
      .limit(Math.min(50, limit * 3));

    const listingsOrdered = sortFetchedListingsBySearchRelevance(
      (listingsRaw ?? []) as never,
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
    const { data: events } = await supabase
      .from("events")
      .select(
        `
        id,
        name,
        slug,
        description,
        start_time,
        end_time
      `,
      )
      .eq("status", "published")
      .or(`name.ilike."${searchTerm}",description.ilike."${searchTerm}"`)
      .gte("start_time", new Date().toISOString())
      .limit(limit);

    if (events) {
      allResults.push(
        ...events.map((event) => ({
          ...event,
          type: "event",
          category: "Event",
        })),
      );
    }

    // Search posts
    const { data: posts } = await supabase
      .from("posts")
      .select(
        `
        id,
        title,
        slug,
        excerpt,
        published_at
      `,
      )
      .eq("status", "published")
      .or(`title.ilike."${searchTerm}",excerpt.ilike."${searchTerm}"`)
      .limit(limit);

    if (posts) {
      allResults.push(
        ...posts.map((post) => ({
          ...post,
          type: "post",
          name: post.title,
          description: post.excerpt,
          category: "Guide/Article",
        })),
      );
    }

    return NextResponse.json(
      {
        query,
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
