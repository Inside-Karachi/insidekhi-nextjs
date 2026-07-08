import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

interface SortOption {
  key: string;
  label: string;
  icon_name: string;
  is_default: boolean;
}

export async function GET() {
  try {
    const supabase = await createServerSupabase({ publicAnon: true });

    // Fetching sort options

    // Direct query to sort_options table with type assertion
    const query = supabase
      .from("sort_options" as "listings")
      .select("key, label, icon_name, is_default")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    const { data: rawData, error } = await query;
    const sortOptions = rawData as unknown as SortOption[];

    if (error) {
      console.error("Supabase error fetching sort options:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Loaded sort options

    return NextResponse.json({
      success: true,
      sortOptions: sortOptions || [],
      count: sortOptions?.length || 0,
    });
  } catch (error) {
    console.error("API error fetching sort options:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
