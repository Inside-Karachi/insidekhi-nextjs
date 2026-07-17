import { createServerSupabase } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { z } from "zod";
import type { CreateShareResponse } from "@/types/invite-share.types";

const createShareSchema = z.object({
  content_type: z.enum(["listing", "event"]),
  content_id: z.number().int().positive(),
  content_title: z.string().min(1),
  content_url: z.string().min(1),
  platform: z.enum([
    "facebook",
    "twitter",
    "linkedin",
    "instagram",
    "whatsapp",
    "copy_link",
    "other",
  ]),
  verification_method: z.enum(["screenshot", "tracking_url", "oauth"]),
});

export async function POST(request: NextRequest) {
  try {    const serviceSupabase = await createServerSupabase({
      useServiceRole: true,
    });

    // Check authentication
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = createShareSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const {
      content_type,
      content_id,
      content_title,
      content_url,
      platform,
      verification_method,
    } = validation.data;

    const { data, error } = await serviceSupabase.rpc("create_share_record", {
      p_content_type: content_type,
      p_content_id: content_id,
      p_content_title: content_title,
      p_content_url: content_url,
      p_platform: platform,
      p_verification_method: verification_method,
      p_user_id: session.userId,
    });

    if (error) {
      console.error("Error creating share:", error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Failed to create share",
        },
        { status: 400 }
      );
    }

    // RPC returns JSONB
    const result = data as {
      success: boolean;
      share_id?: number;
      tracking_url?: string;
      xp_amount?: number;
      requires_verification?: boolean;
      error?: string;
    };

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to create share",
        },
        { status: 400 }
      );
    }

    const response: CreateShareResponse = {
      success: true,
      data: {
        share_id: result.share_id!,
        tracking_url: result.tracking_url,
        xp_amount: result.xp_amount!,
        requires_verification: result.requires_verification ?? true,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error in create share:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
