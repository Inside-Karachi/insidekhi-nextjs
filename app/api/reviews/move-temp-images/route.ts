import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { deleteFile as deleteSpacesFile, uploadFile } from "@/lib/storage/spaces";

// The temp review-image upload happens client-side, directly to Supabase
// Storage (components/review/ReviewCreationModal.tsx), bypassing any Next.js
// API route - so this service-role client is used only to read and clean up
// those temp files. The permanent copy is written to DigitalOcean Spaces.
const getSupabaseServiceClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { reviewId, userId, tempImages } = body;

    if (!reviewId || !userId || !Array.isArray(tempImages)) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 },
      );
    }

    // Verify user owns this review
    if (session.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const supabaseService = getSupabaseServiceClient();
    const successfulMoves: Array<{ oldPath: string; newPath: string }> = [];
    const failedMoves: Array<{ oldPath: string; error: string }> = [];

    // Process each temp image
    for (const img of tempImages) {
      if (!img.tempFileName) continue;

      // Security: ensure the file belongs to the authenticated user's temp folder
      const expectedPrefix = `temp/${session.userId}/`;
      if (!img.tempFileName.startsWith(expectedPrefix)) {
        return NextResponse.json(
          { error: "Invalid file path" },
          { status: 403 },
        );
      }

      try {
        // Download the temp file's bytes from Supabase Storage - that's
        // still where the browser upload writes it
        const { data: fileBlob, error: downloadError } =
          await supabaseService.storage
            .from("review-images")
            .download(img.tempFileName);

        if (downloadError || !fileBlob) {
          failedMoves.push({
            oldPath: img.tempFileName,
            error: downloadError?.message || "Failed to download temp file",
          });
          continue;
        }

        // Generate permanent path and upload to DigitalOcean Spaces
        const fileExt = img.tempFileName.split(".").pop();
        const newFileName = `review-images/${reviewId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const buffer = Buffer.from(await fileBlob.arrayBuffer());

        let publicUrl: string;
        try {
          const uploaded = await uploadFile(newFileName, buffer, {
            contentType: fileBlob.type || "application/octet-stream",
          });
          publicUrl = uploaded.publicUrl;
        } catch (uploadError) {
          failedMoves.push({
            oldPath: img.tempFileName,
            error:
              uploadError instanceof Error
                ? uploadError.message
                : "Upload failed",
          });
          continue;
        }

        // Save to database
        try {
          await query(
            `INSERT INTO review_images (review_id, image_url, uploaded_by) VALUES ($1, $2, $3)`,
            [reviewId, publicUrl, userId],
          );
        } catch (dbError) {
          console.error("Failed to save image to DB:", dbError);
          // Try to delete the uploaded file since DB insert failed
          try {
            await deleteSpacesFile(newFileName);
          } catch {
            // best-effort cleanup
          }
          failedMoves.push({
            oldPath: img.tempFileName,
            error: "Database insert failed",
          });
          continue;
        }

        // Clean up the temp file in Supabase Storage now that the
        // permanent copy exists in DigitalOcean Spaces
        try {
          await supabaseService.storage
            .from("review-images")
            .remove([img.tempFileName]);
        } catch (cleanupError) {
          console.error(
            `Failed to remove temp file ${img.tempFileName}:`,
            cleanupError,
          );
        }

        successfulMoves.push({
          oldPath: img.tempFileName,
          newPath: newFileName,
        });
      } catch (error) {
        console.error(`Error processing ${img.tempFileName}:`, error);
        failedMoves.push({
          oldPath: img.tempFileName,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      movedCount: successfulMoves.length,
      failedCount: failedMoves.length,
      successfulMoves,
      failedMoves,
    });
  } catch (error) {
    console.error("Move temp images error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
