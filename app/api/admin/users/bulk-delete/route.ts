import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/admin";
import { createServerSupabase } from "@/lib/supabase/server";

interface BulkDeleteRequestBody {
  userIds: string[];
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

    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    const successes: string[] = [];
    const failures: Array<{ id: string; error: string }> = [];

    // Delete auth users sequentially to keep error handling simple and predictable
    for (const id of targetIds) {
      try {
        const { error } = await adminSupabase.auth.admin.deleteUser(id);
        if (error) {
          failures.push({ id, error: String(error.message || error) });
        } else {
          successes.push(id);
        }
      } catch (e) {
        failures.push({
          id,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    // Best-effort cleanup of profiles for successfully deleted auth users
    if (successes.length > 0) {
      try {
        await adminSupabase.from("profiles").delete().in("id", successes);
      } catch {
        // ignore cleanup failures; auth user deletion already succeeded
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
