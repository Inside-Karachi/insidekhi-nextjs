import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_WINDOW = 3;

// In-memory rate limiting store (in production, use Redis or database)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    // First request or window expired
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    };
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  // Increment counter
  record.count++;
  rateLimitStore.set(identifier, record);

  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_WINDOW - record.count,
    resetTime: record.resetTime,
  };
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    // Validate email format
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check rate limiting
    const rateLimit = checkRateLimit(normalizedEmail);
    if (!rateLimit.allowed) {
      const resetDate = new Date(rateLimit.resetTime);
      return NextResponse.json(
        {
          error: "Too many requests",
          message: `You've reached the limit for resend requests. Try again after ${resetDate.toLocaleTimeString()}.`,
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(
              (rateLimit.resetTime - Date.now()) / 1000,
            ).toString(),
          },
        },
      );
    }

    // For security, we don't reveal whether the email exists or is already
    // verified - the response is identical either way to prevent email
    // enumeration attacks.
    try {
      const { rows } = await query(
        `SELECT id, email_confirmed_at FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [normalizedEmail],
      );
      const user = rows[0];

      if (user && !user.email_confirmed_at) {
        const confirmationToken = uuidv4();
        const now = new Date().toISOString();

        await query(
          `UPDATE auth.users SET confirmation_token = $1, confirmation_sent_at = $2 WHERE id = $3`,
          [confirmationToken, now, user.id],
        );

        const baseUrl = (
          process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
        ).replace(/\/+$/, "");
        console.log(
          `[VERIFICATION EMAIL LINK]: ${baseUrl}/api/auth/callback?token=${confirmationToken}`,
        );
      }
    } catch (dbError) {
      console.error("RESEND VERIFICATION: Failed to resend email:", dbError);

      return NextResponse.json(
        {
          error: "Failed to send email",
          message:
            "We couldn't send the verification email. Please try again later.",
        },
        { status: 500 },
      );
    }

    // Log successful resend attempt
    console.log("RESEND VERIFICATION: Email sent successfully", {
      email: normalizedEmail,
      remainingRequests: rateLimit.remaining,
    });

    return NextResponse.json(
      {
        message: "Verification email sent successfully",
        remainingRequests: rateLimit.remaining,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("RESEND VERIFICATION: Unexpected error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred. Please try again later.",
      },
      { status: 500 },
    );
  }
}
