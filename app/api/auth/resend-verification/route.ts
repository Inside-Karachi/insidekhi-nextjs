import { createServerSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getAuthCallbackUrl } from "@/lib/auth/url";

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

    const supabase = await createServerSupabase();

    // For security, we can't directly check if a user exists without admin privileges
    // Instead, we'll attempt to resend and handle the response appropriately
    // This prevents email enumeration attacks

    // Attempt to resend verification email
    // Note: Supabase doesn't provide a direct way to check if email exists without admin access
    // We'll use the resend method and handle the response
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: {
        emailRedirectTo: getAuthCallbackUrl(request.url),
      },
    });

    if (resendError) {
      // Check if the error indicates the email doesn't exist or is already verified
      if (
        resendError.message?.includes("User not found") ||
        resendError.message?.includes("Email not confirmed") ||
        resendError.message?.includes("already")
      ) {
        // Don't reveal specific error for security
        return NextResponse.json(
          {
            message:
              "If an account with this email exists and is not verified, a new verification email has been sent.",
          },
          { status: 200 },
        );
      }

      console.error("RESEND VERIFICATION: Failed to resend email:", {
        error: resendError.message,
        email: normalizedEmail,
      });

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
