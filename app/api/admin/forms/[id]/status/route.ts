import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireStaff, getAdminAuthErrorStatus } from "@/lib/auth/admin";

interface UpdateStatusPayload {
  status: string;
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15
    const params = await props.params;
    const submissionId = parseInt(params.id);

    if (isNaN(submissionId)) {
      return NextResponse.json(
        { error: "Invalid submission ID" },
        { status: 400 }
      );
    }

    await requireStaff(request);

    // Parse request body
    const body: UpdateStatusPayload = await request.json();
    const { status } = body;

    if (!status?.trim()) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    // Validate status value - must match database constraint
    const validStatuses = [
      "pending",
      "in_review",
      "reviewed",
      "contacted",
      "approved",
      "rejected",
      "resolved",
      "dismissed",
      "completed",
      "closed",
      "n/a",
    ];

    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Update submission status
    try {
      await query(
        `UPDATE form_submissions SET status = $1 WHERE id = $2`,
        [status, submissionId],
      );
    } catch (updateError) {
      console.error("Error updating status:", updateError);
      return NextResponse.json(
        { error: "Failed to update submission status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Status updated to "${status}"`,
    });
  } catch (error) {
    const authStatus = getAdminAuthErrorStatus(error);
    if (authStatus) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: authStatus }
      );
    }
    console.error("Update status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
