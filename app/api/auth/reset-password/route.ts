import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body || {};

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        {
          error: "Email address is required",
          field: "email",
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          error: "Please enter a valid email address",
          field: "email",
        },
        { status: 400 }
      );
    }

    // Verify email exists in DB
    const { rows: users } = await query(
      "SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [email]
    );

    if (users.length > 0) {
      const user = users[0];
      const recoveryToken = uuidv4();
      const now = new Date();
      const tokenSentAt = now.toISOString();

      // Store recovery token inside auth.users table
      await query(
        `UPDATE auth.users
         SET recovery_token = $1, recovery_sent_at = $2
         WHERE id = $3`,
        [recoveryToken, tokenSentAt, user.id]
      );

      // TODO: send this link via email once email delivery is wired up.
      console.log(`[PASSWORD RESET LINK]: ${process.env.NEXT_PUBLIC_SITE_URL}/reset-password?code=${recoveryToken}`);
    }

    // Log successful password reset request
    try {
      const { logPasswordResetRequest } = await import("@/lib/audit");
      await logPasswordResetRequest(
        email,
        request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        request.headers.get("user-agent") || undefined
      );
    } catch (logError) {
      console.error("Failed to log password reset request:", logError);
    }

    return NextResponse.json({
      success: true,
      message:
        "Password reset instructions have been sent to your email address.",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred. Please try again.",
        field: "server",
      },
      { status: 500 }
    );
  }
}
