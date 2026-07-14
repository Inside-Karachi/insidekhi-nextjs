import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireStaff, getAdminAuthErrorStatus } from "@/lib/auth/admin";

export async function GET(
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

    // Check for include_deleted query param
    const url = new URL(request.url);
    const includeDeleted = url.searchParams.get("include_deleted") === "true";

    await requireStaff(request);

    // Fetch replies using the RPC function
    // Note: p_include_deleted defaults to false (excludes soft-deleted replies)
    let replies: unknown[];
    try {
      const { rows } = await query(
        `SELECT * FROM get_submission_replies_with_details(
           p_submission_id => $1::integer,
           p_include_deleted => $2::boolean
         )`,
        [submissionId, includeDeleted],
      );
      replies = rows;
    } catch (error) {
      console.error("Error fetching replies:", error);
      return NextResponse.json(
        { error: "Failed to fetch replies" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      replies: replies || [],
    });
  } catch (error) {
    const authStatus = getAdminAuthErrorStatus(error);
    if (authStatus) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: authStatus }
      );
    }
    console.error("Replies API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
