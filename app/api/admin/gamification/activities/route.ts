/**
 * GET /api/admin/gamification/activities - List all XP activities
 * PUT /api/admin/gamification/activities/:slug - Update XP activity (super_admin only)
 * POST /api/admin/gamification/activities - Create new activity (super_admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";
import type { XPActivityUpsertRequest } from "@/types/gamification.types";
import {
  isGamificationOperatorRole,
} from "@/lib/auth/gamification-permissions";
import type { UserRole } from "@/types/auth.types";

/**
 * Verify user is super_admin
 */
async function verifySuperAdmin(userId: string): Promise<boolean> {
  const { rows } = await query(
    `SELECT role FROM public.profiles WHERE id = $1 LIMIT 1`,
    [userId],
  );
  return rows[0]?.role === "super_admin";
}

/**
 * GET all XP activities (authenticated users can see, admins get full details)
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rows: profileRows } = await query(
      `SELECT role FROM public.profiles WHERE id = $1 LIMIT 1`,
      [session.userId],
    );
    const profile = profileRows[0] as { role: UserRole } | undefined;

    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isAdmin = isGamificationOperatorRole(profile.role);
    if (!isAdmin) {
      // Return only basic info for public users
      const { rows: activities } = await query(
        `SELECT activity_slug, activity_name, description, xp_value
         FROM public.xp_activities
         WHERE is_active = true`,
      );
      return NextResponse.json({ success: true, activities });
    }

    // Return full details for admins
    const { rows: activities } = await query(
      `SELECT * FROM public.xp_activities ORDER BY created_at DESC`,
    );
    return NextResponse.json({ success: true, activities });
  } catch (error) {
    console.error("GET activities error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch activities",
      },
      { status: 500 }
    );
  }
}

/**
 * POST create new XP activity (super_admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify super_admin role
    const isSuperAdmin = await verifySuperAdmin(session.userId);

    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: "Super admin access required" },
        { status: 403 }
      );
    }

    // Parse request
    const body: XPActivityUpsertRequest = await request.json();
    const {
      activity_slug,
      activity_name,
      description,
      xp_value,
      cooldown_type,
      max_per_day,
      is_active,
    } = body;

    // Validate required fields
    if (!activity_slug || !activity_name || !xp_value || !cooldown_type) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: activity_slug, activity_name, xp_value, cooldown_type",
        },
        { status: 400 }
      );
    }

    // Insert activity
    const { rows: insertedRows } = await query(
      `INSERT INTO public.xp_activities
         (activity_slug, activity_name, description, xp_value, cooldown_type, max_per_day, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        activity_slug,
        activity_name,
        description || null,
        xp_value,
        cooldown_type,
        max_per_day || null,
        is_active !== false,
      ],
    );
    const activity = insertedRows[0];

    // Log audit event
    try {
      const { logAuditEvent } = await import("@/lib/audit");
      await logAuditEvent({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        action: "create_xp_activity" as any,
        user_id: session.userId,
        entity_type: "xp_activity",
        entity_id: activity_slug,
        new_values: activity,
      });
    } catch (auditErr) {
      console.error("Failed to log audit event:", auditErr);
    }

    return NextResponse.json({ success: true, activity });
  } catch (error) {
    console.error("POST activity error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create activity" },
      { status: 500 }
    );
  }
}

/**
 * PUT update XP activity (super_admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify super_admin role
    const isSuperAdmin = await verifySuperAdmin(session.userId);

    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: "Super admin access required" },
        { status: 403 }
      );
    }

    // Parse request
    const body: XPActivityUpsertRequest = await request.json();
    const {
      activity_slug,
      activity_name,
      description,
      xp_value,
      cooldown_type,
      max_per_day,
      is_active,
    } = body;

    if (!activity_slug) {
      return NextResponse.json(
        { error: "activity_slug is required" },
        { status: 400 }
      );
    }

    // Fetch old activity for audit log
    const { rows: oldActivityRows } = await query(
      `SELECT * FROM public.xp_activities WHERE activity_slug = $1 LIMIT 1`,
      [activity_slug],
    );
    const oldActivity = oldActivityRows[0];

    if (!oldActivity) {
      return NextResponse.json(
        { error: "Activity not found" },
        { status: 404 }
      );
    }

    // Update activity - only set fields that were provided (matches the old
    // Supabase `.update()` semantics of leaving `undefined` fields untouched).
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (activity_name) {
      setClauses.push(`activity_name = $${paramIndex++}`);
      values.push(activity_name);
    }
    if (description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (xp_value !== undefined) {
      setClauses.push(`xp_value = $${paramIndex++}`);
      values.push(xp_value);
    }
    if (cooldown_type) {
      setClauses.push(`cooldown_type = $${paramIndex++}`);
      values.push(cooldown_type);
    }
    if (max_per_day !== undefined) {
      setClauses.push(`max_per_day = $${paramIndex++}`);
      values.push(max_per_day);
    }
    if (is_active !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    let activity = oldActivity;
    if (setClauses.length > 0) {
      values.push(activity_slug);
      const { rows } = await query(
        `UPDATE public.xp_activities SET ${setClauses.join(", ")} WHERE activity_slug = $${paramIndex} RETURNING *`,
        values,
      );
      activity = rows[0];
    }

    // Log audit event
    try {
      const { logAuditEvent } = await import("@/lib/audit");
      await logAuditEvent({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        action: "update_xp_activity" as any,
        user_id: session.userId,
        entity_type: "xp_activity",
        entity_id: activity_slug,
        old_values: oldActivity,
        new_values: activity,
      });
    } catch (auditErr) {
      console.error("Failed to log audit event:", auditErr);
    }

    return NextResponse.json({ success: true, activity });
  } catch (error) {
    console.error("PUT activity error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update activity" },
      { status: 500 }
    );
  }
}
