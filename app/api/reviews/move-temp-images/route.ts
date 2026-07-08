import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

// Service role client (bypasses RLS)
const getServiceClient = () => {
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
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
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
    if (user.id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const serviceClient = getServiceClient();
    const successfulMoves: Array<{ oldPath: string; newPath: string }> = [];
    const failedMoves: Array<{ oldPath: string; error: string }> = [];

    // Process each temp image
    for (const img of tempImages) {
      if (!img.tempFileName) continue;

      // Security: ensure the file belongs to the authenticated user's temp folder
      const expectedPrefix = `temp/${user.id}/`;
      if (!img.tempFileName.startsWith(expectedPrefix)) {
        return NextResponse.json(
          { error: "Invalid file path" },
          { status: 403 },
        );
      }

      try {
        // Generate permanent path
        const fileExt = img.tempFileName.split(".").pop();
        const newFileName = `reviews/${reviewId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Move file from temp to permanent location
        const { error: moveError } = await serviceClient.storage
          .from("review-images")
          .move(img.tempFileName, newFileName);

        if (moveError) {
          failedMoves.push({
            oldPath: img.tempFileName,
            error: moveError.message,
          });
          continue;
        }

        // Get new public URL
        const { data: publicUrlData } = serviceClient.storage
          .from("review-images")
          .getPublicUrl(newFileName);

        // Save to database
        const { error: dbError } = await serviceClient
          .from("review_images")
          .insert({
            review_id: reviewId,
            image_url: publicUrlData.publicUrl,
            uploaded_by: userId,
          });

        if (dbError) {
          console.error("Failed to save image to DB:", dbError);
          // Try to delete the moved file since DB insert failed
          await serviceClient.storage
            .from("review-images")
            .remove([newFileName]);

          failedMoves.push({
            oldPath: img.tempFileName,
            error: "Database insert failed",
          });
          continue;
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
