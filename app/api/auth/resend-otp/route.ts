import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createAndSendSignupOtp } from "@/lib/auth/otp";

const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_WINDOW = 3;
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string): { allowed: boolean } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false };
  }
  record.count++;
  return { allowed: true };
}

// POST /api/auth/resend-otp - Resend the signup verification code.
// Enumeration-safe: identical response regardless of whether the address
// exists or is already confirmed.
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();

    if (!checkRateLimit(normalizedEmail).allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const { rows } = await query(
      "SELECT id, full_name FROM auth.users u JOIN public.profiles p ON p.id = u.id WHERE LOWER(u.email) = LOWER($1) AND u.email_confirmed_at IS NULL LIMIT 1",
      [normalizedEmail]
    );
    const user = rows[0];

    if (user) {
      await createAndSendSignupOtp({
        userId: user.id,
        email: normalizedEmail,
        fullName: user.full_name,
      });
    }

    return NextResponse.json({ sent: true });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
