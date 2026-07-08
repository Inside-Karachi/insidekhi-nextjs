import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerSupabase();

    // Fetch public system settings
    const { data: settings, error } = await supabase
      .from("system_config")
      .select("config_key, config_value, config_type")
      .eq("is_public", true);

    if (error) {
      console.error("[SYSTEM CONFIG] Error fetching settings:", error);
      return NextResponse.json(
        { error: "Failed to fetch configuration" },
        { status: 500 }
      );
    }

    // Transform array to object for easier consumption
    const config = settings.reduce((acc, curr) => {
      const value = curr.config_value;
      // Parse if it's a stringified JSON but typed as something else, or just return as is
      // The client can handle type coercion based on known keys
      acc[curr.config_key] = value;
      return acc;
    }, {} as Record<string, unknown>);

    return NextResponse.json({ config });
  } catch (error) {
    console.error("[SYSTEM CONFIG] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
