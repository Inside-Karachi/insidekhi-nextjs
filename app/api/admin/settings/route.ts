import { createServerSupabase } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { Json } from "@/types/supabase";

// GET /api/admin/settings - Get system settings
export async function GET() {
    const supabase = await createServerSupabase();
  try {    // Check authentication
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.userId)
      .single();

    if (!profile || profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Super admin access required" },
        { status: 403 },
      );
    }

    // Fetch all system settings
    const { data: settings, error: settingsError } = await supabase
      .from("system_config")
      .select("*")
      .order("config_key");

    if (settingsError) {
      console.error("[SETTINGS API] Error fetching settings:", settingsError);
      return NextResponse.json(
        { error: "Failed to fetch settings" },
        { status: 500 },
      );
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[SETTINGS API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH /api/admin/settings - Update a system setting
export async function PATCH(request: NextRequest) {
    const supabase = await createServerSupabase();
  try {    // Check authentication
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.userId)
      .single();

    if (!profile || profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Super admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { config_key, config_value } = body;

    if (!config_key || config_value === undefined) {
      return NextResponse.json(
        { error: "config_key and config_value are required" },
        { status: 400 },
      );
    }

    // config_type CHECK constraint only allows: 'feature_flag' | 'threshold' | 'setting'
    // Caller can pass an explicit config_type; default to 'setting' for all ad-hoc keys.
    const validConfigTypes = ["feature_flag", "threshold", "setting"] as const;
    type ValidConfigType = (typeof validConfigTypes)[number];
    const rawType: string =
      typeof body.config_type === "string" ? body.config_type : "setting";
    const resolvedConfigType: ValidConfigType = (
      validConfigTypes as readonly string[]
    ).includes(rawType)
      ? (rawType as ValidConfigType)
      : "setting";

    // Upsert - insert if key doesn't exist, update if it does.
    // updated_by references auth.users so we pass the current super_admin's id.
    const upsertData = {
      config_key,
      config_value: config_value as Json,
      config_type: resolvedConfigType,
      updated_by: session.userId,
    };

    const { data, error } = await supabase
      .from("system_config")
      .upsert(upsertData, { onConflict: "config_key" })
      .select()
      .single();

    if (error) {
      console.error("Error updating system setting:", error);
      return NextResponse.json(
        { error: "Failed to update setting" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, setting: data });
  } catch (error) {
    console.error("[SETTINGS API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
