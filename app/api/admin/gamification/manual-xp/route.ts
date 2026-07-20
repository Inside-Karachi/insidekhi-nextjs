import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { awardXP } from "@/lib/gamification";
import { logAuditEvent } from "@/lib/audit";
import { isGamificationOperatorRole } from "@/lib/auth/gamification-permissions";

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin role
    const { rows: adminProfileRows } = await query(
      `SELECT role FROM public.profiles WHERE id = $1 LIMIT 1`,
      [session.userId],
    );
    const adminProfile = adminProfileRows[0] as { role: string } | undefined;

    if (!adminProfile || !isGamificationOperatorRole(adminProfile.role)) {
      return NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { user_id, activity_slug, reason, related_id } = body;

    // Validate required fields
    if (!user_id || !activity_slug) {
      return NextResponse.json(
        { error: "user_id and activity_slug are required" },
        { status: 400 }
      );
    }

    // Verify target user exists
    const { rows: targetUserRows } = await query(
      `SELECT id, full_name FROM public.profiles WHERE id = $1 LIMIT 1`,
      [user_id],
    );
    const targetUser = targetUserRows[0];

    if (!targetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    // Verify activity exists and is active
    const { rows: activityRows } = await query(
      `SELECT activity_slug, activity_name, xp_value, is_active
       FROM public.xp_activities
       WHERE activity_slug = $1
       LIMIT 1`,
      [activity_slug],
    );
    const activity = activityRows[0];

    if (!activity) {
      return NextResponse.json(
        { error: "Activity not found" },
        { status: 404 }
      );
    }

    if (!activity.is_active) {
      return NextResponse.json(
        { error: "Activity is not active" },
        { status: 400 }
      );
    }

    // Award XP
    const xpResult = await awardXP(user_id, activity_slug, related_id);

    if ("error" in xpResult) {
      return NextResponse.json(
        {
          success: false,
          error: xpResult.error,
          details: xpResult.details,
        },
        { status: xpResult.status || 500 }
      );
    }

    // Log audit event
    await logAuditEvent({
      action: "admin_bulk_operation",
      user_id: session.userId,
      entity_type: "xp_award",
      entity_id: user_id,
      metadata: {
        operation: "manual_xp_award",
        target_user_id: user_id,
        target_user_name: targetUser.full_name,
        activity_slug,
        activity_name: activity.activity_name,
        xp_awarded: xpResult.xp_awarded,
        admin_reason: reason || null,
        related_id: related_id || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully awarded ${xpResult.xp_awarded} XP to ${targetUser.full_name}`,
      data: {
        user: {
          id: targetUser.id,
          name: targetUser.full_name,
        },
        activity: {
          slug: activity_slug,
          name: activity.activity_name,
        },
        xp_awarded: xpResult.xp_awarded,
        new_total: xpResult.new_total,
        rank_up: xpResult.rank_up,
        new_rank: xpResult.new_rank,
      },
    });
  } catch (error) {
    console.error("Manual XP award error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
