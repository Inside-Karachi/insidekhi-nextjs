import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const { rows: sortOptions } = await query(
      `SELECT key, label, icon_name, is_default
       FROM sort_options
       WHERE is_active = true
       ORDER BY display_order ASC`,
    );

    return NextResponse.json({
      success: true,
      sortOptions,
      count: sortOptions.length,
    });
  } catch (error) {
    console.error("API error fetching sort options:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
