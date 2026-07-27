import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/admin";

// GET /api/admin/security/blocked-ips - List blocked IPs
export async function GET(request: NextRequest) {
  try {
    // Verify super admin
    await requireSuperAdmin(request);

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active_only") === "true";

    const { rows: blocked_ips } = await query(
      `SELECT * FROM public.blocked_ips
       ${activeOnly ? "WHERE unblocked_at IS NULL" : ""}
       ORDER BY blocked_at DESC`
    );

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

    let rpcRows;
    try {
      ({ rows: rpcRows } = await query(
        `SELECT block_ip($1, $2, $3, $4, $5) AS result`,
        [
          ip_address,
          reason,
          severity,
          duration_minutes ?? null,
          adminCheck.user.id,
        ]
      ));
    } catch (rpcError) {
      console.error("[BLOCKED IPS API] Error blocking IP:", rpcError);
      return NextResponse.json(
        { error: "Failed to block IP" },
        { status: 500 }
      );
    }

    const data = rpcRows[0]?.result;

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error("[BLOCKED IPS API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
