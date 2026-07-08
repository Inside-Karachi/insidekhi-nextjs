import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const { rows: banks } = await query(
      `SELECT id, name, logo_url, code
       FROM banks
       ORDER BY name ASC`,
    );

    const bankOptions = banks.map((bank) => ({
      value: String(bank.id),
      label: bank.name as string,
      code: bank.code as string | null,
      logoUrl: bank.logo_url as string | null,
    }));

    return NextResponse.json({
      success: true,
      banks: bankOptions,
      count: bankOptions.length,
    });
  } catch (error) {
    console.error("API error fetching banks:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
