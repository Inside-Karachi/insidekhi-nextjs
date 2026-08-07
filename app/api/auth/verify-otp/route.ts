import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { setSession } from "@/lib/auth/session";
import { verifySignupOtp } from "@/lib/auth/otp";
import type { VerifySignupOtpResponse } from "@/types/auth.types";

const OTP_ERROR_MESSAGES: Record<string, string> = {
  not_found: "No verification code found. Please request a new one.",
  expired: "This code has expired. Please request a new one.",
  too_many_attempts:
    "Too many incorrect attempts. Please request a new code.",
  incorrect: "Incorrect code. Please try again.",
};

// POST /api/auth/verify-otp - Confirm a signup OTP and start the session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = body || {};

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const { rows } = await query(
      "SELECT id, email, email_confirmed_at FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [email]
    );
    const user = rows[0];

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired code. Please request a new one." },
        { status: 400 }
      );
    }

    if (user.email_confirmed_at) {
      return NextResponse.json(
        { error: "This account is already verified. Please log in." },
        { status: 400 }
      );
    }

    const result = await verifySignupOtp(user.id, code.trim());
    if (!result.ok) {
      return NextResponse.json(
        { error: OTP_ERROR_MESSAGES[result.reason] },
        { status: 400 }
      );
    }

    await query(
      "UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = $1",
      [user.id]
    );

    const { rows: profileRows } = await query(
      "SELECT role FROM public.profiles WHERE id = $1 LIMIT 1",
      [user.id]
    );
    const role = profileRows[0]?.role || "public_user";

    const responseBody: VerifySignupOtpResponse = {
      message: "Email verified successfully.",
      redirectTo: "/dashboard",
    };

    const response = NextResponse.json(responseBody);
    await setSession(response, {
      userId: user.id,
      email: user.email,
      role,
    });

    return response;
  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
