import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";
import { uploadFile } from "@/lib/storage/spaces";
import type { UploadScreenshotResponse } from "@/types/invite-share.types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const shareId = formData.get("share_id") as string;

    if (!file || !shareId) {
      return NextResponse.json(
        { success: false, error: "Missing file or share_id" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: "File must be an image" },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "File size must be under 5MB" },
        { status: 400 }
      );
    }

    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify share belongs to user
    const { rows: shareRows } = await query(
      "SELECT id, user_id FROM public.social_shares WHERE id = $1 LIMIT 1",
      [parseInt(shareId)]
    );
    const share = shareRows[0] as { id: number; user_id: string } | undefined;

    if (!share || share.user_id !== session.userId) {
      return NextResponse.json(
        { success: false, error: "Share not found or unauthorized" },
        { status: 404 }
      );
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `share_${Date.now()}.${fileExt}`;
    const filePath = `share-screenshots/${session.userId}/${fileName}`;

    // Convert File to Buffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to DigitalOcean Spaces
    const { publicUrl } = await uploadFile(filePath, buffer, {
      contentType: file.type,
      isPublic: true,
    });

    // Update share record with screenshot URL
    await query(
      "UPDATE public.social_shares SET screenshot_url = $1 WHERE id = $2 AND user_id = $3",
      [publicUrl, parseInt(shareId), session.userId]
    );

    const response: UploadScreenshotResponse = {
      success: true,
      message: "Screenshot uploaded successfully",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error in upload screenshot:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
