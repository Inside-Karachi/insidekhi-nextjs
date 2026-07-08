import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function DELETE(
  request: Request,
  props: { params: Promise<{ replyId: string }> }
) {
  try {
    const { replyId } = await props.params;
    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get("hard") === "true";
    const reason = searchParams.get("reason");

    const supabase = await createServerSupabase();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service role for admin operations
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Verify role based on delete type
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Hard delete requires super_admin
    if (hardDelete && profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Super admin access required for permanent deletion" },
        { status: 403 }
      );
    }

    // Soft delete requires admin or super_admin
    if (!hardDelete && !["admin", "super_admin"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Call appropriate RPC function
    const rpcFunction = hardDelete ? "hard_delete_reply" : "soft_delete_reply";
    const { data: result, error: rpcError } = await adminSupabase.rpc(
      rpcFunction as unknown as never,
      {
        p_reply_id: replyId,
        p_deleted_by: user.id,
        p_deletion_reason: reason || null,
      } as never
    );

    if (rpcError) {
      console.error("RPC error:", rpcError);
      return NextResponse.json(
        { error: rpcError.message || "Failed to delete reply" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result,
      deletion_type: hardDelete ? "permanent" : "soft",
    });
  } catch (error) {
    console.error("Delete reply API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
