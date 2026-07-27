import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { setSession } from "@/lib/auth/session";

const RECOVERY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours, matches expiryHours passed to sendPasswordResetEmail

function validatePassword(password: string): string | null {
  if (password.length < 8) {
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

// POST /api/auth/reset-password/confirm - Verify a recovery code and set a new password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, password } = body || {};

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Reset code is required" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const { rows } = await query(
      `SELECT id, email, recovery_sent_at
       FROM auth.users
       WHERE recovery_token = $1
       LIMIT 1`,
      [code]
    );
    const authUser = rows[0];

    if (!authUser) {
      return NextResponse.json(
        { error: "Invalid or expired reset link. Please request a new password reset." },
        { status: 400 }
      );
    }

    const sentAt = authUser.recovery_sent_at
      ? new Date(authUser.recovery_sent_at).getTime()
      : 0;
    if (!sentAt || Date.now() - sentAt > RECOVERY_TOKEN_TTL_MS) {
      return NextResponse.json(
        { error: "Invalid or expired reset link. Please request a new password reset." },
        { status: 400 }
      );
    }

    const encryptedPassword = await hashPassword(password);

    await query(
      `UPDATE auth.users
       SET encrypted_password = $1, recovery_token = NULL, recovery_sent_at = NULL, updated_at = NOW()
       WHERE id = $2`,
      [encryptedPassword, authUser.id]
    );

    const { rows: profileRows } = await query(
      `SELECT role FROM public.profiles WHERE id = $1 LIMIT 1`,
      [authUser.id]
    );
    const role = profileRows[0]?.role || "public_user";

    try {
      const { logPasswordResetCompleted } = await import("@/lib/audit");
      await logPasswordResetCompleted(
        authUser.id,
        request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        request.headers.get("user-agent") || undefined
      );
    } catch (logError) {
      console.error("Failed to log password reset completion:", logError);
    }

    const response = NextResponse.json({ success: true });
    await setSession(response, {
      userId: authUser.id,
      email: authUser.email,
      role,
    });

    return response;
  } catch (error) {
    console.error("Password reset confirm error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
