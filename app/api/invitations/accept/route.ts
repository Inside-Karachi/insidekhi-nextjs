import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { z } from "zod";
import type { AcceptInvitationResponse } from "@/types/invite-share.types";

const acceptInvitationSchema = z.object({
  invite_token: z.string().min(1, "Invite token is required"),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const serviceSupabase = await createServerSupabase({
      useServiceRole: true,
    });

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

    const { data, error } = await serviceSupabase.rpc("accept_invitation", {
      p_invite_token: invite_token,
      p_invitee_ip: ip,
      p_invitee_id: user.id,
    });

    if (error) {
      console.error("Error accepting invitation:", error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Failed to accept invitation",
        },
        { status: 400 }
      );
    }

    // RPC returns JSONB
    const result = data as {
      success: boolean;
      message?: string;
      error?: string;
    };

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
