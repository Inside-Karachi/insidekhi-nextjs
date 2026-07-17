import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { setSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const token = requestUrl.searchParams.get("token") || code; // Support both naming styles

  if (token) {
    try {
      // Find user with this confirmation/recovery token
      const { rows } = await query(
        `SELECT id, email, role, email_confirmed_at
         FROM public.profiles
         LEFT JOIN auth.users ON public.profiles.id = auth.users.id
         WHERE auth.users.confirmation_token = $1
            OR auth.users.recovery_token = $1 LIMIT 1`,
        [token]
      );

      const user = rows[0];

      if (!user) {
        console.error("AUTH CALLBACK: Token match not found");
        const loginUrl = new URL("/login", requestUrl.origin);
        loginUrl.searchParams.set("error", "Verification link is invalid or expired.");
        return NextResponse.redirect(loginUrl);
      }

      const now = new Date().toISOString();

      // Update email verification status in database
      await query(
        `UPDATE auth.users
         SET email_confirmed_at = $1, confirmation_token = NULL, recovery_token = NULL
         WHERE id = $2`,
        [now, user.id]
      );

      // Create local session cookie
      const response = NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
      await setSession(response, {
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // If they were just confirmed (was null before)
      if (!user.email_confirmed_at) {
        console.log("AUTH CALLBACK: Email verification successful");
        const successUrl = new URL("/verify-email", requestUrl.origin);
        successUrl.searchParams.set("success", "true");
        // Keep session set but redirect to verification success page
        const redirectResponse = NextResponse.redirect(successUrl);
        await setSession(redirectResponse, {
          userId: user.id,
          email: user.email,
          role: user.role,
        });
        return redirectResponse;
      }

      return response;
    } catch (exchangeError) {
      console.error("AUTH CALLBACK: Exception during validation:", exchangeError);
      const errorUrl = new URL("/verify-email", requestUrl.origin);
      errorUrl.searchParams.set(
        "error",
        "An unexpected error occurred during verification.",
      );
      return NextResponse.redirect(errorUrl);
    }
  }

  // Fallback: redirect to home page
  return NextResponse.redirect(requestUrl.origin);
}
