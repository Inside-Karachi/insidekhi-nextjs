import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabase,
  getSupabaseClientForRole,
} from "@/lib/supabase/server";

/**
 * GET ALL LISTING IDS (for bulk selection across pages)
 *
 * Returns only IDs of listings matching current filters
 * Used for "Select All" functionality across pagination
 *
 * @route GET /api/admin/listings/ids
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user role
    const profileClient = await createServerSupabase();
    const { data: profile, error: profileError } = await profileClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const adminSupabase = await getSupabaseClientForRole(profile.role);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const categoryId = searchParams.get("category_id") || "";

    // Build query to get only IDs
    let query = adminSupabase.from("listings").select("id", { count: "exact" });

    // Apply same filters as main listing endpoint
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (status && status !== "all") {
      query = query.eq(
        "status",
        status as
          | "draft"
          | "published"
          | "archived"
          | "pending_approval"
          | "rejected",
      );
    }

    if (categoryId && categoryId !== "all") {
      const categoryIdNum = parseInt(categoryId);
      if (!isNaN(categoryIdNum)) {
        query = query.eq("category_id", categoryIdNum);
      }
    }

    const { data: listings, error, count } = await query;

    if (error) {
      console.error("Error fetching listing IDs:", error);
      return NextResponse.json(
        { error: "Failed to fetch listing IDs" },
        { status: 500 },
      );
    }

    const ids = (listings || []).map((l) => l.id);

    return NextResponse.json({
      success: true,
      data: {
        ids,
        count: count || 0,
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
