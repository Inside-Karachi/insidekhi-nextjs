import { createServerSupabase } from "@/lib/supabase/server";
import {
  type ActivityCheckResponse,
  type XPAwardResult,
} from "@/types/gamification.types";

/**
 * Check if user can perform an activity (respects cooldowns)
 */
export async function checkActivityEligibility(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  activitySlug: string,
): Promise<ActivityCheckResponse> {
  try {
    // Get activity definition
    const { data: activity, error: activityError } = await supabase
      .from("xp_activities")
      .select("id, activity_slug, cooldown_type, max_per_day")
      .eq("activity_slug", activitySlug)
      .eq("is_active", true)
      .single();

    if (activityError || !activity) {
      return { can_perform: false, reason: "Activity not found or inactive" };
    }

    // One-time activities - check if already claimed
    if (activity.cooldown_type === "once") {
      const { data: existing } = await supabase
        .from("points_log")
        .select("id")
        .eq("user_id", userId)
        .eq("reason", activitySlug)
        .limit(1);

      if (existing && existing.length > 0) {
        return { can_perform: false, reason: "Activity already claimed" };
      }
    }

    // Daily activities - check if already done today
    if (activity.cooldown_type === "daily") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: todaysLog } = await supabase
        .from("points_log")
        .select("id")
        .eq("user_id", userId)
        .eq("reason", activitySlug)
        .gte("created_at", today.toISOString())
        .limit(1);

      if (todaysLog && todaysLog.length > 0) {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return {
          can_perform: false,
          reason: "Already claimed today",
          next_available_at: tomorrow.toISOString(),
        };
      }
    }

    // Weekly activities - check if already done this week
    if (activity.cooldown_type === "weekly") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: weeklyLog } = await supabase
        .from("points_log")
        .select("id")
        .eq("user_id", userId)
        .eq("reason", activitySlug)
        .gte("created_at", weekAgo.toISOString())
        .limit(1);

      if (weeklyLog && weeklyLog.length > 0) {
        return { can_perform: false, reason: "Already claimed this week" };
      }
    }

    // Unlimited with daily cap - check daily count
    if (activity.cooldown_type === "unlimited" && activity.max_per_day) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: dailyActivities, error: countError } = await supabase
        .from("points_log")
        .select("id")
        .eq("user_id", userId)
        .eq("reason", activitySlug)
        .gte("created_at", today.toISOString());

      if (
        !countError &&
        dailyActivities &&
        dailyActivities.length >= activity.max_per_day
      ) {
        return {
          can_perform: false,
          reason: `Daily limit reached (${activity.max_per_day}/day)`,
          daily_count: dailyActivities.length,
          max_per_day: activity.max_per_day,
        };
      }

      return {
        can_perform: true,
        daily_count: dailyActivities?.length || 0,
        max_per_day: activity.max_per_day,
      };
    }

    // Per-target activities (e.g. per listing, per event): duplicate checking is
    // handled at the call site, which passes the related_id.

    return { can_perform: true };
  } catch (error) {
    console.error("Error checking activity eligibility:", error);
    return { can_perform: false, reason: "Error checking eligibility" };
  }
}

/**
 * Check if user ranked up and award badge if applicable
 */
export async function checkAndProcessRankUp(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  newTotalXP: number,
): Promise<XPAwardResult["new_rank"] | undefined> {
  try {
    // Get all active ranks ordered by XP requirement
    const { data: ranks } = await supabase
      .from("ranks")
      .select("id, name, slug, color, benefits, min_xp_required")
      .eq("is_active", true)
      .order("min_xp_required", { ascending: true });

    if (!ranks || ranks.length === 0) return undefined;

    // Find the highest rank user qualifies for
    let newRank = ranks[0]; // At least Explorer (0 XP)
    for (const rank of ranks) {
      if (newTotalXP >= rank.min_xp_required) {
        newRank = rank;
      } else {
        break;
      }
    }

    // Check current rank
    const { data: currentRankEntry } = await supabase
      .from("user_ranks")
      .select("rank_id")
      .eq("user_id", userId)
      .eq("current_rank", true)
      .single();

    // Rank up detected
    if (!currentRankEntry || currentRankEntry.rank_id !== newRank.id) {
      // Keep rank transition idempotent under concurrent writes.
      await supabase
        .from("user_ranks")
        .update({ current_rank: false })
        .eq("user_id", userId)
        .eq("current_rank", true)
        .neq("rank_id", newRank.id);

      const { error: upsertRankError } = await supabase
        .from("user_ranks")
        .upsert(
          {
            user_id: userId,
            rank_id: newRank.id,
            current_rank: true,
          },
          {
            onConflict: "user_id,rank_id",
          },
        );

      if (upsertRankError) {
        console.error("Rank upsert warning:", upsertRankError);
      }

      await supabase
        .from("user_ranks")
        .update({ current_rank: false })
        .eq("user_id", userId)
        .eq("current_rank", true)
        .neq("rank_id", newRank.id);

      // Get or create badge for this rank
      const { data: rankBadge } = await supabase
        .from("badges")
        .select("id")
        .eq("name", `${newRank.name} Badge`)
        .limit(1)
        .single();

      // Award badge (ignore if already awarded - composite PK error handled gracefully)
      if (rankBadge) {
        // Insert will fail silently if user already has this badge due to composite PK
        try {
          await supabase.from("user_badges").insert({
            user_id: userId,
            badge_id: rankBadge.id as number,
          });
        } catch (_e) {
          // Already has badge - that's okay
          console.log("User already has this badge");
        }
      }

      return {
        id: newRank.id,
        name: newRank.name,
        slug: newRank.slug,
        color: newRank.color || "#000000",
        benefits: (newRank.benefits as string[]) || [],
      };
    }

    return undefined;
  } catch (error) {
    console.error("Error checking rank-up:", error);
    return undefined;
  }
}

/**
 * Award XP to a user
 */
export async function awardXP(
  userId: string,
  activitySlug: string,
  relatedId?: string | number,
  customPoints?: number,
): Promise<
  XPAwardResult | { error: string; details?: string; status?: number }
> {
  // Get service role client for writes
  const supabase = await createServerSupabase({ useServiceRole: true });

  // Get activity definition and validate
  const { data: activity, error: activityError } = await supabase
    .from("xp_activities")
    .select("id, xp_value, cooldown_type, max_per_day")
    .eq("activity_slug", activitySlug)
    .eq("is_active", true)
    .single();

  if (activityError || !activity) {
    return {
      error: "Activity not found or inactive",
      details: activityError?.message,
      status: 404,
    };
  }

  // Check eligibility
  // Note: For per_target, we assume the caller has verified uniqueness if needed (e.g. one review per listing)
  // Or we could implement it here if we query points_log by related_id
  if (activity.cooldown_type === "per_target" && relatedId) {
    const relatedIdInt =
      typeof relatedId === "string" ? parseInt(relatedId) : relatedId;

    const { data: existing } = await supabase
      .from("points_log")
      .select("id")
      .eq("user_id", userId)
      .eq("reason", activitySlug)
      .eq("related_id", relatedIdInt)
      .limit(1);

    if (existing && existing.length > 0) {
      return {
        error: "Activity already performed for this target",
        status: 409, // Conflict
      };
    }
  }

  const eligibility = await checkActivityEligibility(
    supabase,
    userId,
    activitySlug,
  );
  if (!eligibility.can_perform) {
    return {
      error: eligibility.reason || "Not eligible",
      status: 403,
    };
  }

  // Determine points to award
  const pointsToAward =
    customPoints !== undefined ? customPoints : activity.xp_value;

  // Log to points_log - this will trigger the profile update
  // NOTE: points_log table does NOT have a metadata column
  const { error: logError } = await supabase.from("points_log").insert({
    user_id: userId,
    points: pointsToAward,
    reason: activitySlug,
    related_id: relatedId
      ? typeof relatedId === "string"
        ? parseInt(relatedId)
        : relatedId
      : null,
  });

  if (logError) {
    console.error("Warning: Failed to log XP activity:", logError);

    if ((logError as { code?: string }).code === "23505") {
      return {
        error: "Activity already recorded",
        details: (logError as { message?: string }).message,
        status: 409,
      };
    }

    return {
      error: "Failed to award XP",
      details: logError.message,
      status: 500,
    };
  }

  // Get updated user XP (updated by trigger)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("points")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return {
      error: "User profile not found",
      details: profileError?.message,
      status: 404,
    };
  }

  const newXP = profile.points || 0;

  // Check for rank-up
  const newRank = await checkAndProcessRankUp(supabase, userId, newXP);

  return {
    success: true,
    xp_awarded: pointsToAward,
    new_total: newXP,
    rank_up: !!newRank,
    new_rank: newRank || undefined,
  };
}

/**
 * Get user-friendly name for an activity slug
 */
export function getFriendlyActivityName(slug: string): string {
  const mapping: Record<string, string> = {
    // Review related
    react_review: "Reacted to a review",
    leave_review: "Wrote a review",

    // Visit/Location related
    visit_location: "Visited a location",
    check_in: "Checked in",

    // Auth/Profile related
    daily_login: "Daily login reward",
    complete_profile: "Completed profile",

    // Engagement
    share_listing: "Shared a listing",
    refer_friend: "Referred a friend",
  };

  return mapping[slug] || slug;
}
