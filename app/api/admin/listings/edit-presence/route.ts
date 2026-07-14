import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { query } from "@/lib/db";

const STALE_SECONDS = 90;

function staleThresholdIso() {
  return new Date(Date.now() - STALE_SECONDS * 1000).toISOString();
}

/** Best-effort cleanup; called after writes only - not on every GET (reduces DB write load). */
async function cleanupStaleSessions() {
  await query(
    `DELETE FROM listing_edit_sessions WHERE last_heartbeat_at < $1`,
    [staleThresholdIso()],
  );
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    let data;
    try {
      const result = await query(
        `SELECT listing_id, user_id, full_name, last_heartbeat_at
         FROM listing_edit_sessions
         WHERE last_heartbeat_at >= $1
         ORDER BY last_heartbeat_at DESC`,
        [staleThresholdIso()],
      );
      data = result.rows;
    } catch (error) {
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: { sessions: data || [] } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message === "Authentication required" ||
      message === "Profile not found" ||
      message === "Admin access required"
        ? 401
        : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, profile } = await requireAdmin(request);
    const body = await request.json();
    const action = body?.action as string;
    const listingId = Number(body?.listingId);

    if (action !== "start" && action !== "heartbeat" && action !== "stop") {
      return NextResponse.json(
        { success: false, error: "action must be start, heartbeat, or stop" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(listingId) || !Number.isInteger(listingId) || listingId <= 0) {
      return NextResponse.json(
        { success: false, error: "listingId must be a positive integer" },
        { status: 400 },
      );
    }

    if (action === "stop") {
      try {
        await query(
          `DELETE FROM listing_edit_sessions WHERE listing_id = $1 AND user_id = $2`,
          [listingId, user.id],
        );
      } catch (error) {
        return NextResponse.json(
          { success: false, error: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 },
        );
      }
      void cleanupStaleSessions();
      return NextResponse.json({ success: true });
    }

    const fullName = profile.full_name || user.email || "Staff";
    const lastHeartbeatAt = new Date().toISOString();

    try {
      await query(
        `INSERT INTO listing_edit_sessions (listing_id, user_id, full_name, last_heartbeat_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (listing_id, user_id)
         DO UPDATE SET full_name = EXCLUDED.full_name, last_heartbeat_at = EXCLUDED.last_heartbeat_at`,
        [listingId, user.id, fullName, lastHeartbeatAt],
      );
    } catch (error) {
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 },
      );
    }

    void cleanupStaleSessions();

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message === "Authentication required" ||
      message === "Profile not found" ||
      message === "Admin access required"
        ? 401
        : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
