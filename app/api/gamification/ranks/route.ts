import { getSessionFromCookies } from "@/lib/auth/session";
/**
 * GET /api/gamification/ranks - Fetch all active ranks
 * PUT /api/gamification/ranks/:id - Update rank (super_admin only)
 * POST /api/gamification/ranks - Create new rank (super_admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { RankUpsertRequest } from "@/types/gamification.types";

/**
 * GET all active ranks with user's current rank and progress
 */
export async function GET(_request: NextRequest) {
  const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const supabase = await createServerSupabase();

    // Get all active ranks
    const { data: ranks, error: ranksError } = await supabase
      .from("ranks")
      .select(
        "id, name, slug, color, icon_url, min_xp_required, max_slots, benefits, display_order, is_active"
      )
      .eq("is_active", true)
      .order("min_xp_required", { ascending: true });

    if (ranksError) {
      return NextResponse.json(
        { error: "Failed to fetch ranks", details: ranksError.message },
        { status: 500 }
      );
    }

    // Get authenticated user if present
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let userRankInfo = null;

    if (user) {
      // Get user's XP
      const { data: profile } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", session.userId)
        .single();

      const userXP = profile?.points || 0;

      // Get user's current rank
      const { data: userRankData } = await supabase
        .from("user_ranks")
        .select("rank_id, achieved_at")
        .eq("user_id", session.userId)
        .eq("current_rank", true)
        .single();

      if (userRankData) {
        const currentRank = ranks?.find((r) => r.id === userRankData.rank_id);
        const nextRank = ranks?.find((r) => r.min_xp_required > userXP);

        userRankInfo = {
          current_rank: currentRank,
          next_rank: nextRank || null,
          current_xp: userXP,
          xp_to_next_rank: nextRank ? nextRank.min_xp_required - userXP : 0,
          progress_percent: nextRank
            ? Math.round(
                ((userXP - (currentRank?.min_xp_required || 0)) /
                  (nextRank.min_xp_required -
                    (currentRank?.min_xp_required || 0))) *
                  100
              )
            : 100,
        };
      }
    }

    return NextResponse.json({
      ranks: ranks || [],
      user_rank_info: userRankInfo,
    });
  } catch (error) {
    console.error("Error fetching ranks:", error);
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
 * POST create new rank (super_admin only)
 */
export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // Get authenticated user
    const supabase = await createServerSupabase({ useServiceRole: true });
    const {
      data: { user },
      error: authError,
    } = await (await createServerSupabase()).auth.getUser();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify super_admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.userId)
      .single();

    if (profile?.role !== "super_admin") {
      return NextResponse.json(
        { error: "Super admin access required" },
        { status: 403 }
      );
    }

    // Parse request
    const body: RankUpsertRequest = await request.json();
    const {
      name,
      slug,
      min_xp_required,
      max_slots,
      color,
      benefits,
      display_order,
      is_active,
    } = body;

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json(
        { error: "Missing required fields: name, slug" },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const { data: existing } = await supabase
      .from("ranks")
      .select("id")
      .eq("slug", slug)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "Slug already exists" },
        { status: 409 }
      );
    }

    // Insert new rank
    const { data: newRank, error: insertError } = await supabase
      .from("ranks")
      .insert({
        name,
        slug,
        min_xp_required: min_xp_required || 0,
        max_slots: max_slots || null,
        color: color || "#000000",
        benefits: benefits || [],
        display_order: display_order || 0,
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to create rank", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(newRank, { status: 201 });
  } catch (error) {
    console.error("Error creating rank:", error);
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
 * PUT update rank (super_admin only)
 */
export async function PUT(request: NextRequest) {
  const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // Get authenticated user
    const supabaseAuth = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service role for updates
    const supabase = await createServerSupabase({ useServiceRole: true });

    // Verify super_admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.userId)
      .single();

    if (profile?.role !== "super_admin") {
      return NextResponse.json(
        { error: "Super admin access required" },
        { status: 403 }
      );
    }

    // Parse request - extract rank_id from URL if using search params
    const rankId = request.nextUrl.searchParams.get("id");
    if (!rankId) {
      return NextResponse.json(
        { error: "Missing rank id parameter" },
        { status: 400 }
      );
    }

    // Parse update data
    const body: Partial<RankUpsertRequest> = await request.json();

    // Update rank
    const { data: updatedRank, error: updateError } = await supabase
      .from("ranks")
      .update(body)
      .eq("id", parseInt(rankId))
      .select()
      .single();

    if (updateError || !updatedRank) {
      return NextResponse.json(
        { error: "Failed to update rank", details: updateError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedRank);
  } catch (error) {
    console.error("Error updating rank:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
