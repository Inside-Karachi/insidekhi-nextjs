import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";
import { verifyPassword, hashPassword } from "@/lib/auth/password";

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json(
        {
          error: "Authentication required",
          field: "auth",
        },
        { status: 401 }
      );
    }

    // Fetch user's email and current hashed password from auth.users
    const { rows } = await query(
      "SELECT email, encrypted_password FROM auth.users WHERE id = $1 LIMIT 1",
      [session.userId]
    );
    const authUser = rows[0] as { email: string; encrypted_password: string } | undefined;

    if (!authUser) {
      return NextResponse.json(
        { error: "User not found", field: "auth" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body || {};

    // Validate required fields
    if (!currentPassword) {
      return NextResponse.json(
        {
          error: "Current password is required",
          field: "currentPassword",
        },
        { status: 400 }
      );
    }

    if (!newPassword) {
      return NextResponse.json(
        {
          error: "New password is required",
          field: "newPassword",
        },
        { status: 400 }
      );
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return NextResponse.json(
        {
          error: "Password must be at least 8 characters long",
          field: "newPassword",
        },
        { status: 400 }
      );
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return NextResponse.json(
        {
          error: "Password must contain uppercase, lowercase, and numbers",
          field: "newPassword",
        },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        {
          error: "New password must be different from current password",
          field: "newPassword",
        },
        { status: 400 }
      );
    }

    // Verify current password against our stored bcrypt hash
    const isCorrect = await verifyPassword(currentPassword, authUser.encrypted_password);
    if (!isCorrect) {
      return NextResponse.json(
        {
          error: "Current password is incorrect",
          field: "currentPassword",
        },
        { status: 400 }
      );
    }

    // Hash the new password and update auth.users directly
    const newHash = await hashPassword(newPassword);
    await query(
      "UPDATE auth.users SET encrypted_password = $1, updated_at = NOW() WHERE id = $2",
      [newHash, session.userId]
    );

    // Log the password change
    try {
      const { logPasswordChange } = await import("@/lib/audit");
      await logPasswordChange(
        session.userId,
        request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown"
      );
    } catch (logError) {
      console.error("Failed to log password change:", logError);
      // Don't fail the operation if logging fails
    }

    return NextResponse.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred. Please try again.",
        field: "server",
      },
      { status: 500 }
    );
  }
}
