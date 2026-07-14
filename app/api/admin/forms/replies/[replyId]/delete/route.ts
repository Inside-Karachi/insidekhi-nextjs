import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ replyId: string }> }
) {
  try {
    const { replyId } = await props.params;
    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get("hard") === "true";
    const reason = searchParams.get("reason");

    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId],
    );
    const profile = profileRows[0];

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
    let result: unknown;
    try {
      const fnName = hardDelete ? "hard_delete_reply" : "soft_delete_reply";
      const { rows } = await query(
        `SELECT ${fnName}(
           p_reply_id => $1::uuid,
           p_deleted_by => $2::uuid,
           p_deletion_reason => $3::text
         ) AS result`,
        [replyId, session.userId, reason || null],
      );
      result = rows[0]?.result;
    } catch (rpcError) {
      console.error("RPC error:", rpcError);
      return NextResponse.json(
        {
          error:
            rpcError instanceof Error
              ? rpcError.message
              : "Failed to delete reply",
        },
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
