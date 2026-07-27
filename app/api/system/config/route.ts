import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    // Fetch public system settings
    const { rows: settings } = await query(
      `SELECT config_key, config_value, config_type
       FROM system_config
       WHERE is_public = true`,
    );

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
