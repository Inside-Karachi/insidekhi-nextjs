/**
 * POST /api/gamification/daily-login
 * Daily login system with streak tracking
 * - Claims daily login XP (5 XP per day)
 * - Tracks login streaks
 * - Awards 7-day streak bonus (20 XP)
 * - Updates daily_login_streaks table
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import type {
  DailyLoginClaimResult,
  DailyLoginStatus,
} from "@/types/gamification.types";

// Canonical "game day" in Asia/Karachi timezone (consistent across GET and POST)
const ROUTE = "/api/gamification/daily-login";

function getKarachiDateStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

type StreakSnapshot = {
  current_streak: number | null;
  longest_streak: number | null;
  total_logins: number | null;
  last_login_date: string | null;
  last_claimed_date: string | null;
  streak_started_at: string | null;
  updated_at: string | null;
};

function streakRollbackPayload(row: StreakSnapshot) {
  return {
    current_streak: row.current_streak ?? 0,
    longest_streak: row.longest_streak ?? 0,
    total_logins: row.total_logins ?? 0,
    last_login_date: row.last_login_date ?? undefined,
    last_claimed_date: row.last_claimed_date,
    streak_started_at: row.streak_started_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  };
}

/**
 * GET - Check daily login status
 * Returns current streak, if user can claim today, etc.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: streakData, error: streakError } = await supabase
      .from("daily_login_streaks")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (streakError && streakError.code !== "PGRST116") {
      captureRouteError(streakError, { route: ROUTE, method: "GET" });
      return NextResponse.json(
        { error: "Failed to fetch streak data" },
        { status: 500 },
      );
    }

    const { data: activityData } = await supabase
      .from("xp_activities")
      .select("xp_value")
      .eq("activity_slug", "daily_login")
      .single();

    const dailyLoginXP = activityData?.xp_value || 5;

    const todayStr = getKarachiDateStr();

    const hasLoggedInToday = streakData?.last_claimed_date === todayStr;
    const canClaim = !hasLoggedInToday;

    const status: DailyLoginStatus = {
      has_logged_in_today: hasLoggedInToday,
      current_streak: streakData?.current_streak || 0,
      longest_streak: streakData?.longest_streak || 0,
      total_logins: streakData?.total_logins || 0,
      can_claim_xp: canClaim,
      xp_earned_today: dailyLoginXP,
      next_claim_at: hasLoggedInToday
        ? new Date(
            new Date(todayStr + "T00:00:00+05:00").getTime() +
              24 * 60 * 60 * 1000,
          ).toISOString()
        : undefined,
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error("Daily login GET error:", error);
    captureRouteError(error, { route: ROUTE, method: "GET" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST - Claim daily login XP
 * Awards 5 XP for daily login, 20 XP bonus for 7-day streak
 */
export async function POST(_request: NextRequest) {
  try {
    const supabase = await createServerSupabase({ useServiceRole: true });

    const authSupabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await authSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const todayStr = getKarachiDateStr();

    // Upsert ensures a row exists without racing on first-login creation.
    const { error: upsertError } = await supabase
      .from("daily_login_streaks")
      .upsert(
        {
          user_id: user.id,
          current_streak: 0,
          longest_streak: 0,
          total_logins: 0,
          last_login_date: todayStr,
          streak_started_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
        {
          onConflict: "user_id",
          ignoreDuplicates: true,
        },
      );

    if (upsertError) {
      captureRouteError(upsertError, { route: ROUTE, method: "POST" });
      return NextResponse.json(
        { error: "Failed to initialize streak" },
        { status: 500 },
      );
    }

    const { data: streakData, error: streakError } = await supabase
      .from("daily_login_streaks")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (streakError || !streakData) {
      captureRouteError(streakError ?? new Error("Streak data missing"), {
        route: ROUTE,
        method: "POST",
      });
      return NextResponse.json(
        { error: "Failed to fetch streak data" },
        { status: 500 },
      );
    }

    // Direct string comparison - both sides are YYYY-MM-DD in Karachi TZ
    if (streakData.last_claimed_date === todayStr) {
      return NextResponse.json(
        { error: "Already claimed today", can_claim: false },
        { status: 400 },
      );
    }

    // Calculate streak using date strings (no timezone ambiguity)
    const lastLoginStr = streakData.last_login_date;
    const yesterdayDate = new Date(todayStr + "T00:00:00+05:00");
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toLocaleDateString("en-CA", {
      timeZone: "Asia/Karachi",
    });

    let newStreak = 1;
    let streakBroken = false;

    if (lastLoginStr === yesterdayStr) {
      newStreak = (streakData.current_streak || 0) + 1;
    } else if (lastLoginStr === todayStr) {
      newStreak = streakData.current_streak || 1;
    } else {
      newStreak = 1;
      streakBroken = true;
    }

    const earned7DayBonus = newStreak === 7;
    let bonusXP = 0;

    const { data: activities } = await supabase
      .from("xp_activities")
      .select("activity_slug, xp_value")
      .in("activity_slug", ["daily_login", "streak_7day"]);

    const dailyLoginXP =
      activities?.find((a) => a.activity_slug === "daily_login")?.xp_value || 5;
    const streakBonusXP =
      activities?.find((a) => a.activity_slug === "streak_7day")?.xp_value ||
      20;

    if (earned7DayBonus) {
      bonusXP = streakBonusXP;
    }

    // Optimistic lock via updated_at: prevents concurrent double-claims without
    // referencing last_claimed_date in a PostgREST filter (which hits a schema
    // cache bug returning 42703). If a concurrent request wins, updated_at will
    // have changed and this update matches 0 rows -> 409.
    const { data: claimedRow, error: updateError } = await supabase
      .from("daily_login_streaks")
      .update({
        current_streak: newStreak,
        longest_streak: Math.max(newStreak, streakData.longest_streak || 0),
        total_logins: (streakData.total_logins || 0) + 1,
        last_login_date: todayStr,
        last_claimed_date: todayStr,
        streak_started_at: streakBroken
          ? now.toISOString()
          : streakData.streak_started_at,
        updated_at: now.toISOString(),
      })
      .eq("user_id", user.id)
      .eq("updated_at", streakData.updated_at)
      .select("user_id")
      .maybeSingle();

    if (updateError) {
      console.error("Daily login UPDATE error:", updateError);
      captureRouteError(updateError, { route: ROUTE, method: "POST" });
      return NextResponse.json(
        { error: "Failed to claim daily login" },
        { status: 500 },
      );
    }

    if (!claimedRow) {
      return NextResponse.json(
        { error: "Already claimed today", can_claim: false },
        { status: 409 },
      );
    }

    const totalXP = dailyLoginXP + bonusXP;

    const { error: logError } = await supabase
      .from("points_log")
      .insert([
        { user_id: user.id, points: dailyLoginXP, reason: "daily_login" },
        ...(earned7DayBonus
          ? [{ user_id: user.id, points: bonusXP, reason: "streak_7day" }]
          : []),
      ]);

    if (logError) {
      console.error(
        "Failed to log points - rolling back streak claim:",
        logError,
      );
      const { error: rollbackError } = await supabase
        .from("daily_login_streaks")
        .update(streakRollbackPayload(streakData))
        .eq("user_id", user.id)
        .eq("last_claimed_date", todayStr);

      captureRouteError(logError, {
        route: ROUTE,
        method: "POST",
        extra: { stage: "points_log_insert", rollbackFailed: !!rollbackError },
      });

      return NextResponse.json(
        {
          error: "Failed to award daily login XP",
          can_claim: !rollbackError,
        },
        { status: 500 },
      );
    }

    const result: DailyLoginClaimResult = {
      success: true,
      xp_awarded: totalXP,
      new_streak: newStreak,
      streak_bonus: earned7DayBonus
        ? { earned: true, xp_bonus: bonusXP, days_in_streak: 7 }
        : undefined,
      message: earned7DayBonus
        ? `7-Day Streak Bonus! +${totalXP} XP total`
        : `+${dailyLoginXP} XP! Day ${newStreak} streak`,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Daily login POST error:", error);
    captureRouteError(error, { route: ROUTE, method: "POST" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
