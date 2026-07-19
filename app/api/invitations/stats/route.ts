import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    let stats;
    try {
      const [invitesResult, sharesResult, xpResult] = await Promise.all([
        query(
          `SELECT
             COUNT(*) AS total_invitations_sent,
             COUNT(*) FILTER (WHERE status = 'accepted') AS total_invitations_accepted,
             COUNT(*) FILTER (WHERE status = 'pending') AS pending_invitations
           FROM invitations WHERE inviter_id = $1`,
          [session.userId]
        ),
        query(
          `SELECT
             COUNT(*) AS total_shares_created,
             COUNT(*) FILTER (WHERE verification_status = 'verified') AS total_shares_verified,
             COUNT(*) FILTER (WHERE verification_status = 'rejected') AS total_shares_rejected,
             COUNT(*) FILTER (WHERE verification_status = 'pending') AS pending_shares
           FROM social_shares WHERE user_id = $1`,
          [session.userId]
        ),
        // Uses 'reason' column not 'activity'; a row's reason can match both
        // patterns (e.g. "invitation share bonus"), in which case it counts
        // toward both sums - matches the original per-row substring checks.
        query(
          `SELECT
             COALESCE(SUM(points) FILTER (WHERE reason ILIKE '%invitation%'), 0) AS total_xp_from_invites,
             COALESCE(SUM(points) FILTER (WHERE reason ILIKE '%share%'), 0) AS total_xp_from_shares
           FROM points_log WHERE user_id = $1`,
          [session.userId]
        ),
      ]);

      const invites = invitesResult.rows[0];
      const shares = sharesResult.rows[0];
      const xp = xpResult.rows[0];

      stats = {
        total_invitations_sent: parseInt(invites.total_invitations_sent, 10),
        total_invitations_accepted: parseInt(
          invites.total_invitations_accepted,
          10
        ),
        total_xp_from_invites: parseInt(xp.total_xp_from_invites, 10),
        total_shares_created: parseInt(shares.total_shares_created, 10),
        total_shares_verified: parseInt(shares.total_shares_verified, 10),
        total_shares_rejected: parseInt(shares.total_shares_rejected, 10),
        total_xp_from_shares: parseInt(xp.total_xp_from_shares, 10),
        pending_invitations: parseInt(invites.pending_invitations, 10),
        pending_shares: parseInt(shares.pending_shares, 10),
      };
    } catch (error) {
      console.error("Error fetching stats:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch statistics",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Unexpected error in invite stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
