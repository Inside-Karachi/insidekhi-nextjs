import { createServerSupabase } from "@/lib/supabase/server";
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

const verifyShareSchema = z.object({
  share_id: z.number().int().positive(),
  status: z.enum(["verified", "rejected"]),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
    const supabase = await createServerSupabase();
  try {    // Check authentication
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user has permission (admin or super_admin only)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.userId)
      .single();

    if (
      profileError ||
      !profile ||
      !canModerateShares(profile.role)
    ) {
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

    // verify_social_share is SECURITY DEFINER / service_role-only because it
    // updates the sharer's profile.points row (cross-user, can't go through RLS).
    // We create the admin client here and reuse it for the notification below.
    const supabaseAdmin = await createServerSupabase({ useServiceRole: true });

    // Fetch share owner info BEFORE verification (to ensure we have it for notification)
    const { data: shareData, error: shareError } = await supabase
      .from("social_shares")
      .select("user_id")
      .eq("id", share_id)
      .single();

    if (shareError || !shareData) {
      console.error("Error fetching share owner:", shareError);
      // We continue with verification but notification might fail
    }

    // Call RPC via service_role. Pass the caller's UID explicitly - the function
    // cannot rely on auth.uid() when invoked through the service_role key.
    const { data, error } = await supabaseAdmin.rpc("verify_social_share", {
      p_share_id: share_id,
      p_verification_status: status,
      p_verification_notes: notes || undefined,
      p_verifier_id: session.userId,
    });

    if (error) {
      console.error("Error verifying share:", error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Failed to verify share",
        },
        { status: 400 }
      );
    }

    // RPC returns JSONB
    const result = data as {
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
        const { data: recipientProfile } = await supabaseAdmin
          .from("profiles")
          .select("role")
          .eq("id", shareData.user_id)
          .single();

        const recipientRole =
          (recipientProfile?.role as NotificationUserRole) || "public_user";
        const categorySlug = await resolveCategorySlugForRole(
          supabaseAdmin,
          recipientRole
        );

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

        await createNotification(
          {
            recipientId: shareData.user_id,
            roleScope: recipientRole,
            categorySlug,
            title,
            body: bodyContent,
            ctaLabel: "View Details",
            ctaUrl,
            priority: "normal",
          },
          { supabase: supabaseAdmin }
        );
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
