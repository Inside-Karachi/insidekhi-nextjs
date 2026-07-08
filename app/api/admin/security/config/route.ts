import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin";

// GET /api/admin/security/config - Get system configuration
export async function GET(request: NextRequest) {
  try {
    // Verify admin (not just super admin for read access)
    await requireAdmin(request);

    const supabase = await createServerSupabase();

    const { data: configs, error } = await supabase
      .from("system_config")
      .select("*")
      .order("category", { ascending: true })
      .order("key", { ascending: true });

    if (error) {
      console.error("[SYSTEM CONFIG API] Error fetching:", error);
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
