import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  createMobileServiceClient,
  type MobileSupabase,
} from "@/lib/mobile/supabase";

export const dynamic = "force-dynamic";

/** Canonical "game day" string (YYYY-MM-DD) in Asia/Karachi. */
function karachiDay(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

async function activityXp(
  supabase: MobileSupabase,
  slug: string,
  fallback: number,
): Promise<number> {
  const { data } = await supabase
    .from("xp_activities")
    .select("xp_value")
    .eq("activity_slug", slug)
    .maybeSingle();
  return data?.xp_value ?? fallback;
}

const alreadyClaimed = () =>
  new MobileApiError(
    "already_claimed_today",
    "You have already claimed your daily login today.",
    409,
    undefined,
    { can_claim: false },
  );

/**
 * GET /api/mobile/v1/gamification/daily-login - streak status (auth).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user, supabase } = await requireMobileUser(request);

  const { data: streak } = await supabase
    .from("daily_login_streaks")
    .select("current_streak, longest_streak, total_logins, last_claimed_date")
    .eq("user_id", user.id)
    .maybeSingle();

  const today = karachiDay();
  const hasClaimedToday = streak?.last_claimed_date === today;
  const dailyXp = await activityXp(supabase, "daily_login", 5);

  return ok({
    has_logged_in_today: hasClaimedToday,
    current_streak: streak?.current_streak ?? 0,
    longest_streak: streak?.longest_streak ?? 0,
    total_logins: streak?.total_logins ?? 0,
    can_claim: !hasClaimedToday,
    xp_earned_today: dailyXp,
    next_claim_at: hasClaimedToday
      ? new Date(
          new Date(today + "T00:00:00+05:00").getTime() + 24 * 60 * 60 * 1000,
        ).toISOString()
      : null,
  });
});

/**
 * POST /api/mobile/v1/gamification/daily-login - claim daily XP (auth).
 *
 * Awards via a service-role `points_log` insert (the SECURITY DEFINER trigger
 * updates `profiles.points`). Concurrency-safe: an optimistic lock on the streak
 * row's `updated_at`, plus the DB's per-UTC-day dedupe trigger, both normalize an
 * already-claimed state to 409 `already_claimed_today`. Mirrors
 * `app/api/gamification/daily-login` (POST).
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request); // IP-keyed before auth (unauth-flood guard)
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const service = createMobileServiceClient();
  const now = new Date();
  const today = karachiDay();

  // Ensure a streak row exists without racing on first-claim creation.
  const { error: upsertError } = await service
    .from("daily_login_streaks")
    .upsert(
      {
        user_id: user.id,
        current_streak: 0,
        longest_streak: 0,
        total_logins: 0,
        last_login_date: today,
        streak_started_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  if (upsertError) {
    console.error("[mobile-api] streak init failed:", upsertError.message);
    throw new MobileApiError(
      "internal_error",
      "Failed to claim daily login.",
      500,
    );
  }

  const { data: streak, error: readError } = await service
    .from("daily_login_streaks")
    .select(
      "current_streak, longest_streak, total_logins, last_login_date, last_claimed_date, streak_started_at, updated_at",
    )
    .eq("user_id", user.id)
    .single();
  if (readError || !streak) {
    console.error("[mobile-api] streak read failed:", readError?.message);
    throw new MobileApiError(
      "internal_error",
      "Failed to claim daily login.",
      500,
    );
  }

  if (streak.last_claimed_date === today) throw alreadyClaimed();

  // Streak math via Karachi date strings (no TZ ambiguity).
  const yesterday = new Date(today + "T00:00:00+05:00");
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString("en-CA", {
    timeZone: "Asia/Karachi",
  });

  let newStreak = 1;
  let streakBroken = false;
  if (streak.last_login_date === yesterdayStr) {
    newStreak = (streak.current_streak ?? 0) + 1;
  } else if (streak.last_login_date === today) {
    // `|| 1` (not `??`): a fresh-upsert row has current_streak 0, which must
    // count as day 1, not 0.
    newStreak = streak.current_streak || 1;
  } else {
    newStreak = 1;
    streakBroken = true;
  }

  const earnedBonus = newStreak === 7;
  const dailyXp = await activityXp(service, "daily_login", 5);
  const bonusXp = earnedBonus
    ? await activityXp(service, "streak_7day", 20)
    : 0;

  // Optimistic lock on updated_at: a concurrent winner changes it -> 0 rows -> 409.
  const { data: claimed, error: updateError } = await service
    .from("daily_login_streaks")
    .update({
      current_streak: newStreak,
      longest_streak: Math.max(newStreak, streak.longest_streak ?? 0),
      total_logins: (streak.total_logins ?? 0) + 1,
      last_login_date: today,
      last_claimed_date: today,
      streak_started_at: streakBroken
        ? now.toISOString()
        : streak.streak_started_at,
      updated_at: now.toISOString(),
    })
    .eq("user_id", user.id)
    .eq("updated_at", streak.updated_at)
    .select("user_id")
    .maybeSingle();
  if (updateError) {
    console.error(
      "[mobile-api] streak claim update failed:",
      updateError.message,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to claim daily login.",
      500,
    );
  }
  if (!claimed) throw alreadyClaimed();

  const { error: logError } = await service
    .from("points_log")
    .insert([
      { user_id: user.id, points: dailyXp, reason: "daily_login" },
      ...(earnedBonus
        ? [{ user_id: user.id, points: bonusXp, reason: "streak_7day" }]
        : []),
    ]);
  if (logError) {
    // Roll back the claim so the user can retry; the DB per-UTC-day dedupe
    // raising 23505 means the day is genuinely already claimed (Karachi/UTC edge).
    await service
      .from("daily_login_streaks")
      .update({
        current_streak: streak.current_streak ?? 0,
        longest_streak: streak.longest_streak ?? 0,
        total_logins: streak.total_logins ?? 0,
        last_login_date: streak.last_login_date ?? undefined,
        last_claimed_date: streak.last_claimed_date,
        streak_started_at: streak.streak_started_at ?? undefined,
        updated_at: streak.updated_at ?? undefined,
      })
      .eq("user_id", user.id)
      // Scope to today's claim so a concurrent winner's fresh row isn't clobbered.
      .eq("last_claimed_date", today);
    if (logError.code === "23505") throw alreadyClaimed();
    console.error("[mobile-api] points_log insert failed:", logError.message);
    throw new MobileApiError(
      "internal_error",
      "Failed to award daily login XP.",
      500,
    );
  }

  return ok({
    xp_awarded: dailyXp + bonusXp,
    new_streak: newStreak,
    streak_bonus: earnedBonus
      ? { earned: true, xp_bonus: bonusXp, days_in_streak: 7 }
      : null,
  });
});
