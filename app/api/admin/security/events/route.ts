import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/admin";
import { withRateLimit, RateLimitPresets } from "@/lib/middleware/rate-limit";

// GET /api/admin/security/events - List security events
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimit = await withRateLimit(request, {
      ...RateLimitPresets.ADMIN_API,
      endpoint: "/api/admin/security/events",
    });

    if (!rateLimit.allowed) {
      return rateLimit.response!;
    }

    // Verify super admin
    await requireSuperAdmin(request);

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const severity = searchParams.get("severity");
    const resolved = searchParams.get("resolved");
    const eventType = searchParams.get("event_type");

    // Use the secure function to get events with user details
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    const { data: events, error } = await adminSupabase.rpc(
      "get_security_events_with_details",
      {
        p_limit: limit,
        p_offset: offset,
        p_severity: severity ?? undefined,
        p_resolved:
          resolved === "true" ? true : resolved === "false" ? false : undefined,
      }
    );

    if (error) {
      console.error("[SECURITY API] Error fetching events:", error);
      return NextResponse.json(
        { error: "Failed to fetch security events" },
        { status: 500 }
      );
    }

    // If event_type filter is provided, filter in-memory
    // (Not in RPC to keep function simple)
    let filteredEvents = events || [];
    if (eventType) {
      filteredEvents = filteredEvents.filter((e) => e.event_type === eventType);
    }

    return NextResponse.json({
      events: filteredEvents,
      total: filteredEvents.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[SECURITY API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/admin/security/events - Create manual security event
export async function POST(request: NextRequest) {
  try {
    // Verify super admin
    const adminCheck = await requireSuperAdmin(request);

    const body = await request.json();
    const { event_type, severity, details, ip_address, user_agent } = body;

    // Validate required fields
    if (!event_type || !severity) {
      return NextResponse.json(
        { error: "event_type and severity are required" },
        { status: 400 }
      );
    }

    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    const { data, error } = await adminSupabase
      .from("security_events")
      .insert({
        event_type,
        severity,
        user_id: adminCheck.user.id,
        ip_address: ip_address ?? undefined,
        user_agent: user_agent ?? undefined,
        details: details || {},
        resolved: false,
      })
      .select()
      .single();

    if (error) {
      console.error("[SECURITY API] Error creating event:", error);
      return NextResponse.json(
        { error: "Failed to create security event" },
        { status: 500 }
      );
    }

    return NextResponse.json({ event: data }, { status: 201 });
  } catch (error) {
    console.error("[SECURITY API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
