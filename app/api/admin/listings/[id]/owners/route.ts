import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabase,
  getSupabaseClientForRole,
} from "@/lib/supabase/server";

// GET: List eligible business owners for a listing (minimal info)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Get user profile
    const profileClient = await createServerSupabase();
    const { data: profile, error: profileError } = await profileClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }
    // Only allow lister, admin, super_admin
    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    const listingId = parseInt(params.id);
    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing id" },
        { status: 400 }
      );
    }
    const dbClient = await getSupabaseClientForRole(profile.role);
    // Search users by query param (for autocomplete)
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    let userQuery = dbClient
      .from("profiles")
      .select("id, full_name, username, avatar_url, role")
      .neq("role", "super_admin")
      .limit(10);
    if (q) {
      userQuery = userQuery.or(`full_name.ilike.%${q}%,username.ilike.%${q}%`);
    }
    const { data: users, error: usersError } = await userQuery;
    if (usersError) {
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, users });
  } catch (err) {
    console.error("[API][GET] Exception:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH: Assign business owner(s) to a listing
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Get user profile
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
    const listingId = parseInt(params.id);
    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing id" },
        { status: 400 }
      );
    }
    const dbClient = await getSupabaseClientForRole(profile.role);
    // If lister, check ownership
    if (profile.role === "lister") {
      const { data: listing, error: listingError } = await dbClient
        .from("listings")
        .select("id, owner_id")
        .eq("id", listingId)
        .single();
      if (listingError || !listing || listing.owner_id !== user.id) {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      }
    }
    // Parse new owner(s) from body
    const { owner_id } = await request.json();
    if (!owner_id) {
      return NextResponse.json(
        { error: "owner_id is required" },
        { status: 400 }
      );
    }
    // Update listing owner
    const { error: updateError } = await dbClient
      .from("listings")
      .update({ owner_id })
      .eq("id", listingId);
    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update owner" },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
