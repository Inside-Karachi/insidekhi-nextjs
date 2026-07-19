import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { copyFile, deleteFile, getPublicUrl } from "@/lib/storage/spaces";

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

    const successfulMoves: Array<{ oldPath: string; newPath: string }> = [];
    const failedMoves: Array<{ oldPath: string; error: string }> = [];

    // Process each temp image
    for (const img of tempImages) {
      if (!img.tempFileName) continue;

      // Security: ensure the file belongs to the authenticated user's temp folder
      const expectedPrefix = `review-images/temp/${session.userId}/`;
      if (!img.tempFileName.startsWith(expectedPrefix)) {
        return NextResponse.json(
          { error: "Invalid file path" },
          { status: 403 },
        );
      }

      try {
        // Generate permanent path and copy within DigitalOcean Spaces
        const fileExt = img.tempFileName.split(".").pop();
        const newFileName = `review-images/${reviewId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        try {
          await copyFile(img.tempFileName, newFileName);
        } catch (uploadError) {
          failedMoves.push({
            oldPath: img.tempFileName,
            error:
              uploadError instanceof Error
                ? uploadError.message
                : "Copy failed",
          });
          continue;
        }

        const publicUrl = getPublicUrl(newFileName);

        // Save to database
        try {
          await query(
            `INSERT INTO review_images (review_id, image_url, uploaded_by) VALUES ($1, $2, $3)`,
            [reviewId, publicUrl, userId],
          );
        } catch (dbError) {
          console.error("Failed to save image to DB:", dbError);
          // Try to delete the copied file since DB insert failed
          try {
            await deleteFile(newFileName);
          } catch {
            // best-effort cleanup
          }
          failedMoves.push({
            oldPath: img.tempFileName,
            error: "Database insert failed",
          });
          continue;
        }

        // Clean up the temp file now that the permanent copy exists
        try {
          await deleteFile(img.tempFileName);
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
