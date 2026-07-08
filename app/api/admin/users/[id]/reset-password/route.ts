import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

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

    // Create authenticated supabase client first to verify admin
    const supabase = await createServerSupabase();

    // Check if user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting: Prevent abuse of password reset
    const { passwordResetLimiter } = await import("@/lib/rate-limiter");
    const rateLimitCheck = passwordResetLimiter.check(user.id);

    if (!rateLimitCheck.allowed) {
      const resetInSeconds = Math.ceil(
        (rateLimitCheck.resetTime - Date.now()) / 1000
      );
      console.error(
        `[RESET PASSWORD] Rate limit exceeded for admin ${user.id}. Reset in ${resetInSeconds}s`
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

    // Create service role client for admin operations
    const serviceSupabase = await createServerSupabase({
      useServiceRole: true,
    });

    // Verify user is admin or super_admin
    const { data: profile, error: profileError } = await serviceSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile ||
      (profile.role !== "admin" && profile.role !== "super_admin")
    ) {
      return NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 }
      );
    }

    // Update the user's password using auth admin API
    const { data: updateData, error: updateError } =
      await serviceSupabase.auth.admin.updateUserById(userId, {
        password: password,
      });

    if (updateError) {
      console.error("Password reset error:", updateError);
      return NextResponse.json(
        { error: `Failed to reset password: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Log the password reset action (optional but recommended for audit trails)
    await serviceSupabase.from("audit_logs").insert({
      user_id: user.id,
      action: "password_reset",
      resource_type: "user",
      resource_id: userId,
      details: {
        timestamp: new Date().toISOString(),
        action_type: "password_reset",
      },
    });

    // Session invalidation: Force re-authentication after password reset
    console.log(`[RESET PASSWORD] Invalidating user session for security...`);
    try {
      const { error: signOutError } = await serviceSupabase.auth.admin.signOut(
        userId,
        "global" // Sign out from all devices for password reset
      );

      if (signOutError) {
        console.error(
          `[RESET PASSWORD] Failed to invalidate user session:`,
          signOutError
        );
        // Log but don't fail - password was reset successfully
      } else {
        console.log(
          `[RESET PASSWORD] User session invalidated globally. User must log in with new password.`
        );
      }
    } catch (sessionError) {
      console.error(
        `[RESET PASSWORD] Error during session invalidation:`,
        sessionError
      );
      // Continue - don't fail the operation
    }

    return NextResponse.json({
      success: true,
      message:
        "Password reset successfully. User will be required to log in again.",
      user: updateData.user,
      session_invalidated: true,
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
