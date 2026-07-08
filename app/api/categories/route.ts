import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Cache duration: 1 hour (3600 seconds)
// stale-while-revalidate: serve stale content while fetching new data in background
const CACHE_MAX_AGE = 3600;
const STALE_WHILE_REVALIDATE = 60;

export async function GET() {
  try {
    const supabase = await createServerSupabase({ publicAnon: true });

    // Fetching categories

    const { data: categories, error } = await supabase
      .from("categories")
      .select("id, name, slug, parent_id, icon_name")
      .order("name", { ascending: true });

    if (error) {
      console.error("Supabase error fetching categories:", error);
      return NextResponse.json(
        { error: "Failed to fetch categories", details: error.message },
        { status: 500 }
      );
    }

    // categories loaded

    // Transform the data to match dropdown format
    const categoryOptions =
      categories?.map((category) => ({
        value: String(category.id),
        label: category.name,
        // Add additional metadata if needed
        slug: category.slug,
        parentId: category.parent_id ? String(category.parent_id) : null,
        iconName: category.icon_name,
      })) || [];

    // Create response with cache headers
    const response = NextResponse.json({
      success: true,
      categories: categoryOptions,
      count: categoryOptions.length,
    });

    // Set cache headers for CDN and browser caching
    // This drastically reduces DB queries and improves response times
    response.headers.set(
      "Cache-Control",
      `public, s-maxage=${CACHE_MAX_AGE}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`
    );
    // Vercel-specific CDN cache header
    response.headers.set(
      "CDN-Cache-Control",
      `public, s-maxage=${CACHE_MAX_AGE}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`
    );

    return response;
  } catch (error) {
    console.error("API error fetching categories:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
