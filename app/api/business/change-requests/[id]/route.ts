import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyBusinessOwner } from "@/lib/business-owner/api-utils";

// DELETE: Cancel a pending change request
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await verifyBusinessOwner();
    const supabase = await createServerSupabase();
    const { id } = await context.params;
    const requestId = parseInt(id, 10);

    if (isNaN(requestId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request ID",
        },
        { status: 400 },
      );
    }

    // Verify ownership and that request is still pending
    const { data: request, error: fetchError } = await supabase
      .from("listing_change_requests")
      .select("*")
      .eq("id", requestId)
      .eq("requested_by", userId)
      .single();

    if (fetchError || !request) {
      return NextResponse.json(
        {
          success: false,
          error: "Change request not found",
        },
        { status: 404 },
      );
    }

    // Only pending requests can be cancelled
    if (request.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot cancel ${request.status} request`,
        },
        { status: 400 },
      );
    }

    // Delete the request (or you could update status to 'cancelled' if you add that status)
    const { error: deleteError } = await supabase
      .from("listing_change_requests")
      .delete()
      .eq("id", requestId);

    if (deleteError) {
      console.error("Error deleting change request:", deleteError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to cancel change request",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        message: "Change request cancelled successfully",
      },
    });
  } catch (error) {
    console.error("Error in DELETE /api/business/change-requests/[id]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      {
        status:
          error instanceof Error && error.message.includes("Unauthorized")
            ? 401
            : 500,
      },
    );
  }
}
