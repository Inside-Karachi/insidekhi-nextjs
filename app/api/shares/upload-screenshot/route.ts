import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import type { UploadScreenshotResponse } from "@/types/invite-share.types";

export const dynamic = "force-dynamic";

// Helper to get supabaseAdmin lazily
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}


export async function POST(request: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const shareId = formData.get("share_id") as string;

    if (!file || !shareId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing file or share_id",
        },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        {
          success: false,
          error: "File must be an image",
        },
        { status: 400 }
      );
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: "File size must be under 5MB",
        },
        { status: 400 }
      );
    }

    // Get authenticated user using proper SSR method
    const supabase = await createServerSupabase();

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

    // Verify share belongs to user
    const { data: share, error: shareError } = await supabase
      .from("social_shares")
      .select("id, user_id")
      .eq("id", parseInt(shareId))
      .single();

    if (shareError || !share || share.user_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Share not found or unauthorized",
        },
        { status: 404 }
      );
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `share_${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await getSupabaseAdmin().storage
      .from("share-screenshots")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to upload screenshot",
        },
        { status: 500 }
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = getSupabaseAdmin().storage.from("share-screenshots").getPublicUrl(filePath);

    // Call RPC to update share with screenshot
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "upload_share_screenshot",
      {
        p_share_id: parseInt(shareId),
        p_screenshot_url: publicUrl,
      }
    );

    if (rpcError) {
      console.error("RPC error:", rpcError);
      return NextResponse.json(
        {
          success: false,
          error: rpcError.message || "Failed to update share",
        },
        { status: 400 }
      );
    }

    // RPC returns JSONB
    const result = rpcData as {
      success: boolean;
      message?: string;
      error?: string;
    };

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to upload screenshot",
        },
        { status: 400 }
      );
    }

    const response: UploadScreenshotResponse = {
      success: true,
      message: result.message || "Screenshot uploaded successfully",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error in upload screenshot:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
