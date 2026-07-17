import { getSessionFromCookies } from "@/lib/auth/session";
/**
 * POST /api/admin/gamification/reset-daily-login
 * Admin endpoint to reset daily login claim status for testing
 * Allows re-claiming daily login XP on the same day
 * 
 * Body: { user_id?: string } - If not provided, resets for current user
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { canManageGamificationSettings } from "@/lib/auth/gamification-permissions";

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  try {
    const supabase = await createServerSupabase({ useServiceRole: true });
    const authSupabase = await createServerSupabase();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await authSupabase.auth.getUser();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Failed to verify admin role" },
        { status: 403 }
      );
    }

    if (!canManageGamificationSettings(profile.role)) {
      return NextResponse.json(
        { error: "Super admin role required" },
        { status: 403 }
      );
    }

    // Parse request body to get optional user_id to reset
    let targetUserId = session.userId;
    try {
      const body = await request.json();
      if (body.user_id) {
        targetUserId = body.user_id;
      }
    } catch {
      // No body or invalid JSON, use current user
    }

    // Get current streak data
    const { data: streakData, error: streakError } = await supabase
      .from("daily_login_streaks")
      .select("*")
      .eq("user_id", targetUserId)
      .single();

    if (streakError) {
      return NextResponse.json(
        { error: "User streak data not found", details: streakError.message },
        { status: 404 }
      );
    }

    // Reset last_claimed_date to before today
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    const { error: updateError } = await supabase
      .from("daily_login_streaks")
      .update({
        last_claimed_date: yesterday.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", targetUserId);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to reset daily login", details: updateError.message },
        { status: 500 }
      );
    }

    // Get updated data
    const { data: updatedStreak, error: fetchError } = await supabase
      .from("daily_login_streaks")
      .select("*")
      .eq("user_id", targetUserId)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to fetch updated data", details: fetchError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Daily login reset for user ${targetUserId}`,
      previous_last_claimed: streakData.last_claimed_date,
      new_last_claimed: updatedStreak?.last_claimed_date,
      current_streak: updatedStreak?.current_streak,
      can_claim_again: true,
    });
  } catch (error) {
    console.error("Reset daily login error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
