import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch XP directly from profiles for real-time accuracy
    const { rows: profiles } = await query(
      "SELECT points FROM public.profiles WHERE id = $1 LIMIT 1",
      [session.userId]
    );

    const xpTotal = profiles[0]?.points || 0;

    // Get user's current rank from user_ranks
    const { rows: userRanks } = await query(
      `SELECT r.name 
       FROM user_ranks ur
       LEFT JOIN ranks r ON ur.rank_id = r.id
       WHERE ur.user_id = $1 AND ur.current_rank = true
       LIMIT 1`,
      [session.userId]
    );

    const rankName = userRanks[0]?.name || "Unranked";

    return NextResponse.json({
      xpTotal,
      rank: rankName,
    });
  } catch (error) {
    console.error("Gamification API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
