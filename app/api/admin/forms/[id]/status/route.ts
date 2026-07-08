import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

interface UpdateStatusPayload {
  status: string;
}

export async function PATCH(
  request: Request,
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

    const supabase = await createServerSupabase();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service role to bypass RLS for admin operations
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Verify admin/staff role
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      !profile ||
      !["admin", "super_admin", "lister", "writer"].includes(profile.role)
    ) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

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
    const { error: updateError } = await adminSupabase
      .from("form_submissions")
      .update({ status })
      .eq("id", submissionId);

    if (updateError) {
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
    console.error("Update status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
