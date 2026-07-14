import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSuperAdmin, getAdminAuthErrorStatus } from "@/lib/auth/admin";

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireSuperAdmin(request);

    // Get threshold from request body
    const body = await request.json();
    const ageThresholdDays = body.age_threshold_days || 90;

    // Call cleanup RPC function
    let result: unknown;
    try {
      const { rows } = await query(
        `SELECT manual_cleanup_soft_deleted_replies(
           p_age_threshold_days => $1::integer,
           p_executed_by => $2::uuid
         ) AS result`,
        [ageThresholdDays, user.id],
      );
      result = rows[0]?.result;
    } catch (rpcError) {
      console.error("Cleanup RPC error:", rpcError);
      return NextResponse.json(
        {
          error:
            rpcError instanceof Error ? rpcError.message : "Cleanup failed",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    const authStatus = getAdminAuthErrorStatus(error);
    if (authStatus) {
      return NextResponse.json(
        { error: "Super admin access required" },
        { status: authStatus }
      );
    }
    console.error("Cleanup API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
