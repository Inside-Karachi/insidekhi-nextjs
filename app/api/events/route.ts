import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// Ensure this API route always returns fresh data
export const dynamic = "force-dynamic";

const EVENT_CARD_COLUMNS =
  "event_id, event_name, event_slug, event_description, start_time, end_time, " +
  "event_status, created_at, updated_at, category_id, max_capacity, is_featured, " +
  "featured_rank, is_commission_based, commission_rate, require_guest_details, " +
  "organizer_id, organizer_name, organizer_avatar, location_name, address, " +
  "latitude, longitude";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "12") || 12));
    const search = searchParams.get("search");
    const location = searchParams.get("location");
    const date = searchParams.get("date");
    const status = searchParams.get("status") || "published";
    const featured = searchParams.get("featured") === "true";

    // Show events that haven't ended yet (ongoing + upcoming)
    const whereClauses: string[] = [];
    const params: unknown[] = [];

    params.push(status);
    whereClauses.push(`event_status = $${params.length}`);

    params.push(new Date().toISOString());
    whereClauses.push(`end_time >= $${params.length}`);

    if (featured) {
      whereClauses.push(`is_featured = true`);
    }

    if (search) {
      params.push(`%${search}%`);
      whereClauses.push(`event_name ILIKE $${params.length}`);
    }

    if (location) {
      params.push(`%${location}%`);
      whereClauses.push(`address ILIKE $${params.length}`);
    }

    if (date) {
      const filterDate = new Date(date);
      if (!isNaN(filterDate.getTime())) {
        const nextDay = new Date(filterDate.getTime() + 24 * 60 * 60 * 1000);
        params.push(filterDate.toISOString());
        whereClauses.push(`start_time >= $${params.length}`);
        params.push(nextDay.toISOString());
        whereClauses.push(`start_time < $${params.length}`);
      }
    }

    const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

    let events, count;
    try {
      const { rows: countRows } = await query(
        `SELECT COUNT(*) FROM events_with_details ${whereSql}`,
        params
      );
      count = parseInt(countRows[0].count, 10);

      const offset = (page - 1) * limit;
      const dataParams = [...params, limit, offset];
      // event_id is a unique tie-breaker already, so it fully determines order
      // ahead of featured_rank - matches the original query's effective output.
      const { rows } = await query(
        `SELECT ${EVENT_CARD_COLUMNS} FROM events_with_details
         ${whereSql}
         ORDER BY start_time ASC, event_id ASC
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      );

      events = rows.map((row) => ({
        ...row,
        event_id: Number(row.event_id),
        category_id: row.category_id !== null ? Number(row.category_id) : null,
      }));
    } catch (error) {
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
