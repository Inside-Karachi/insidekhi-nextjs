import { captureRouteError } from "@/lib/sentry/captureRouteError";
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
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { setSession } from "@/lib/auth/session";
import { v4 as uuidv4 } from "uuid";

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

    // Check username availability
    const { rows: existingUsernames } = await query(
      "SELECT id FROM public.profiles WHERE LOWER(username) = LOWER($1) LIMIT 1",
      [trimmedUsername]
    );

    if (existingUsernames.length > 0) {
      return NextResponse.json(
        {
          error:
            "Username is already taken. Please choose a different username.",
          field: "username",
        },
        { status: 400 },
      );
    }

    // Check if email already registered
    const { rows: existingEmails } = await query(
      "SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [sanitizedEmail]
    );

    if (existingEmails.length > 0) {
      return NextResponse.json(
        {
          error: "An account with this email address already exists.",
          field: "email",
        },
        { status: 400 },
      );
    }

    // Hash password and prepare user insertion
    const encryptedPassword = await hashPassword(password);
    const newUserId = uuidv4();
    const now = new Date().toISOString();

    // Insert user into auth.users (automatically confirmed in this local test mode, or you can require verification)
    // To preserve user flow, we mark email_confirmed_at = now so they are immediately verified, OR null to require verification.
    // Let's set email_confirmed_at = now to make login/registration frictionless and completely offline from Supabase.
    await query(
      `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, role, aud)
       VALUES ($1, $2, $3, $4, $5, $6, 'authenticated', 'authenticated')`,
      [newUserId, sanitizedEmail, encryptedPassword, now, now, now]
    );

    // Create user profile
    try {
      await query(
        `SELECT public.create_user_profile($1, $2, $3)`,
        [newUserId, trimmedUsername, sanitizedFullName]
      );
    } catch (profileCreateError) {
      console.error("SIGNUP API: Profile creation exception:", {
        error: profileCreateError,
        userId: newUserId,
        username: trimmedUsername,
      });
      // Fallback manual profile insertion
      await query(
        `INSERT INTO public.profiles (id, username, full_name, role, points, active_role)
         VALUES ($1, $2, $3, 'public_user', 0, 'public_user')`,
        [newUserId, trimmedUsername, sanitizedFullName]
      );
    }

    // Log successful signup attempt
    try {
      const { logUserSignup } = await import("@/lib/audit");
      await logUserSignup(
        newUserId,
        sanitizedEmail,
        ip,
        request.headers.get("user-agent") || undefined,
      );
    } catch (logError) {
      console.error("Failed to log user signup:", logError);
    }

    // Handle invitation if code provided
    if (invite_code) {
      try {
        const { rows: invitations } = await query(
          "SELECT * FROM public.invitations WHERE invite_code = $1 AND status = 'pending' LIMIT 1",
          [invite_code]
        );
        const invitation = invitations[0];

        if (invitation) {
          if (invitation.invitee_email.toLowerCase() === sanitizedEmail.toLowerCase()) {
            await query(
              "UPDATE public.invitations SET invitee_id = $1, status = 'accepted', accepted_at = $2 WHERE id = $3",
              [newUserId, now, invitation.id]
            );
            console.log("SIGNUP API: Linked invitation:", {
              id: invitation.id,
              code: invite_code,
              userId: newUserId,
            });
          }
        }
      } catch (inviteError) {
        console.error("SIGNUP API: Failed to process invitation:", inviteError);
      }
    }

    const responseBody: SignupResponse = {
      message: "Registration successful.",
      redirectTo: `${requestUrl.origin}/dashboard`,
      user: {
        id: newUserId,
        email: sanitizedEmail,
        username: trimmedUsername,
        full_name: full_name ? full_name.trim() : undefined,
      },
    };

    const response = NextResponse.json(responseBody, {
      headers: {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
    });

    // Log the new user in immediately - skip the separate login step.
    await setSession(response, {
      userId: newUserId,
      email: sanitizedEmail,
      role: "public_user",
    });

    return response;
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

