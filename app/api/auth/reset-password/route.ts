import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

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

    // Send password reset email
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`,
    });

    if (error) {
      console.error("Password reset error:", error);

      // Don't reveal if email exists or not for security
      // Always return success to prevent email enumeration
      return NextResponse.json({
        success: true,
        message:
          "If an account with that email exists, we've sent password reset instructions.",
      });
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
      // Don't fail the operation if logging fails
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
