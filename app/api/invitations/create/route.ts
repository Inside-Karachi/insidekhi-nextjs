import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { z } from "zod";
import type { CreateInvitationResponse } from "@/types/invite-share.types";
import {
  generateInvitationEmailTemplate,
  generateInvitationEmailText,
} from "@/lib/emails/invitation-template";

const createInvitationSchema = z.object({
  invitee_email: z.string().email("Invalid email address"),
});

type CreateInvitationRpcResult = {
  success: boolean;
  invite_code?: string;
  invite_token?: string;
  expires_at?: string;
  error?: string;
};

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
    const validation = createInvitationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const { invitee_email } = validation.data;

    // Get client IP
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : "unknown";

    // create_invitation() is SECURITY DEFINER and falls back to the
    // explicit p_inviter_id parameter when auth.uid() is unset (which it
    // always is over a direct pg connection), so this is safe to call as-is.
    let result: CreateInvitationRpcResult;
    try {
      const { rows } = await query(
        // Positional args must match create_invitation(p_invitee_email,
        // p_inviter_ip, p_inviter_id) - reorder here if that signature changes.
        `SELECT create_invitation($1, $2::inet, $3) AS result`,
        [invitee_email, ip, session.userId]
      );
      result = rows[0].result ?? { success: false, error: "Failed to create invitation" };
    } catch (error) {
      console.error("Error creating invitation:", error);

      // Translate technical database errors to user-friendly messages
      let userMessage = "Failed to create invitation";
      const pgError = error as { code?: string; message?: string };

      // PostgreSQL error code 23505 = unique constraint violation
      if (pgError.code === "23505") {
        if (pgError.message?.includes("unique_inviter_email")) {
          userMessage =
            "You've already sent an invitation to this email address";
        } else {
          userMessage = "This invitation already exists";
        }
      }
      // PostgreSQL error code 23503 = foreign key violation
      else if (pgError.code === "23503") {
        userMessage = "Invalid user reference";
      }
      // PostgreSQL error code 23502 = not null violation
      else if (pgError.code === "23502") {
        userMessage = "Missing required information";
      }
      // Use the message from the RPC if it's user-friendly
      else if (
        pgError.message &&
        !pgError.message.includes("violates") &&
        !pgError.message.includes("constraint")
      ) {
        userMessage = pgError.message;
      }

      return NextResponse.json(
        {
          success: false,
          error: userMessage,
        },
        { status: 400 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to create invitation",
        },
        { status: 400 }
      );
    }

    // Generate invite URL
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/signup?invite=${result.invite_token}`;

    // Get inviter's profile for email
    const { rows: profileRows } = await query(
      `SELECT full_name FROM profiles WHERE id = $1`,
      [session.userId]
    );
    const inviterProfile = profileRows[0];

    const inviterName = inviterProfile?.full_name || "A friend";
    const inviterEmail = session.email || "";

    // Extract invitee name from email (first part before @)
    const inviteeName =
      invitee_email.split("@")[0].charAt(0).toUpperCase() +
      invitee_email.split("@")[0].slice(1);

    // Send invitation email via Brevo
    try {
      const htmlContent = generateInvitationEmailTemplate({
        inviteeName,
        inviterName,
        inviterEmail,
        inviteCode: result.invite_code!,
        inviteUrl,
        expiresAt: result.expires_at!,
      });

      const textContent = generateInvitationEmailText({
        inviteeName,
        inviterName,
        inviterEmail,
        inviteCode: result.invite_code!,
        inviteUrl,
        expiresAt: result.expires_at!,
      });

      const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": process.env.BREVO_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: "Inside Karachi",
            email:
              process.env.BREVO_SENDER_EMAIL || "noreply@insidekarachi.com",
          },
          to: [
            {
              email: invitee_email,
              name: inviteeName,
            },
          ],
          subject: `${inviterName} invited you to Inside Karachi! 🎉`,
          htmlContent,
          textContent,
        }),
      });

      if (!brevoResponse.ok) {
        const errorData = await brevoResponse.json();
        console.error("Brevo email error:", errorData);
        // Don't fail the invitation creation if email fails
        console.warn("Invitation created but email failed to send:", errorData);
      } else {
        console.log("Invitation email sent successfully to:", invitee_email);
      }
    } catch (emailError) {
      // Log but don't fail - invitation is already created
      console.error("Failed to send invitation email:", emailError);
    }

    const response: CreateInvitationResponse = {
      success: true,
      data: {
        invite_code: result.invite_code!,
        invite_url: inviteUrl,
        expires_at: result.expires_at!,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error in create invitation:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
