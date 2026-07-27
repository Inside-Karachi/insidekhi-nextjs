import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";
import { isGamificationOperatorRole } from "@/lib/auth/gamification-permissions";
import type { UserRole } from "@/types/auth.types";

/**
 * GET - List active challenges and user progress
 */
export async function GET(_request: NextRequest) {
  try {
    // Get optional authenticated user to show their progress
    const session = await getSessionFromCookies();

    // Fetch active challenges
    let challenges;
    try {
      const { rows } = await query(
        `SELECT * FROM public.weekly_challenges WHERE is_active = true ORDER BY created_at DESC`,
      );
      challenges = rows;
    } catch (fetchError) {
      return NextResponse.json(
        {
          error: "Failed to fetch challenges",
          details:
            fetchError instanceof Error ? fetchError.message : "Unknown error",
        },
        { status: 500 }
      );
    }

    if (!session?.userId) {
      // Return challenges without progress for unauthenticated users
      const challengesWithProgress = challenges.map((c) => ({
        ...c,
        user_progress: {
          current_count: 0,
          is_completed: false,
        },
      }));
      return NextResponse.json({ success: true, challenges: challengesWithProgress });
    }

    // Fetch user progress for these challenges
    let progress;
    try {
      const { rows } = await query(
        `SELECT challenge_id, current_progress, completed, completed_at
         FROM public.user_challenge_progress
         WHERE user_id = $1`,
        [session.userId],
      );
      progress = rows;
    } catch (progressError) {
      // Don't fail the whole request, just return challenges without progress
      console.error("Failed to fetch user challenge progress:", progressError);
      return NextResponse.json({ success: true, challenges });
    }

    // Map progress to challenges
    const progressMap = new Map(progress.map((p) => [p.challenge_id, p]));
    const challengesWithProgress = challenges.map((challenge) => {
      const userProgress = progressMap.get(challenge.id);
      return {
        ...challenge,
        user_progress: {
          current_count: userProgress?.current_progress ?? 0,
          is_completed: userProgress?.completed ?? false,
          completed_at: userProgress?.completed_at ?? null,
        },
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
    // Get authenticated user
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin role
    const { rows: profileRows } = await query(
      `SELECT role FROM public.profiles WHERE id = $1 LIMIT 1`,
      [session.userId],
    );
    const profile = profileRows[0] as { role: UserRole } | undefined;

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
    let challenge;
    try {
      const { rows } = await query(
        `INSERT INTO public.weekly_challenges
           (title, description, challenge_type, xp_reward, target_count, created_by, start_date, end_date, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          title,
          description ?? null,
          challenge_type,
          xp_reward,
          target_count,
          session.userId,
          start_date || null,
          end_date || null,
          is_active !== false,
        ],
      );
      challenge = rows[0];
    } catch (insertError) {
      return NextResponse.json(
        {
          error: "Failed to create challenge",
          details:
            insertError instanceof Error ? insertError.message : "Unknown error",
        },
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
