import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerSupabase({ publicAnon: true });

    const { data: settings, error } = await supabase
      .from("site_settings_active")
      .select("key, value");

    if (error) {
      console.error("Supabase error fetching site settings:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Convert to key-value object
    const settingsObj =
      settings?.reduce((acc, setting) => {
        if (setting.key) {
          acc[setting.key] = setting.value || "";
        }
        return acc;
      }, {} as Record<string, string>) || {};

    return NextResponse.json({
      success: true,
      settings: settingsObj,
      count: settings?.length || 0,
    });
  } catch (error) {
    console.error("API error fetching site settings:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
