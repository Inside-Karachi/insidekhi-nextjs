import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/admin";

interface RouteContext {
  params: Promise<{
    ip: string;
  }>;
}

// DELETE /api/admin/security/blocked-ips/[ip] - Unblock an IP
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    // Verify super admin
    const adminCheck = await requireSuperAdmin(request);

    const { ip } = await context.params;
    const decodedIP = decodeURIComponent(ip);

    try {
      await query(`SELECT unblock_ip($1, $2)`, [
        decodedIP,
        adminCheck.user.id,
      ]);
    } catch (rpcError) {
      console.error("[UNBLOCK IP API] Error:", rpcError);
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
