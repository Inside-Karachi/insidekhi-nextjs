/**
 * GET /api/gamification/challenges - Get active challenges for user with progress
 * POST /api/gamification/challenges - Create new challenge (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActiveChallenge } from "@/types/gamification.types";
import { isGamificationOperatorRole } from "@/lib/auth/gamification-permissions";

/**
 * GET - Fetch active challenges with user's progress
 */
export async function GET() {
  try {
    const supabase = await createServerSupabase();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date().toISOString();

    // Get active challenges (currently running)
    const { data: challenges, error: challengesError } = await supabase
      .from("weekly_challenges")
      .select("*")
      .eq("is_active", true)
      .lte("start_date", now)
      .gte("end_date", now)
      .order("start_date", { ascending: false });

    if (challengesError) {
      return NextResponse.json(
        {
          error: "Failed to fetch challenges",
          details: challengesError.message,
        },
        { status: 500 }
      );
    }

    if (!challenges || challenges.length === 0) {
      return NextResponse.json({ challenges: [] });
    }

    // Get user's progress for these challenges
    const challengeIds = challenges.map((c) => c.id);
    const { data: progressData } = await supabase
      .from("user_challenge_progress")
      .select("*")
      .eq("user_id", user.id)
      .in("challenge_id", challengeIds);

    // Combine challenges with progress
    const activeChallenges: ActiveChallenge[] = challenges.map((challenge) => {
      const progress = progressData?.find(
        (p) => p.challenge_id === challenge.id
      );

      const endDate = new Date(challenge.end_date);
      const nowTime = new Date();
      const daysRemaining = Math.ceil(
        (endDate.getTime() - nowTime.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        challenge_type: challenge.challenge_type,
        xp_reward: challenge.xp_reward,
        target_count: challenge.target_count,
        start_date: challenge.start_date,
        end_date: challenge.end_date,
        current_progress: progress?.current_progress || 0,
        is_completed: progress?.completed || false,
        days_remaining: Math.max(0, daysRemaining),
      };
    });

    return NextResponse.json({ challenges: activeChallenges });
  } catch (error) {
    console.error("Challenges GET error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Create new challenge (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase({ useServiceRole: true });

    // Get authenticated user
    const authSupabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await authSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !isGamificationOperatorRole(profile.role)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      title,
      description,
      challenge_type,
      xp_reward,
      target_count,
      start_date,
      end_date,
      is_active = true,
      auto_activate = false,
      metadata = {},
    } = body;

    // Validate required fields
    if (
      !title ||
      !description ||
      !challenge_type ||
      !xp_reward ||
      !target_count ||
      !start_date ||
      !end_date
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: title, description, challenge_type, xp_reward, target_count, start_date, end_date",
        },
        { status: 400 }
      );
    }

    // Validate dates
    const startDateTime = new Date(start_date);
    const endDateTime = new Date(end_date);

    if (endDateTime <= startDateTime) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 }
      );
    }

    // Create challenge
    const { data: newChallenge, error: insertError } = await supabase
      .from("weekly_challenges")
      .insert({
        title,
        description,
        challenge_type,
        xp_reward,
        target_count,
        start_date,
        end_date,
        created_by: user.id,
        is_active,
        auto_activate,
        metadata,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to create challenge", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        challenge: newChallenge,
        message: "Challenge created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Challenges POST error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
