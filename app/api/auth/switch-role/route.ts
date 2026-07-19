import { NextRequest, NextResponse } from "next/server";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import type { RoleSwitchRequest, RoleSwitchResponse } from "@/types/auth.types";

const ROUTE = "/api/auth/switch-role";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Not authenticated" },
        { status: 401 },
      );
    }

    const body: RoleSwitchRequest = await request.json();
    const { newRole, ipAddress, userAgent } = body;

    if (!newRole) {
      return NextResponse.json(
        { success: false, message: "newRole is required" },
        { status: 400 },
      );
    }

    // Call the p_user_id-explicit overload of switch_active_role - the
    // original signature reads auth.uid(), which only resolves inside
    // Supabase's PostgREST session context, not a direct pg connection.
    let data: unknown;
    try {
      const { rows } = await query(
        `SELECT switch_active_role(
           p_user_id => $1,
           p_new_role => $2,
           p_ip_address => $3,
           p_user_agent => $4
         ) AS result`,
        [session.userId, newRole, ipAddress || null, userAgent || null],
      );
      data = rows[0]?.result;
    } catch (rpcError) {
      console.error("Role switch error:", rpcError);
      captureRouteError(rpcError, { route: ROUTE, method: "POST" });
      return NextResponse.json(
        {
          success: false,
          message:
            rpcError instanceof Error
              ? rpcError.message
              : "Failed to switch role",
        },
        { status: 500 },
      );
    }

    // Type guard: Ensure data is the expected shape
    if (
      !data ||
      typeof data !== "object" ||
      !("success" in data) ||
      typeof (data as { success: unknown }).success !== "boolean"
    ) {
      captureRouteError(new Error("Invalid response from switch_active_role RPC"), {
        route: ROUTE,
        method: "POST",
      });
      return NextResponse.json(
        { success: false, message: "Invalid response from database" },
        { status: 500 },
      );
    }

    // Now TypeScript knows data has success property
    return NextResponse.json(data as unknown as RoleSwitchResponse);
  } catch (error) {
    console.error("Role switch API error:", error);
    captureRouteError(error, { route: ROUTE, method: "POST" });
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
