import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabase,
  getSupabaseClientForRole,
} from "@/lib/supabase/server";

// GET: List eligible event organizers (minimal info)
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
    const eventId = parseInt(params.id);
    if (isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
    }
    const dbClient = await getSupabaseClientForRole(profile.role);
    // Search users by query param (for autocomplete)
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const ownerId = searchParams.get("organizerId")?.trim();

    let userQuery = dbClient
      .from("profiles")
      .select("id, full_name, username, avatar_url, role")
      .neq("role", "super_admin")
      .limit(10);

    if (q) {
      userQuery = userQuery.or(`full_name.ilike.%${q}%,username.ilike.%${q}%`);
    }

    if (ownerId) {
      userQuery = userQuery.eq("id", ownerId);
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

// PATCH: Assign organizer to an event
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
    const eventId = parseInt(params.id);
    if (isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
    }
    const dbClient = await getSupabaseClientForRole(profile.role);
    // If lister, check ownership
    if (profile.role === "lister") {
      const { data: event, error: eventError } = await dbClient
        .from("events")
        .select("id, organizer_id")
        .eq("id", eventId)
        .single();
      if (eventError || !event || event.organizer_id !== user.id) {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      }
    }
    // Parse new organizer from body
    const { organizer_id } = await request.json();
    if (!organizer_id) {
      return NextResponse.json(
        { error: "organizer_id is required" },
        { status: 400 }
      );
    }
    // Update event organizer
    const { error: updateError } = await dbClient
      .from("events")
      .update({ organizer_id })
      .eq("id", eventId);
    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update organizer" },
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
