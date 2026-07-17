import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// GET /api/organizer/form-data - Get categories for event forms
// Accessible by organizers, listers, and admins
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    // Verify user has organizer role or higher
    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId]
    );
    const profile = profileRows[0];

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }

    if (
      !["organizer", "lister", "admin", "super_admin"].includes(profile.role)
    ) {
      return NextResponse.json(
        { success: false, error: "Organizer access required" },
        { status: 403 },
      );
    }

    // Events are self-contained (native location), so forms only need
    // categories now - venue/listing pickers were removed.
    const result: {
      success: boolean;
      categories?: { id: number; name: string; slug: string }[];
    } = { success: true };

    try {
      const { rows: categoryRows } = await query(
        `SELECT id, name, slug FROM categories ORDER BY name ASC`
      );
      result.categories = categoryRows.map((row) => ({
        ...row,
        id: Number(row.id),
      }));
    } catch (error) {
      console.error("Error fetching categories:", error);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in organizer form-data GET:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
