import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerSupabase();

    // Fetching banks

    const { data: banks, error } = await supabase
      .from("banks")
      .select("id, name, logo_url, code")
      .order("name", { ascending: true });

    if (error) {
      console.error("Supabase error fetching banks:", error);
      return NextResponse.json(
        { error: "Failed to fetch banks", details: error.message },
        { status: 500 }
      );
    }

    // banks loaded

    // Transform the data to match dropdown format
    // Always use numeric id as value for consistent parseInt handling
    const bankOptions =
      banks?.map((bank) => ({
        value: String(bank.id),
        label: bank.name,
        code: bank.code,
        logoUrl: bank.logo_url,
      })) || [];

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
      { status: 500 }
    );
  }
}
