import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch invite statistics
    const [invitesResult, sharesResult, xpResult] = await Promise.all([
      // Count invitations
      supabase
        .from("invitations")
        .select("status", { count: "exact", head: false })
        .eq("inviter_id", user.id),

      // Count shares
      supabase
        .from("social_shares")
        .select("verification_status", { count: "exact", head: false })
        .eq("user_id", user.id),

      // Get XP from points_log (uses 'reason' column not 'activity')
      supabase
        .from("points_log")
        .select("points, reason")
        .eq("user_id", user.id)
        .or("reason.ilike.%invitation%,reason.ilike.%share%"),
    ]);

    if (invitesResult.error || sharesResult.error || xpResult.error) {
      console.error("Error fetching stats:", {
        invitesResult,
        sharesResult,
        xpResult,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch statistics",
        },
        { status: 500 }
      );
    }

    const invitations = invitesResult.data || [];
    const shares = sharesResult.data || [];
    const xpLogs = xpResult.data || [];

    // Calculate statistics
    const total_invitations_sent = invitations.length;
    const total_invitations_accepted = invitations.filter(
      (inv) => inv.status === "accepted"
    ).length;
    const pending_invitations = invitations.filter(
      (inv) => inv.status === "pending"
    ).length;

    const total_shares_created = shares.length;
    const total_shares_verified = shares.filter(
      (share) => share.verification_status === "verified"
    ).length;
    const total_shares_rejected = shares.filter(
      (share) => share.verification_status === "rejected"
    ).length;
    const pending_shares = shares.filter(
      (share) => share.verification_status === "pending"
    ).length;

    const total_xp_from_invites = xpLogs
      .filter(
        (log) => log.reason?.toLowerCase().includes("invitation") || false
      )
      .reduce((sum, log) => sum + (log.points || 0), 0);

    const total_xp_from_shares = xpLogs
      .filter((log) => log.reason?.toLowerCase().includes("share") || false)
      .reduce((sum, log) => sum + (log.points || 0), 0);

    return NextResponse.json({
      success: true,
      stats: {
        total_invitations_sent,
        total_invitations_accepted,
        total_xp_from_invites,
        total_shares_created,
        total_shares_verified,
        total_shares_rejected,
        total_xp_from_shares,
        pending_invitations,
        pending_shares,
      },
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
