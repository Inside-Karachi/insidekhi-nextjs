import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(
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

    // Check for include_deleted query param
    const url = new URL(request.url);
    const includeDeleted = url.searchParams.get("include_deleted") === "true";

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

    // Fetch replies using the RPC function
    // Note: p_include_deleted defaults to false (excludes soft-deleted replies)
    const { data: replies, error } = await adminSupabase.rpc(
      "get_submission_replies_with_details" as never,
      {
        p_submission_id: submissionId,
        p_include_deleted: includeDeleted,
      } as never
    );

    if (error) {
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
    console.error("Replies API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
