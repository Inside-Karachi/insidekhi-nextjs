import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { z } from "zod";
import type { VerifyShareResponse } from "@/types/invite-share.types";
import {
  createNotification,
  resolveCategorySlugForRole,
} from "@/lib/notifications";
import type { NotificationUserRole } from "@/types/notifications.types";
import { canModerateShares } from "@/lib/auth/gamification-permissions";
import type { UserRole } from "@/types/auth.types";

const verifyShareSchema = z.object({
  share_id: z.number().int().positive(),
  status: z.enum(["verified", "rejected"]),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json();
    const validation = verifyShareSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const { share_id, status, notes } = validation.data;

    // Fetch share owner info BEFORE verification (to ensure we have it for notification)
    const { rows: shareRows } = await query(
      "SELECT user_id FROM public.social_shares WHERE id = $1 LIMIT 1",
      [share_id]
    );
    const shareData = shareRows[0] as { user_id: string } | undefined;

    if (!shareData) {
      console.error("Error fetching share owner: share not found", share_id);
      // We continue with verification but notification might fail
    }

    // Call verify_social_share, passing the caller's UID explicitly - the
    // function's own authorization check depends on this parameter, not a
    // session GUC / auth.uid() default.
    let rpcRows;
    try {
      ({ rows: rpcRows } = await query(
        `SELECT verify_social_share($1, $2, $3, $4) AS result`,
        [share_id, status, notes || null, session.userId]
      ));
    } catch (rpcError) {
      console.error("Error verifying share:", rpcError);
      return NextResponse.json(
        {
          success: false,
          error:
            rpcError instanceof Error
              ? rpcError.message
              : "Failed to verify share",
        },
        { status: 400 }
      );
    }

    // RPC returns JSONB
    const result = rpcRows[0]?.result as {
      success: boolean;
      xp_awarded?: number;
      error?: string;
    };

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to verify share",
        },
        { status: 400 }
      );
    }

    // Send Notification to User
    if (shareData?.user_id) {
      try {
        const { rows: recipientRows } = await query(
          "SELECT role FROM public.profiles WHERE id = $1 LIMIT 1",
          [shareData.user_id]
        );
        const recipientProfile = recipientRows[0] as { role: string } | undefined;

        const recipientRole =
          (recipientProfile?.role as NotificationUserRole) || "public_user";
        const categorySlug = await resolveCategorySlugForRole(recipientRole);

        let title = "";
        let bodyContent = "";
        const ctaUrl = null; // No user-facing page for shares yet

        if (status === "verified") {
          const xp = result.xp_awarded || 0;
          title = "Share Verified! 🎉";
          bodyContent = `Your share has been approved and you've earned ${xp} XP!`;
        } else {
          title = "Share Rejected";
          bodyContent = `Your share was not approved. ${notes ? `Reason: ${notes}` : "Please check the requirements."
            }`;
        }

        await createNotification({
          recipientId: shareData.user_id,
          roleScope: recipientRole,
          categorySlug,
          title,
          body: bodyContent,
          ctaLabel: "View Details",
          ctaUrl,
          priority: "normal",
        });
      } catch (notifyError) {
        // Don't fail the request if notification fails, just log it
        console.error("Failed to send share verification notification:", notifyError);
      }
    }

    const response: VerifyShareResponse = {
      success: true,
      xp_awarded: result.xp_awarded,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error in verify share:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
