import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/admin";

// GET /api/admin/security/blocked-ips - List blocked IPs
export async function GET(request: NextRequest) {
  try {
    // Verify super admin
    await requireSuperAdmin(request);

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active_only") === "true";

    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    let query = adminSupabase
      .from("blocked_ips")
      .select("*")
      .order("blocked_at", { ascending: false });

    if (activeOnly) {
      query = query.is("unblocked_at", null);
    }

    const { data: blocked_ips, error } = await query;

    if (error) {
      console.error("[BLOCKED IPS API] Error fetching:", error);
      return NextResponse.json(
        { error: "Failed to fetch blocked IPs" },
        { status: 500 }
      );
    }

    return NextResponse.json({ blocked_ips });
  } catch (error) {
    console.error("[BLOCKED IPS API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/admin/security/blocked-ips - Manually block an IP
export async function POST(request: NextRequest) {
  try {
    // Verify super admin
    const adminCheck = await requireSuperAdmin(request);

    const body = await request.json();
    const { ip_address, reason, severity, duration_minutes } = body;

    // Validate required fields
    if (!ip_address || !reason || !severity) {
      return NextResponse.json(
        { error: "ip_address, reason, and severity are required" },
        { status: 400 }
      );
    }

    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    const { data, error } = await adminSupabase.rpc("block_ip", {
      p_ip_address: ip_address,
      p_reason: reason,
      p_severity: severity,
      p_duration_minutes: duration_minutes ?? undefined,
      p_blocked_by: adminCheck.user.id,
    });

    if (error) {
      console.error("[BLOCKED IPS API] Error blocking IP:", error);
      return NextResponse.json(
        { error: "Failed to block IP" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error("[BLOCKED IPS API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
