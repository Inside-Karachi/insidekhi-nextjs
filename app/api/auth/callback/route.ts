import { createServerSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const errorParam = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  // Handle error cases from Supabase
  if (errorParam) {
    console.error("AUTH CALLBACK: OAuth error:", {
      error: errorParam,
      description: errorDescription,
    });

    // Redirect to verification page with error
    const errorUrl = new URL("/verify-email", requestUrl.origin);
    errorUrl.searchParams.set("error", errorDescription || errorParam);
    return NextResponse.redirect(errorUrl);
  }

  if (code) {
    const supabase = await createServerSupabase();

    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("AUTH CALLBACK: Session exchange failed:", {
          error: error.message,
          code: error.status,
        });

        // Check if this is a verification-related error
        const isVerificationError =
          error.message?.toLowerCase().includes("confirmation") ||
          error.message?.toLowerCase().includes("verify") ||
          error.message?.toLowerCase().includes("email");

        if (isVerificationError) {
          const errorUrl = new URL("/verify-email", requestUrl.origin);
          errorUrl.searchParams.set(
            "error",
            "Email verification failed. The link may be expired or invalid.",
          );
          return NextResponse.redirect(errorUrl);
        }

        // For other errors, redirect to login with error
        const loginUrl = new URL("/login", requestUrl.origin);
        loginUrl.searchParams.set(
          "error",
          "Authentication failed. Please try again.",
        );
        return NextResponse.redirect(loginUrl);
      }

      if (data?.session) {
        // Session exchange successful
        console.log("AUTH CALLBACK: Session created successfully");

        // Check if this was an email verification flow
        // We can detect this by checking if the user was just confirmed
        const { data: userData } = await supabase.auth.getUser();

        if (userData?.user) {
          // Check if email was recently confirmed (within last 5 minutes)
          const emailConfirmedAt = userData.user.email_confirmed_at;
          const now = new Date();
          const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

          const wasJustVerified =
            emailConfirmedAt && new Date(emailConfirmedAt) > fiveMinutesAgo;

          if (wasJustVerified) {
            // This was an email verification - redirect to success page
            console.log("AUTH CALLBACK: Email verification detected");
            const successUrl = new URL("/verify-email", requestUrl.origin);
            successUrl.searchParams.set("success", "true");
            return NextResponse.redirect(successUrl);
          }
        }

        // Regular authentication flow - redirect to dashboard
        const dashboardUrl = new URL("/dashboard", requestUrl.origin);
        return NextResponse.redirect(dashboardUrl);
      }
    } catch (exchangeError) {
      console.error(
        "AUTH CALLBACK: Exception during session exchange:",
        exchangeError,
      );

      const errorUrl = new URL("/verify-email", requestUrl.origin);
      errorUrl.searchParams.set(
        "error",
        "An unexpected error occurred during verification.",
      );
      return NextResponse.redirect(errorUrl);
    }
  } else {
    console.warn("AUTH CALLBACK: No authorization code provided");
  }

  // Fallback: redirect to home page
  return NextResponse.redirect(requestUrl.origin);
}
