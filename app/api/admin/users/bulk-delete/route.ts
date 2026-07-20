import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/admin";
import { query } from "@/lib/db";

interface BulkDeleteRequestBody {
  userIds: string[];
}

interface DeleteUserResult {
  success: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Enforce super admin access
    const { user: currentUser } = await requireSuperAdmin(request);

    const body = (await request.json()) as Partial<BulkDeleteRequestBody>;
    const ids = Array.isArray(body.userIds)
      ? body.userIds.filter((v): v is string => typeof v === "string")
      : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "userIds array is required" },
        { status: 400 }
      );
    }

    // Safety: do not allow deleting your own account
    const targetIds = ids.filter((id) => id !== currentUser.id);
    if (targetIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Cannot delete current authenticated user" },
        { status: 400 }
      );
    }

    // Optional cap to prevent accidental massive deletes
    if (targetIds.length > 200) {
      return NextResponse.json(
        { success: false, error: "Too many users in one request (max 200)" },
        { status: 413 }
      );
    }

    const successes: string[] = [];
    const failures: Array<{ id: string; error: string }> = [];

    // Delete users sequentially to keep error handling simple and predictable
    for (const id of targetIds) {
      try {
        const { rows } = await query(
          `SELECT delete_user_completely($1, $2) AS result`,
          [id, currentUser.id],
        );
        const result = rows[0]?.result as DeleteUserResult | undefined;

        if (!result?.success) {
          failures.push({ id, error: result?.error || "Deletion failed" });
          continue;
        }

        // delete_user_completely only cleans up the public schema; the
        // auth.users row is deleted separately (not FK-linked to profiles).
        await query(`DELETE FROM auth.users WHERE id = $1`, [id]);
        successes.push(id);
      } catch (e) {
        failures.push({
          id,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      deletedCount: successes.length,
      failedCount: failures.length,
      failed: failures,
    });
  } catch (error) {
    console.error("Bulk delete users error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
