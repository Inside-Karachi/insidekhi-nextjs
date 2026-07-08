import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabase,
  getSupabaseClientForRole,
} from "@/lib/supabase/server";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

const ROUTE = "/api/admin/events";

// GET /api/admin/events - Get all events with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const organizer = searchParams.get("organizer");
    const category = searchParams.get("category");

    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }
    // Use a regular client for profile lookup
    const profileClient = await createServerSupabase();
    const { data: profile, error: profileError } = await profileClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }
    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 },
      );
    }
    // Use correct client for DB operations
    const adminSupabase = await getSupabaseClientForRole(profile.role);

    // Build query for events with details
    let query = adminSupabase
      .from("events_with_details")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // Apply filters
    if (status && status !== "all") {
      query = query.eq(
        "event_status",
        status as "draft" | "published" | "archived",
      );
    }

    if (search) {
      query = query.ilike("event_name", `%${search}%`);
    }

    if (organizer) {
      query = query.ilike("organizer_name", `%${organizer}%`);
    }

    if (category) {
      query = query.eq("category_id", parseInt(category));
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: events, error, count } = await query;

    if (error) {
      console.error("Error fetching events:", error);
      captureRouteError(error, { route: ROUTE, method: "GET" });
      return NextResponse.json(
        { success: false, error: "Failed to fetch events" },
        { status: 500 },
      );
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      success: true,
      data: {
        events: events || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error in admin events API:", error);
    captureRouteError(error, { route: ROUTE, method: "GET" });
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/admin/events - Create new event (if needed for admin creation)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }
    // Use a regular client for profile lookup
    const profileClient = await createServerSupabase();
    const { data: profile, error: profileError } = await profileClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }
    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 },
      );
    }
    // Use correct client for DB operations
    const adminSupabase = await getSupabaseClientForRole(profile.role);

    const body = await request.json();
    const {
      name,
      description,
      start_time,
      end_time,
      location_name,
      address,
      latitude,
      longitude,
      category_id,
      organizer_id,
      max_capacity,
      is_featured,
      featured_rank,
      commission_rate,
      is_commission_based,
      status,
      require_guest_details,
    } = body;

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const { data: event, error: eventError } = await adminSupabase
      .from("events")
      .insert({
        name,
        slug,
        description,
        start_time,
        end_time,
        location_name: location_name || null,
        address: address || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        category_id: category_id || null,
        organizer_id: organizer_id || user.id,
        max_capacity,
        is_featured: is_featured || false,
        featured_rank: featured_rank || null,
        commission_rate: commission_rate || null,
        is_commission_based: is_commission_based || false,
        status: (status || "draft") as "draft" | "published" | "archived",
        require_guest_details: require_guest_details || false,
      })
      .select()
      .single();

    if (eventError) {
      console.error("Error creating event:", eventError);
      captureRouteError(eventError, { route: ROUTE, method: "POST" });
      return NextResponse.json(
        { success: false, error: "Failed to create event" },
        { status: 500 },
      );
    }

    // Log the admin action
    try {
      const { logEventCreation } = await import("@/lib/audit");
      await logEventCreation(
        user.id,
        event.id.toString(),
        event,
        request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        request.headers.get("user-agent") || undefined,
      );
    } catch (logError) {
      console.error("Failed to log event creation:", logError);
      // Don't fail the operation if logging fails
    }

    return NextResponse.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error("Error in admin events POST:", error);
    captureRouteError(error, { route: ROUTE, method: "POST" });
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
