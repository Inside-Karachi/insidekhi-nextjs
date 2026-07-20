import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/admin";

// GET /api/admin/security/summary - Get security metrics summary
export async function GET(request: NextRequest) {
  try {
    // Verify super admin
    await requireSuperAdmin(request);

    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get("hours") || "24");

    let rpcRows;
    try {
      ({ rows: rpcRows } = await query(
        `SELECT get_security_summary($1) AS result`,
        [hours]
      ));
    } catch (rpcError) {
      console.error("[SECURITY SUMMARY API] Error:", rpcError);
      return NextResponse.json(
        { error: "Failed to fetch security summary" },
        { status: 500 }
      );
    }

    const data = rpcRows[0]?.result;

    // RPC returns JSONB, format it as an array for the dashboard
    return NextResponse.json({
      summary: data ? [data] : [],
      period_hours: hours,
    });
  } catch (error) {
    console.error("[SECURITY SUMMARY API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
