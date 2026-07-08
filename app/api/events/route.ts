import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Ensure this API route always returns fresh data
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "12") || 12));
    const search = searchParams.get("search");
    const location = searchParams.get("location");
    const date = searchParams.get("date");
    const status = (searchParams.get("status") || "published") as
      | "published"
      | "draft"
      | "archived";
    const featured = searchParams.get("featured") === "true";

    const supabase = await createServerSupabase();

    // Build query - show events that haven't ended yet (ongoing + upcoming)
    let query = supabase
      .from("events_with_details")
      .select("*", { count: "exact" })
      .eq("event_status", status)
      .gte("end_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .order("event_id", { ascending: true }); // Deterministic tie-breaker

    // Apply featured filter if requested
    if (featured) {
      query = query.eq("is_featured", true);
      // Order featured events by featured_rank first, then by start_time, then by ID
      query = query
        .order("featured_rank", {
          ascending: false,
          nullsFirst: false,
        })
        .order("start_time", { ascending: true })
        .order("event_id", { ascending: true }); // Deterministic tie-breaker
    }

    // Apply filters
    if (search) {
      query = query.ilike("event_name", `%${search}%`);
    }

    if (location) {
      query = query.ilike("listing_address", `%${location}%`);
    }

    if (date) {
      const filterDate = new Date(date);
      if (!isNaN(filterDate.getTime())) {
        const nextDay = new Date(filterDate.getTime() + 24 * 60 * 60 * 1000);
        query = query
          .gte("start_time", filterDate.toISOString())
          .lt("start_time", nextDay.toISOString());
      }
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: events, error, count } = await query;

    if (error) {
      console.error("Error fetching events:", error);
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 }
      );
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      events: events || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Error in events API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
