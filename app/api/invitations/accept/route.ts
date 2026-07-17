import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { z } from "zod";
import type { AcceptInvitationResponse } from "@/types/invite-share.types";

const acceptInvitationSchema = z.object({
  invite_token: z.string().min(1, "Invite token is required"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = acceptInvitationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const { invite_token } = validation.data;

    // Get client IP
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : "unknown";

    // accept_invitation() is SECURITY DEFINER and falls back to the explicit
    // p_invitee_id parameter when auth.uid() is unset (which it always is
    // over a direct pg connection), so this is safe to call as-is.
    let result: { success: boolean; message?: string; error?: string };
    try {
      const { rows } = await query(
        // Positional args must match accept_invitation(p_invite_token,
        // p_invitee_ip, p_invitee_id) - reorder here if that signature changes.
        `SELECT accept_invitation($1, $2::inet, $3) AS result`,
        [invite_token, ip, session.userId]
      );
      result = rows[0].result ?? { success: false, error: "Failed to accept invitation" };
    } catch (error) {
      console.error("Error accepting invitation:", error);
      const message =
        error instanceof Error ? error.message : "Failed to accept invitation";
      return NextResponse.json(
        {
          success: false,
          error: message,
        },
        { status: 400 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to accept invitation",
        },
        { status: 400 }
      );
    }

    const response: AcceptInvitationResponse = {
      success: true,
      message: result.message || "Invitation accepted!",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error in accept invitation:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
