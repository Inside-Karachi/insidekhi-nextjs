/**
 * GET /api/admin/gamification/activities - List all XP activities
 * PUT /api/admin/gamification/activities/:slug - Update XP activity (super_admin only)
 * POST /api/admin/gamification/activities - Create new activity (super_admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import type { XPActivityUpsertRequest } from "@/types/gamification.types";
import {
  canManageGamificationSettings,
  isGamificationOperatorRole,
} from "@/lib/auth/gamification-permissions";

/**
 * Verify user is super_admin
 */
async function verifySuperAdmin(
  userId: string,
  supabase: Awaited<ReturnType<typeof createServerSupabase>>
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  return profile?.role === "super_admin";
}

/**
 * GET all XP activities (authenticated users can see, admins get full details)
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminSupabase = await createServerSupabase({
      useServiceRole: true,
    });
    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", session.userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isAdmin = isGamificationOperatorRole(profile.role);
    if (!isAdmin) {
      // Return only basic info for public users
      const { data: activities, error } = await supabase
        .from("xp_activities")
        .select("activity_slug, activity_name, description, xp_value")
        .eq("is_active", true);

      if (error) throw error;
      return NextResponse.json({ success: true, activities });
    }

    // Return full details for admins
    const { data: activities, error } = await adminSupabase
      .from("xp_activities")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, activities });
  } catch (error: any) {
    console.error("GET activities error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch activities",
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
    const supabase = await createServerSupabase({ useServiceRole: true });
    const isSuperAdmin = await verifySuperAdmin(session.userId, supabase);

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
    const { data: activity, error } = await supabase
      .from("xp_activities")
      .insert({
        activity_slug,
        activity_name,
        description: description || null,
        xp_value,
        cooldown_type,
        max_per_day: max_per_day || null,
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) throw error;

    // Log audit event
    try {
      const { logAuditEvent } = await import("@/lib/audit");
      await logAuditEvent({
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
  } catch (error: any) {
    console.error("POST activity error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create activity" },
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
    const supabase = await createServerSupabase({ useServiceRole: true });
    const isSuperAdmin = await verifySuperAdmin(session.userId, supabase);

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
    const { data: oldActivity } = await supabase
      .from("xp_activities")
      .select("*")
      .eq("activity_slug", activity_slug)
      .single();

    if (!oldActivity) {
      return NextResponse.json(
        { error: "Activity not found" },
        { status: 404 }
      );
    }

    // Update activity
    const { data: activity, error } = await supabase
      .from("xp_activities")
      .update({
        activity_name: activity_name || undefined,
        description: description !== undefined ? description : undefined,
        xp_value: xp_value !== undefined ? xp_value : undefined,
        cooldown_type: cooldown_type || undefined,
        max_per_day: max_per_day !== undefined ? max_per_day : undefined,
        is_active: is_active !== undefined ? is_active : undefined,
      })
      .eq("activity_slug", activity_slug)
      .select()
      .single();

    if (error) throw error;

    // Log audit event
    try {
      const { logAuditEvent } = await import("@/lib/audit");
      await logAuditEvent({
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
  } catch (error: any) {
    console.error("PUT activity error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update activity" },
      { status: 500 }
    );
  }
}
