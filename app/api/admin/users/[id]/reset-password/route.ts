import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get the user ID from params
    const { id: userId } = await context.params;

    // Parse request body
    const body = await request.json();
    const { password } = body;

    // Validate password
    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    // Check if user is authenticated
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting: Prevent abuse of password reset
    const { passwordResetLimiter } = await import("@/lib/rate-limiter");
    const rateLimitCheck = passwordResetLimiter.check(session.userId);

    if (!rateLimitCheck.allowed) {
      const resetInSeconds = Math.ceil(
        (rateLimitCheck.resetTime - Date.now()) / 1000
      );
      console.error(
        `[RESET PASSWORD] Rate limit exceeded for admin ${session.userId}. Reset in ${resetInSeconds}s`
      );
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit exceeded. Try again in ${resetInSeconds} seconds.`,
          retryAfter: resetInSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": resetInSeconds.toString(),
            "X-RateLimit-Limit": "20",
            "X-RateLimit-Remaining": rateLimitCheck.remaining.toString(),
            "X-RateLimit-Reset": new Date(
              rateLimitCheck.resetTime
            ).toISOString(),
          },
        }
      );
    }
    console.log(
      `[RESET PASSWORD] Rate limit check passed. Remaining: ${rateLimitCheck.remaining}/20`
    );

    // Verify user is admin or super_admin
    const { rows: profileRows } = await query(
      `SELECT role FROM public.profiles WHERE id = $1 LIMIT 1`,
      [session.userId]
    );
    const profile = profileRows[0];

    if (
      !profile ||
      (profile.role !== "admin" && profile.role !== "super_admin")
    ) {
      return NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 }
      );
    }

    // Update the user's password
    const encryptedPassword = await hashPassword(password);
    let updatedUser;
    try {
      const { rows } = await query(
        `UPDATE auth.users SET encrypted_password = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email`,
        [encryptedPassword, userId]
      );
      updatedUser = rows[0];
    } catch (updateError) {
      console.error("Password reset error:", updateError);
      return NextResponse.json(
        { error: "Failed to reset password" },
        { status: 500 }
      );
    }

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Log the password reset action
    try {
      await query(
        `INSERT INTO audit_logs (admin_id, user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'password_reset', 'user', $3, $4)`,
        [
          session.userId,
          userId,
          userId,
          { timestamp: new Date().toISOString(), action_type: "password_reset" },
        ]
      );
    } catch (logError) {
      console.error("Failed to log password reset:", logError);
      // Don't fail the operation if logging fails
    }

    // NOTE: sessions here are stateless JWTs with no server-side revocation
    // list, so unlike the old Supabase-backed flow, there is currently no way
    // to force the user's existing session to expire early. Anyone with an
    // active session before this reset stays logged in until it expires
    // naturally (up to 7 days) - the new password only takes effect the next
    // time they log in.
    return NextResponse.json({
      success: true,
      message:
        "Password reset successfully. Note: their existing session remains valid until it expires naturally (up to 7 days) - there is currently no way to force it to expire immediately.",
      user: updatedUser,
      session_invalidated: false,
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
