import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { canModerateShares } from "@/lib/auth/gamification-permissions";
import type { UserRole } from "@/types/auth.types";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    // Check authentication
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user has permission (admin or super_admin only)
    const { rows: profileRows } = await query(
      "SELECT role FROM public.profiles WHERE id = $1 LIMIT 1",
      [session.userId]
    );
    const profile = profileRows[0] as { role: UserRole } | undefined;

    if (!profile || !canModerateShares(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden - Insufficient permissions" },
        { status: 403 }
      );
    }

    // Fetch pending shares
    const { rows: shares } = await query(
      `SELECT * FROM public.social_shares
       WHERE verification_status = 'pending'
       ORDER BY created_at ASC
       LIMIT 50`
    );

    // Manually fetch user profiles for each share
    const userIds = Array.from(
      new Set(shares.map((s) => s.user_id).filter(Boolean))
    );

    let profiles: { id: string; full_name: string | null; avatar_url: string | null }[] = [];
    if (userIds.length > 0) {
      try {
        const { rows: profileRowsForShares } = await query(
          `SELECT id, full_name, avatar_url FROM public.profiles WHERE id = ANY($1::uuid[])`,
          [userIds]
        );
        profiles = profileRowsForShares as typeof profiles;
      } catch (profilesError) {
        console.error("Error fetching profiles:", profilesError);
      }
    }

    // Screenshots are uploaded to a public-read Spaces path (see
    // /api/shares/upload-screenshot), so screenshot_url is already directly
    // usable - no signing needed.
    const sharesWithProfiles = shares.map((share) => ({
      ...share,
      profiles: profiles.find((p) => p.id === share.user_id),
    }));

    return NextResponse.json({
      success: true,
      shares: sharesWithProfiles,
    });
  } catch (error) {
    console.error("Unexpected error in pending shares:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
