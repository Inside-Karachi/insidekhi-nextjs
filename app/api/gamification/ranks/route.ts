/**
 * GET /api/gamification/ranks - Fetch all active ranks
 * PUT /api/gamification/ranks/:id - Update rank (super_admin only)
 * POST /api/gamification/ranks - Create new rank (super_admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";
import type { RankUpsertRequest } from "@/types/gamification.types";

/**
 * GET all active ranks with user's current rank and progress
 */
export async function GET(_request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // Get all active ranks
    let ranks;
    try {
      const { rows } = await query(
        `SELECT id, name, slug, color, icon_url, min_xp_required, max_slots, benefits, display_order, is_active
         FROM public.ranks
         WHERE is_active = true
         ORDER BY min_xp_required ASC`,
      );
      ranks = rows;
    } catch (ranksError) {
      return NextResponse.json(
        {
          error: "Failed to fetch ranks",
          details:
            ranksError instanceof Error ? ranksError.message : "Unknown error",
        },
        { status: 500 }
      );
    }

    // Get user's XP and current rank
    let userRankInfo = null;

    const { rows: profileRows } = await query(
      `SELECT points FROM public.profiles WHERE id = $1 LIMIT 1`,
      [session.userId],
    );
    const userXP = profileRows[0]?.points || 0;

    const { rows: userRankRows } = await query(
      `SELECT rank_id, achieved_at
       FROM public.user_ranks
       WHERE user_id = $1 AND current_rank = true
       LIMIT 1`,
      [session.userId],
    );
    const userRankData = userRankRows[0] as { rank_id: number } | undefined;

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
    // Verify super_admin role
    const { rows: profileRows } = await query(
      `SELECT role FROM public.profiles WHERE id = $1 LIMIT 1`,
      [session.userId],
    );
    const profile = profileRows[0] as { role: string } | undefined;

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
    const { rows: existing } = await query(
      `SELECT id FROM public.ranks WHERE slug = $1 LIMIT 1`,
      [slug],
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Slug already exists" },
        { status: 409 }
      );
    }

    // Insert new rank
    let newRank;
    try {
      const { rows } = await query(
        `INSERT INTO public.ranks
           (name, slug, min_xp_required, max_slots, color, benefits, display_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          name,
          slug,
          min_xp_required || 0,
          max_slots || null,
          color || "#000000",
          JSON.stringify(benefits || []),
          display_order || 0,
          is_active !== false,
        ],
      );
      newRank = rows[0];
    } catch (insertError) {
      return NextResponse.json(
        {
          error: "Failed to create rank",
          details:
            insertError instanceof Error ? insertError.message : "Unknown error",
        },
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
    // Verify super_admin role
    const { rows: profileRows } = await query(
      `SELECT role FROM public.profiles WHERE id = $1 LIMIT 1`,
      [session.userId],
    );
    const profile = profileRows[0] as { role: string } | undefined;

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

    // Build a dynamic SET clause from only the provided fields, using our own
    // fixed column names (never user-provided text) for the column side.
    const allowedFields: Array<keyof RankUpsertRequest> = [
      "name",
      "slug",
      "min_xp_required",
      "max_slots",
      "color",
      "benefits",
      "display_order",
      "is_active",
    ];
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (field in body) {
        setClauses.push(`${field} = $${paramIndex}`);
        const value = body[field];
        values.push(field === "benefits" ? JSON.stringify(value ?? []) : value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { error: "Failed to update rank", details: "No fields to update" },
        { status: 500 }
      );
    }

    values.push(parseInt(rankId));

    let updatedRank;
    try {
      const { rows } = await query(
        `UPDATE public.ranks SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
        values,
      );
      updatedRank = rows[0];
    } catch (updateError) {
      return NextResponse.json(
        {
          error: "Failed to update rank",
          details:
            updateError instanceof Error ? updateError.message : "Unknown error",
        },
        { status: 500 }
      );
    }

    if (!updatedRank) {
      return NextResponse.json(
        { error: "Failed to update rank", details: undefined },
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
