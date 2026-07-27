import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";

// GET /api/admin/security/config - Get system configuration
export async function GET(request: NextRequest) {
  try {
    // Verify admin (not just super admin for read access)
    await requireAdmin(request);

    let configs;
    try {
      const { rows } = await query(
        `SELECT * FROM public.system_config
         ORDER BY config_type ASC, config_key ASC`
      );
      configs = rows;
    } catch (dbError) {
      console.error("[SYSTEM CONFIG API] Error fetching:", dbError);
      return NextResponse.json(
        { error: "Failed to fetch system configuration" },
        { status: 500 }
      );
    }

    return NextResponse.json({ configs });
  } catch (error) {
    console.error("[SYSTEM CONFIG API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
