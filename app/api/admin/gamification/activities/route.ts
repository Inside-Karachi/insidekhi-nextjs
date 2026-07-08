/**
 * GET /api/admin/gamification/activities - List all XP activities
 * PUT /api/admin/gamification/activities/:slug - Update XP activity (super_admin only)
 * POST /api/admin/gamification/activities - Create new activity (super_admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
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
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminSupabase = await createServerSupabase({
      useServiceRole: true,
    });
    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isAdmin = isGamificationOperatorRole(profile.role);
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Get all active activities
    const { data: activities, error } = await supabase
      .from("xp_activities")
      .select("*")
      .eq("is_active", true)
      .order("activity_slug");

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch activities", details: error.message },
        { status: 500 }
      );
    }

    // If user is super_admin, also get inactive activities
    let allActivities = activities || [];
    const isSuperAdmin = canManageGamificationSettings(profile.role);
    if (isSuperAdmin) {
      const { data: allData } = await adminSupabase
        .from("xp_activities")
        .select("*")
        .order("activity_slug");
      allActivities = allData || [];
    }

    return NextResponse.json({
      activities: allActivities,
      total: allActivities.length,
      is_admin: isSuperAdmin,
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
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
 * POST create new XP activity (super_admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabaseAuth = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify super_admin role
    const supabase = await createServerSupabase({ useServiceRole: true });
    const isSuperAdmin = await verifySuperAdmin(user.id, supabase);

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

    // Check if activity_slug already exists
    const { data: existing } = await supabase
      .from("xp_activities")
      .select("id")
      .eq("activity_slug", activity_slug)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "Activity slug already exists" },
        { status: 409 }
      );
    }

    // Insert new activity
    const { data: newActivity, error: insertError } = await supabase
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

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to create activity", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(newActivity, { status: 201 });
  } catch (error) {
    console.error("Error creating activity:", error);
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
 * PUT update XP activity (super_admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    // Get authenticated user
    const supabaseAuth = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service role for updates
    const supabase = await createServerSupabase({ useServiceRole: true });

    // Verify super_admin role
    const isSuperAdmin = await verifySuperAdmin(user.id, supabase);
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: "Super admin access required" },
        { status: 403 }
      );
    }

    // Get activity slug from URL search params
    const slug = request.nextUrl.searchParams.get("slug");
    if (!slug) {
      return NextResponse.json(
        { error: "Missing slug parameter" },
        { status: 400 }
      );
    }

    // Parse update data
    const body: Partial<XPActivityUpsertRequest> = await request.json();

    // Update activity
    const { data: updatedActivity, error: updateError } = await supabase
      .from("xp_activities")
      .update(body)
      .eq("activity_slug", slug)
      .select()
      .single();

    if (updateError || !updatedActivity) {
      return NextResponse.json(
        { error: "Failed to update activity", details: updateError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedActivity);
  } catch (error) {
    console.error("Error updating activity:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
