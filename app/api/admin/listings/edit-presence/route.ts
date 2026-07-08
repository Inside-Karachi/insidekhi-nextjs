import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createServerSupabase } from "@/lib/supabase/server";

const STALE_SECONDS = 90;

function staleThresholdIso() {
  return new Date(Date.now() - STALE_SECONDS * 1000).toISOString();
}

/** Best-effort cleanup; called after writes only - not on every GET (reduces DB write load). */
async function cleanupStaleSessions() {
  const supabase = await createServerSupabase({ useServiceRole: true });
  await supabase
    .from("listing_edit_sessions")
    .delete()
    .lt("last_heartbeat_at", staleThresholdIso());
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const supabase = await createServerSupabase({ useServiceRole: true });
    const { data, error } = await supabase
      .from("listing_edit_sessions")
      .select("listing_id,user_id,full_name,last_heartbeat_at")
      .gte("last_heartbeat_at", staleThresholdIso())
      .order("last_heartbeat_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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

    const supabase = await createServerSupabase({ useServiceRole: true });

    if (action === "stop") {
      const { error } = await supabase
        .from("listing_edit_sessions")
        .delete()
        .eq("listing_id", listingId)
        .eq("user_id", user.id);
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      void cleanupStaleSessions();
      return NextResponse.json({ success: true });
    }

    const payload = {
      listing_id: listingId,
      user_id: user.id,
      full_name: profile.full_name || user.email || "Staff",
      last_heartbeat_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("listing_edit_sessions")
      .upsert(payload, { onConflict: "listing_id,user_id" });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
