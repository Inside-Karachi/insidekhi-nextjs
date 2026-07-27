import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { setSession } from "@/lib/auth/session";

// Matches the expiryHours passed to sendPasswordResetEmail in /api/auth/reset-password
const RECOVERY_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  if (!/(?=.*[a-z])/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }
  if (!/(?=.*[A-Z])/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/(?=.*\d)/.test(password)) {
    return "Password must contain at least one number";
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, password } = body || {};

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Reset code is required", field: "code" },
        { status: 400 },
      );
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json(
        { error: passwordError, field: "password" },
        { status: 400 },
      );
    }

    const { rows } = await query(
      `SELECT u.id, u.email, u.recovery_sent_at, p.role
       FROM auth.users u
       LEFT JOIN public.profiles p ON p.id = u.id
       WHERE u.recovery_token = $1 LIMIT 1`,
      [code],
    );
    const user = rows[0];

    if (!user) {
      return NextResponse.json(
        { error: "This reset link is invalid or has already been used." },
        { status: 400 },
      );
    }

    const sentAt = user.recovery_sent_at
      ? new Date(user.recovery_sent_at).getTime()
      : 0;
    if (!sentAt || Date.now() - sentAt > RECOVERY_TOKEN_EXPIRY_MS) {
      return NextResponse.json(
        { error: "This reset link has expired. Please request a new one." },
        { status: 400 },
      );
    }

    const encryptedPassword = await hashPassword(password);
    const now = new Date().toISOString();

    await query(
      `UPDATE auth.users
       SET encrypted_password = $1, recovery_token = NULL, recovery_sent_at = NULL, updated_at = $2
       WHERE id = $3`,
      [encryptedPassword, now, user.id],
    );

    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";

    try {
      const { logPasswordResetCompleted } = await import("@/lib/audit");
      await logPasswordResetCompleted(
        user.id,
        ip,
        request.headers.get("user-agent") || undefined,
      );
    } catch (logError) {
      console.error("Failed to log password reset completion:", logError);
    }

    const response = NextResponse.json({
      success: true,
      message: "Password updated successfully.",
    });
    await setSession(response, {
      userId: user.id,
      email: user.email,
      role: user.role || "public_user",
    });

    return response;
  } catch (error) {
    console.error("Update password error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 },
    );
  }
}
