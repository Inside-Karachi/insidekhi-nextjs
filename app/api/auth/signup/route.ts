import { captureRouteError } from "@/lib/sentry/captureRouteError";
import { createServerSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { signupLimiter } from "@/lib/rate-limiter";
import disposableDomains from "disposable-email-domains";
import {
  SignupRequest,
  SignupResponse,
  AUTH_VALIDATION,
} from "@/types/auth.types";
import {
  sanitizeInput,
  validatePasswordStrength,
  validateEmailFormat,
} from "@/lib/utils";
import { verifyRecaptcha } from "@/lib/utils/recaptcha";
import { getAuthCallbackUrl } from "@/lib/auth/url";

// Type for RPC result
interface RpcResult {
  success: boolean;
  message?: string;
  error?: string;
}

// Username validation function
function validateUsername(username: string): boolean {
  const { minLength, maxLength, pattern } = AUTH_VALIDATION.username;
  return (
    username.length >= minLength &&
    username.length <= maxLength &&
    pattern.test(username)
  );
}

// Full name validation function
function validateFullName(fullName: string): boolean {
  return fullName.length <= AUTH_VALIDATION.fullName.maxLength;
}

export async function POST(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const raw = (await request.json()) as unknown;
    const body = raw as SignupRequest & {
      website_confirm?: string; // honeypot
      recaptcha_token?: string;
    };
    const {
      email,
      password,
      confirmPassword,
      username,
      full_name,
      invite_code,
    } = body;

    // Rate limit by IP to mitigate signup spam
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const limitResult = signupLimiter.check(ip);
    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          error:
            "Too many sign-up attempts from this IP. Please try again later.",
        },
        { status: 429 },
      );
    }

    // Honeypot check
    if (body.website_confirm && body.website_confirm.trim() !== "") {
      return NextResponse.json({ error: "Spam detected." }, { status: 400 });
    }

    const captcha = await verifyRecaptcha({
      token: body.recaptcha_token,
      action: "signup",
    });
    if (!captcha.ok) {
      return NextResponse.json(
        { error: captcha.message },
        { status: captcha.status },
      );
    }

    // Sanitize inputs
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedUsername = sanitizeInput(username);
    const sanitizedFullName = full_name ? sanitizeInput(full_name) : null;

    // Basic validation
    if (
      !sanitizedEmail ||
      !password ||
      !confirmPassword ||
      !sanitizedUsername
    ) {
      const missingField = !sanitizedEmail
        ? "email"
        : !password
          ? "password"
          : !confirmPassword
            ? "confirmPassword"
            : "username";
      return NextResponse.json(
        {
          error: `${
            missingField.charAt(0).toUpperCase() +
            missingField.slice(1).replace(/([A-Z])/g, " $1")
          } is required.`,
          field: missingField,
        },
        { status: 400 },
      );
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
      return NextResponse.json(
        {
          error: "Passwords do not match.",
          field: "confirmPassword",
        },
        { status: 400 },
      );
    }

    // Validate email format
    if (!validateEmailFormat(sanitizedEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid email address.", field: "email" },
        { status: 400 },
      );
    }

    // Check for disposable email domains
    const domain = email.split("@")[1];
    if (disposableDomains.includes(domain)) {
      return NextResponse.json(
        {
          error:
            "Disposable email addresses are not allowed. Please use a permanent email address.",
          field: "email",
        },
        { status: 400 },
      );
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        {
          error: `Password is too weak. ${passwordValidation.feedback.join(
            ". ",
          )}.`,
          field: "password",
        },
        { status: 400 },
      );
    }

    // Validate username
    const trimmedUsername = sanitizedUsername.trim().toLowerCase();
    if (!validateUsername(trimmedUsername)) {
      return NextResponse.json(
        {
          error: AUTH_VALIDATION.username.patternDescription,
          field: "username",
        },
        { status: 400 },
      );
    }

    // Validate full name if provided
    if (full_name && !validateFullName(full_name.trim())) {
      return NextResponse.json(
        {
          error: `Full name must be less than ${AUTH_VALIDATION.fullName.maxLength} characters.`,
          field: "full_name",
        },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabase();

    // Check username availability
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", trimmedUsername)
      .single();

    if (existingUser) {
      return NextResponse.json(
        {
          error:
            "Username is already taken. Please choose a different username.",
          field: "username",
        },
        { status: 400 },
      );
    }

    const emailRedirectTo = getAuthCallbackUrl(request.url);

    // Attempt signup with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: sanitizedEmail,
      password,
      options: {
        emailRedirectTo,
      },
    });

    if (error) {
      console.error("SIGNUP API: Supabase auth signup failed:", {
        error: error.message,
        status: error.status,
        email,
      });
      return NextResponse.json(
        { error: error.message || "Could not authenticate user." },
        { status: error.status || 400 },
      );
    }

    // Create user profile if signup was successful
    if (data.user) {
      try {
        const serviceSupabase = await createServerSupabase({
          useServiceRole: true,
        });
        const { data: rpcResult, error: profileError } =
          await serviceSupabase.rpc("create_user_profile", {
            user_id: data.user.id,
            user_username: trimmedUsername,
            user_full_name: sanitizedFullName ?? undefined,
          });

        const typedResult = rpcResult as unknown as RpcResult;

        if (profileError) {
          console.error("SIGNUP API: Profile creation failed:", {
            error: profileError,
            userId: data.user.id,
            username: trimmedUsername,
          });
          // Log the error but don't fail the signup process
          // User can still complete signup and profile will be created later if needed
        } else if (typedResult && typedResult.success) {
          // Profile created successfully
        } else {
          console.error("SIGNUP API: Profile creation failed via RPC:", {
            rpcResult: typedResult,
            userId: data.user.id,
            username: trimmedUsername,
          });
        }
      } catch (profileCreateError) {
        console.error("SIGNUP API: Profile creation exception:", {
          error: profileCreateError,
          userId: data.user.id,
          username: trimmedUsername,
        });
        // Continue with signup even if profile creation fails
      }

      // Log successful signup attempt
      try {
        const { logUserSignup } = await import("@/lib/audit");
        await logUserSignup(
          data.user.id,
          email,
          ip,
          request.headers.get("user-agent") || undefined,
        );
      } catch (logError) {
        console.error("Failed to log user signup:", logError);
        // Don't fail the operation if logging fails
      }

      // Handle invitation if code provided
      if (invite_code) {
        try {
          // Use service role to bypass RLS and link invitation
          const adminSupabase = await createServerSupabase({
            useServiceRole: true,
          });

          // Verify invitation exists
          const { data: invitation } = await adminSupabase
            .from("invitations")
            .select("*")
            .eq("invite_code", invite_code)
            .eq("status", "pending")
            .single();

          if (invitation) {
            // Verify email matches (case insensitive)
            if (
              invitation.invitee_email.toLowerCase() ===
              sanitizedEmail.toLowerCase()
            ) {
              // Accept the invitation
              const { error: inviteUpdateError } = await adminSupabase
                .from("invitations")
                .update({
                  invitee_id: data.user.id,
                  status: "accepted",
                  accepted_at: new Date().toISOString(),
                })
                .eq("id", invitation.id);

              if (inviteUpdateError) {
                console.error(
                  "SIGNUP API: Failed to update invitation status:",
                  inviteUpdateError,
                );
              } else {
                console.log("SIGNUP API: Linked invitation:", {
                  id: invitation.id,
                  code: invite_code,
                  userId: data.user.id,
                });
              }
            } else {
              console.warn("SIGNUP API: Invitation email mismatch", {
                inviteEmail: invitation.invitee_email,
                signupEmail: sanitizedEmail,
              });
            }
          } else {
            console.warn("SIGNUP API: Invalid or non-pending invitation", {
              code: invite_code,
            });
          }
        } catch (inviteError) {
          console.error(
            "SIGNUP API: Failed to process invitation:",
            inviteError,
          );
        }
      }
    }

    const response: SignupResponse = {
      message: "Check email to continue sign in process",
      redirectTo: `${requestUrl.origin}/login?message=Check email to continue sign in process`,
      user: data.user
        ? {
            id: data.user.id,
            email: data.user.email || email,
            username: trimmedUsername,
            full_name: full_name ? full_name.trim() : undefined,
          }
        : undefined,
    };

    return NextResponse.json(response, {
      headers: {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    captureRouteError(error, { route: "/api/auth/signup", method: "POST" });
    return NextResponse.json(
      { error: "An unexpected error occurred during signup." },
      {
        status: 500,
        headers: {
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          "X-XSS-Protection": "1; mode=block",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
      },
    );
  }
}
