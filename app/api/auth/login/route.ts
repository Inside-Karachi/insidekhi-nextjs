import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { setSession } from "@/lib/auth/session";
import {
  checkAuthRateLimit,
  createRateLimitResponse,
} from "@/lib/rate-limiter-distributed";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

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

  try {
    // 1. Fetch user credentials and profile
    const { rows } = await query(
      `SELECT p.id, p.role, u.email_confirmed_at, u.encrypted_password 
       FROM public.profiles p 
       LEFT JOIN auth.users u ON p.id = u.id 
       WHERE LOWER(u.email) = LOWER($1) LIMIT 1`,
      [email]
    );

    const dbUser = rows[0];

    if (!dbUser || !dbUser.encrypted_password) {
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

      return NextResponse.json(
        { error: "Invalid credentials. Please try again." },
        { status: 401 },
      );
    }

    // 2. Validate password
    const isPasswordCorrect = await verifyPassword(password, dbUser.encrypted_password);
    if (!isPasswordCorrect) {
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

      return NextResponse.json(
        { error: "Invalid credentials. Please try again." },
        { status: 401 },
      );
    }

    // 3. Check email confirmation
    if (!dbUser.email_confirmed_at) {

      return NextResponse.json(
        {
          error:
            "Your email address has not been verified yet. Please check your inbox and click the confirmation link, or request a new one below.",
          code: "email_not_confirmed",
        },
        { status: 403 },
      );
    }

    // 4. Check if maintenance mode is enabled and if user is super admin
    const { rows: maintenanceConfigs } = await query(
      "SELECT config_key, config_value FROM system_config WHERE config_key = $1 LIMIT 1",
      ["maintenance.enabled"]
    );
    const maintenanceConfig = maintenanceConfigs[0];
    const maintenanceEnabled =
      maintenanceConfig?.config_value === true ||
      maintenanceConfig?.config_value === "true" ||
      (typeof maintenanceConfig?.config_value === "string" &&
        maintenanceConfig.config_value.toLowerCase() === "true");

    if (maintenanceEnabled && dbUser.role !== "super_admin") {
      console.log(
        `[LOGIN BLOCKED] Non-super admin user ${email} attempted login during maintenance`,
      );

      return NextResponse.json(
        {
          error:
            "The system is currently under maintenance. Only administrators can access the system at this time. Please try again later.",
        },
        { status: 503 },
      );
    }

    // 5. Successful login: set session cookie and build response
    const response = NextResponse.json({ message: "Login successful" });
    await setSession(response, {
      userId: dbUser.id,
      email,
      role: dbUser.role,
    });

    // Log successful login
    try {
      const { logUserLogin } = await import("@/lib/audit");
      await logUserLogin(
        dbUser.id,
        ip,
        request.headers.get("user-agent") || undefined,
      );
    } catch (logError) {
      console.error("Failed to log successful login:", logError);
    }

    return response;
  } catch (error) {
    console.error("Login process error:", error);
    return NextResponse.json(
      { error: "An error occurred during authentication." },
      { status: 500 }
    );
  }
}

