import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import disposableDomains from "disposable-email-domains";

/**
 * GET /api/admin/users/check-email
 * Check if an email is available and valid
 * Query params: email, excludeUserId (optional - for editing existing user)
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
    const email = searchParams.get("email");
    const excludeUserId = searchParams.get("excludeUserId");

    // Validate email parameter
    if (!email || email.trim() === "") {
      return NextResponse.json(
        { available: true, valid: false, message: "Email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          available: false,
          valid: false,
          message: "Invalid email format",
        },
        { status: 200 }
      );
    }

    // Check for disposable email domain
    const emailDomain = email.split("@")[1].toLowerCase();
    if (disposableDomains.includes(emailDomain)) {
      return NextResponse.json(
        {
          available: false,
          valid: false,
          message: "Disposable email addresses are not allowed",
        },
        { status: 200 }
      );
    }

    // Use service role to check auth.users for email uniqueness
    const serviceSupabase = await createServerSupabase({
      useServiceRole: true,
    });

    // Check if email exists in auth.users
    const { data: authUsers, error: authError2 } =
      await serviceSupabase.auth.admin.listUsers();

    if (authError2) {
      console.error("Email check error:", authError2);
      return NextResponse.json(
        { error: "Failed to check email availability" },
        { status: 500 }
      );
    }

    // Filter to find matching email (excluding current user if editing)
    const existingUser = authUsers.users.find(
      (u) => u.email === email && (!excludeUserId || u.id !== excludeUserId)
    );

    // Email is available if no existing user was found
    const available = !existingUser;

    return NextResponse.json({
      available,
      valid: true,
      message: available ? "Email is available" : "Email is already registered",
    });
  } catch (error) {
    console.error("Check email error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
