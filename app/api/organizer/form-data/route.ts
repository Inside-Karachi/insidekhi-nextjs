import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/organizer/form-data - Get categories for event forms
// Accessible by organizers, listers, and admins
export async function GET() {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    // Verify user has organizer role or higher
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }

    if (
      !["organizer", "lister", "admin", "super_admin"].includes(profile.role)
    ) {
      return NextResponse.json(
        { success: false, error: "Organizer access required" },
        { status: 403 },
      );
    }

    // Events are self-contained (native location), so forms only need
    // categories now - venue/listing pickers were removed.
    const result: {
      success: boolean;
      categories?: { id: number; name: string; slug: string }[];
    } = { success: true };

    const { data: categories, error: categoriesError } = await supabase
      .from("categories")
      .select("id, name, slug")
      .order("name", { ascending: true });

    if (categoriesError) {
      console.error("Error fetching categories:", categoriesError);
    } else {
      result.categories = categories || [];
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in organizer form-data GET:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
