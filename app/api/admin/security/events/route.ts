import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
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
    let events: Array<Record<string, unknown>>;
    try {
      const { rows } = await query(
        `SELECT * FROM get_security_events_with_details($1, $2, $3, $4)`,
        [
          limit,
          offset,
          severity ?? null,
          resolved === "true" ? true : resolved === "false" ? false : null,
        ]
      );
      events = rows;
    } catch (rpcError) {
      console.error("[SECURITY API] Error fetching events:", rpcError);
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

    let event;
    try {
      const { rows } = await query(
        `INSERT INTO public.security_events
           (event_type, severity, user_id, ip_address, user_agent, details, resolved)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          event_type,
          severity,
          adminCheck.user.id,
          ip_address ?? null,
          user_agent ?? null,
          details || {},
          false,
        ]
      );
      event = rows[0];
    } catch (insertError) {
      console.error("[SECURITY API] Error creating event:", insertError);
      return NextResponse.json(
        { error: "Failed to create security event" },
        { status: 500 }
      );
    }

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error("[SECURITY API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
