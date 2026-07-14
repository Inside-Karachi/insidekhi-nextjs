import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyBusinessOwner } from "@/lib/business-owner/api-utils";

// DELETE: Cancel a pending change request
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await verifyBusinessOwner();
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
    const { rows: requestRows } = await query(
      `SELECT * FROM listing_change_requests WHERE id = $1 AND requested_by = $2`,
      [requestId, userId],
    );
    const request = requestRows[0];

    if (!request) {
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
    try {
      await query(`DELETE FROM listing_change_requests WHERE id = $1`, [
        requestId,
      ]);
    } catch (deleteError) {
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
