import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const { rows: settings } = await query(
      `SELECT key, value FROM site_settings_active`,
    );

    const settingsObj = settings.reduce<Record<string, string>>((acc, setting) => {
      if (setting.key) {
        acc[String(setting.key)] = String(setting.value ?? "");
      }
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      settings: settingsObj,
      count: settings.length,
    });
  } catch (error) {
    console.error("API error fetching site settings:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
