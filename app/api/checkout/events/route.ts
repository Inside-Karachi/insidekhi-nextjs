import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// Public, read-only lookup of a small set of event fields (used by the
// checkout page to know whether guest details are required for the events
// in the current cart). No login required - mirrors the old client-side
// Supabase `.from("events").select("id, require_guest_details").in("id", ids)`
// call, which had no ownership scoping either.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");
    if (!idsParam) {
      return NextResponse.json({ events: [] });
    }

    const ids = idsParam
      .split(",")
      .map((id) => parseInt(id, 10))
      .filter((id) => !Number.isNaN(id));

    if (ids.length === 0) {
      return NextResponse.json({ events: [] });
    }

    const { rows } = await query(
      `SELECT id, require_guest_details FROM events WHERE id = ANY($1)`,
      [ids],
    );

    const events = rows.map((row) => ({
      id: Number(row.id),
      require_guest_details: row.require_guest_details,
    }));

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Checkout events API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
