import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";
import disposableDomains from "disposable-email-domains";

/**
 * GET /api/admin/users/check-email
 * Check if an email is available and valid
 * Query params: email, excludeUserId (optional - for editing existing user)
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin role
    const { rows: profileRows } = await query(
      `SELECT role FROM public.profiles WHERE id = $1 LIMIT 1`,
      [session.userId]
    );
    const profile = profileRows[0];

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

    // Check if email exists in auth.users (excluding current user if editing)
    const { rows: existingRows } = await query(
      excludeUserId
        ? `SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1) AND id != $2 LIMIT 1`
        : `SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      excludeUserId ? [email, excludeUserId] : [email]
    );

    // Email is available if no existing user was found
    const available = existingRows.length === 0;

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
