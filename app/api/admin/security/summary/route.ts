import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/admin";

// GET /api/admin/security/summary - Get security metrics summary
export async function GET(request: NextRequest) {
  try {
    // Verify super admin
    await requireSuperAdmin(request);

    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get("hours") || "24");

    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    const { data, error } = await adminSupabase.rpc("get_security_summary", {
      p_hours: hours,
    });

    if (error) {
      console.error("[SECURITY SUMMARY API] Error:", error);
      return NextResponse.json(
        { error: "Failed to fetch security summary" },
        { status: 500 }
      );
    }

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
