import { NextRequest, NextResponse } from "next/server";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import { createServerSupabase } from "@/lib/supabase/server";
import type { RoleSwitchRequest, RoleSwitchResponse } from "@/types/auth.types";

const ROUTE = "/api/auth/switch-role";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
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

    // Call RPC function
    const { data, error } = await supabase.rpc("switch_active_role", {
      p_new_role: newRole,
      p_ip_address: ipAddress || undefined,
      p_user_agent: userAgent || undefined,
    });

    if (error) {
      console.error("Role switch error:", error);
      captureRouteError(error, { route: ROUTE, method: "POST" });
      return NextResponse.json(
        {
          success: false,
          message: error.message || "Failed to switch role",
        },
        { status: 500 },
      );
    }

    // Type guard: Ensure data is the expected shape
    if (
      !data ||
      typeof data !== "object" ||
      !("success" in data) ||
      typeof data.success !== "boolean"
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
