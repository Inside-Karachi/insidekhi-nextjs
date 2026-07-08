import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service role for admin operations
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Verify super admin role
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "super_admin") {
      return NextResponse.json(
        { error: "Super admin access required" },
        { status: 403 }
      );
    }

    // Get threshold from request body
    const body = await request.json();
    const ageThresholdDays = body.age_threshold_days || 90;

    // Call cleanup RPC function
    const { data: result, error: rpcError } = await adminSupabase.rpc(
      "manual_cleanup_soft_deleted_replies" as unknown as never,
      {
        p_age_threshold_days: ageThresholdDays,
        p_executed_by: user.id,
      } as never
    );

    if (rpcError) {
      console.error("Cleanup RPC error:", rpcError);
      return NextResponse.json(
        { error: rpcError.message || "Cleanup failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("Cleanup API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
