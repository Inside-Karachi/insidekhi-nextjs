import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { isGamificationOperatorRole } from "@/lib/auth/gamification-permissions";

/**
 * GET - List active challenges and user progress
 */
export async function GET(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabase()) as any;

    // Get optional authenticated user to show their progress
    const session = await getSessionFromCookies();

    // Fetch active challenges
    const { data: challenges, error: fetchError } = await supabase
      .from("xp_challenges")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to fetch challenges", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!session?.userId) {
      // Return challenges without progress for unauthenticated users
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const challengesWithProgress = challenges.map((c: any) => ({
        ...c,
        user_progress: {
          current_count: 0,
          is_completed: false,
        },
      }));
      return NextResponse.json({ success: true, challenges: challengesWithProgress });
    }

    // Fetch user progress for these challenges
    const { data: progress, error: progressError } = await supabase
      .from("user_challenges")
      .select("challenge_id, current_count, is_completed, completed_at")
      .eq("user_id", session.userId);

    if (progressError) {
      // Don't fail the whole request, just return challenges without progress
      console.error("Failed to fetch user challenge progress:", progressError);
      return NextResponse.json({ success: true, challenges });
    }

    // Map progress to challenges
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const progressMap = new Map(progress.map((p: any) => [p.challenge_id, p]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const challengesWithProgress = challenges.map((challenge: any) => {
      const userProgress = progressMap.get(challenge.id) || {
        current_count: 0,
        is_completed: false,
      };
      return {
        ...challenge,
        user_progress: userProgress,
      };
    });

    return NextResponse.json({ success: true, challenges: challengesWithProgress });
  } catch (error) {
    console.error("GET challenges error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST - Create new challenge (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabase({ useServiceRole: true })) as any;

    // Get authenticated user
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.userId)
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
      activity_slug,
      start_date,
      end_date,
      is_active,
    } = body;

    // Validate required fields
    if (!title || !challenge_type || !xp_reward || !target_count) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Insert challenge
    const { data: challenge, error: insertError } = await supabase
      .from("xp_challenges")
      .insert({
        title,
        description,
        challenge_type,
        xp_reward,
        target_count,
        activity_slug: activity_slug || null,
        created_by: session.userId,
        start_date: start_date || null,
        end_date: end_date || null,
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to create challenge", details: insertError.message },
        { status: 500 }
      );
    }

    // Log audit event
    try {
      const { logAuditEvent } = await import("@/lib/audit");
      await logAuditEvent({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        action: "create_challenge" as any,
        user_id: session.userId,
        entity_type: "xp_challenge",
        entity_id: challenge.id.toString(),
        new_values: challenge,
      });
    } catch (auditError) {
      console.error("Failed to log audit event:", auditError);
    }

    return NextResponse.json({ success: true, challenge });
  } catch (error) {
    console.error("POST challenge error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
