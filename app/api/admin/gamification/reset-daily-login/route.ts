/**
 * POST /api/admin/gamification/reset-daily-login
 * Admin endpoint to reset daily login claim status for testing
 * Allows re-claiming daily login XP on the same day
 *
 * Body: { user_id?: string } - If not provided, resets for current user
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";
import { canManageGamificationSettings } from "@/lib/auth/gamification-permissions";

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  try {
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin role
    const { rows: profileRows } = await query(
      `SELECT role FROM public.profiles WHERE id = $1 LIMIT 1`,
      [session.userId],
    );
    const profile = profileRows[0] as { role: string } | undefined;

    if (!profile) {
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
    let streakData;
    try {
      const { rows } = await query(
        `SELECT * FROM public.daily_login_streaks WHERE user_id = $1 LIMIT 1`,
        [targetUserId],
      );
      streakData = rows[0];
    } catch (streakError) {
      return NextResponse.json(
        {
          error: "User streak data not found",
          details:
            streakError instanceof Error ? streakError.message : "Unknown error",
        },
        { status: 404 }
      );
    }

    if (!streakData) {
      return NextResponse.json(
        { error: "User streak data not found", details: undefined },
        { status: 404 }
      );
    }

    // Reset last_claimed_date to before today
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    try {
      await query(
        `UPDATE public.daily_login_streaks
         SET last_claimed_date = $1, updated_at = $2
         WHERE user_id = $3`,
        [yesterday.toISOString(), new Date().toISOString(), targetUserId],
      );
    } catch (updateError) {
      return NextResponse.json(
        {
          error: "Failed to reset daily login",
          details:
            updateError instanceof Error ? updateError.message : "Unknown error",
        },
        { status: 500 }
      );
    }

    // Get updated data
    let updatedStreak;
    try {
      const { rows } = await query(
        `SELECT * FROM public.daily_login_streaks WHERE user_id = $1 LIMIT 1`,
        [targetUserId],
      );
      updatedStreak = rows[0];
    } catch (fetchError) {
      return NextResponse.json(
        {
          error: "Failed to fetch updated data",
          details:
            fetchError instanceof Error ? fetchError.message : "Unknown error",
        },
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
