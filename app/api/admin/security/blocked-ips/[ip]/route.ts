import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/admin";

interface RouteContext {
  params: Promise<{
    ip: string;
  }>;
}

// DELETE /api/admin/security/blocked-ips/[ip] - Unblock an IP
export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromCookies();
  try {
    // Verify super admin
    const adminCheck = await requireSuperAdmin(request);

    const { ip } = await context.params;
    const decodedIP = decodeURIComponent(ip);

    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    const { error } = await adminSupabase.rpc("unblock_ip", {
      p_ip_address: decodedIP,
      p_unblocked_by: adminCheck.user.id,
    });

    if (error) {
      console.error("[UNBLOCK IP API] Error:", error);
      return NextResponse.json(
        { error: "Failed to unblock IP" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, ip: decodedIP });
  } catch (error) {
    console.error("[UNBLOCK IP API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
