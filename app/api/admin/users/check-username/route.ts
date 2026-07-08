import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/admin/users/check-username
 * Check if a username is available (not taken by another user)
 * Query params: username, excludeUserId (optional - for editing existing user)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      !profile ||
      (profile.role !== "admin" && profile.role !== "super_admin")
    ) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const username = searchParams.get("username");
    const excludeUserId = searchParams.get("excludeUserId");

    // Validate username parameter
    if (!username || username.trim() === "") {
      return NextResponse.json(
        { available: true, message: "Username is required" },
        { status: 400 }
      );
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        {
          available: false,
          message:
            "Username must be 3-30 characters (letters, numbers, underscore only)",
        },
        { status: 200 }
      );
    }

    // Check if username exists
    let query = supabase.from("profiles").select("id").eq("username", username);

    // Exclude current user if editing
    if (excludeUserId) {
      query = query.neq("id", excludeUserId);
    }

    const { data: existingUser, error: queryError } = await query.maybeSingle();

    if (queryError) {
      console.error("Username check error:", queryError);
      return NextResponse.json(
        { error: "Failed to check username availability" },
        { status: 500 }
      );
    }

    // Username is available if no existing user was found
    const available = !existingUser;

    return NextResponse.json({
      available,
      message: available
        ? "Username is available"
        : "Username is already taken",
    });
  } catch (error) {
    console.error("Check username error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
