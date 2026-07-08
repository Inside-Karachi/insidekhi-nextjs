import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const serviceSupabase = await createServerSupabase({
      useServiceRole: true,
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Authentication required",
          field: "auth",
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body || {};

    // Validate required fields
    if (!currentPassword) {
      return NextResponse.json(
        {
          error: "Current password is required",
          field: "currentPassword",
        },
        { status: 400 }
      );
    }

    if (!newPassword) {
      return NextResponse.json(
        {
          error: "New password is required",
          field: "newPassword",
        },
        { status: 400 }
      );
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return NextResponse.json(
        {
          error: "Password must be at least 8 characters long",
          field: "newPassword",
        },
        { status: 400 }
      );
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return NextResponse.json(
        {
          error: "Password must contain uppercase, lowercase, and numbers",
          field: "newPassword",
        },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        {
          error: "New password must be different from current password",
          field: "newPassword",
        },
        { status: 400 }
      );
    }

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });

    if (signInError) {
      return NextResponse.json(
        {
          error: "Current password is incorrect",
          field: "currentPassword",
        },
        { status: 400 }
      );
    }

    // Update password using service role
    const { error: updateError } =
      await serviceSupabase.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });

    if (updateError) {
      console.error("Password update error:", updateError);
      return NextResponse.json(
        {
          error: "Failed to update password. Please try again.",
          field: "server",
        },
        { status: 500 }
      );
    }

    // Log the password change
    try {
      const { logPasswordChange } = await import("@/lib/audit");
      await logPasswordChange(
        user.id,
        request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown"
      );
    } catch (logError) {
      console.error("Failed to log password change:", logError);
      // Don't fail the operation if logging fails
    }

    return NextResponse.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred. Please try again.",
        field: "server",
      },
      { status: 500 }
    );
  }
}
