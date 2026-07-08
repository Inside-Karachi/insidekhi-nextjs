import { createServerSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {
  checkAuthRateLimit,
  createRateLimitResponse,
} from "@/lib/rate-limiter-distributed";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  // Attempting login for submitted credentials

  // Basic input validation
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  // PHASE 1 FIX: Distributed rate limiting
  const rateLimitResult = await checkAuthRateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(createRateLimitResponse(rateLimitResult), {
      status: 429,
    });
  }

  // Get IP for audit logging
  const ip =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const supabase = await createServerSupabase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // Supabase sign-in attempted

  if (error) {
    console.error("Login failed:", error.message);

    // Log failed login attempt
    try {
      const { logFailedLogin } = await import("@/lib/audit");
      await logFailedLogin(
        email,
        ip,
        request.headers.get("user-agent") || undefined,
      );
    } catch (logError) {
      console.error("Failed to log failed login:", logError);
    }

    // Supabase surfaces unconfirmed accounts via error.code or error.message.
    // Return a distinct code so the client can guide the user to the resend flow
    // rather than leaving them with a misleading "wrong credentials" message.
    const authError = error as { code?: string; message: string };
    const isUnconfirmed =
      authError.code === "email_not_confirmed" ||
      authError.message.toLowerCase().includes("email not confirmed");

    if (isUnconfirmed) {
      return NextResponse.json(
        {
          error:
            "Your email address has not been verified yet. Please check your inbox and click the confirmation link, or request a new one below.",
          code: "email_not_confirmed",
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: "Invalid credentials. Please try again." },
      { status: 401 },
    );
  }

  // Check if maintenance mode is enabled and if user is super admin
  if (data.user) {
    // Check maintenance mode
    const serviceRoleSupabase = await createServerSupabase({
      useServiceRole: true,
    });

    const { data: maintenanceConfig } = await serviceRoleSupabase
      .from("system_config")
      .select("config_value")
      .eq("config_key", "maintenance.enabled")
      .single();

    const maintenanceEnabled =
      maintenanceConfig?.config_value === true ||
      maintenanceConfig?.config_value === "true" ||
      (typeof maintenanceConfig?.config_value === "string" &&
        maintenanceConfig.config_value.toLowerCase() === "true");

    if (maintenanceEnabled) {
      // Check if user is super admin
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profile?.role !== "super_admin") {
        // Sign out the user immediately
        await supabase.auth.signOut();

        console.log(
          `[LOGIN BLOCKED] Non-super admin user ${data.user.email} attempted login during maintenance`,
        );

        return NextResponse.json(
          {
            error:
              "The system is currently under maintenance. Only administrators can access the system at this time. Please try again later.",
          },
          { status: 503 },
        );
      }

      console.log(
        `[LOGIN ALLOWED] Super admin ${data.user.email} logged in during maintenance`,
      );
    }

    // Log successful login
    try {
      const { logUserLogin } = await import("@/lib/audit");
      await logUserLogin(
        data.user.id,
        request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        request.headers.get("user-agent") || undefined,
      );
    } catch (logError) {
      console.error("Failed to log successful login:", logError);
    }
  }

  // Login successful
  return NextResponse.json({ message: "Login successful" });
}
