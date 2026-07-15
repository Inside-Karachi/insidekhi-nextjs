import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

const INVITATION_COLUMNS =
  "i.id, i.inviter_id, i.invitee_email, i.invitee_id, i.invite_code, i.invite_token, " +
  "i.status, i.inviter_ip, i.invitee_ip, i.invitee_email_verified, " +
  "i.xp_awarded_to_inviter, i.xp_awarded_to_invitee, i.inviter_xp_log_id, i.invitee_xp_log_id, " +
  "to_json(i.created_at) #>> '{}' AS created_at, " +
  "to_json(i.accepted_at) #>> '{}' AS accepted_at, " +
  "to_json(i.expired_at) #>> '{}' AS expired_at";

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession(_request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    let invitations;
    try {
      const { rows } = await query(
        `SELECT ${INVITATION_COLUMNS},
           CASE WHEN p.id IS NOT NULL
             THEN json_build_object('full_name', p.full_name, 'avatar_url', p.avatar_url)
             ELSE NULL
           END AS invitee_profile
         FROM invitations i
         LEFT JOIN profiles p ON p.id = i.invitee_id
         WHERE i.inviter_id = $1 AND i.status = 'pending'
         ORDER BY i.created_at DESC`,
        [session.userId]
      );

      invitations = rows.map((row) => ({
        ...row,
        id: Number(row.id),
        inviter_xp_log_id:
          row.inviter_xp_log_id !== null ? Number(row.inviter_xp_log_id) : null,
        invitee_xp_log_id:
          row.invitee_xp_log_id !== null ? Number(row.invitee_xp_log_id) : null,
      }));
    } catch (error) {
      console.error("Error fetching invitations:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch invitations",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      invitations: invitations || [],
    });
  } catch (error) {
    console.error("Unexpected error in pending invitations:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
