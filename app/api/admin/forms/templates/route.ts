import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireStaff, getAdminAuthErrorStatus } from "@/lib/auth/admin";

export async function GET(request: NextRequest) {
  try {
    await requireStaff(request);

    // Fetch active templates
    let templates;
    try {
      const { rows } = await query(
        `SELECT * FROM form_reply_templates WHERE is_active = true ORDER BY name ASC`,
      );
      templates = rows;
    } catch (error) {
      console.error("Error fetching templates:", error);
      return NextResponse.json(
        { error: "Failed to fetch templates" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      templates: templates || [],
    });
  } catch (error) {
    const authStatus = getAdminAuthErrorStatus(error);
    if (authStatus) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: authStatus }
      );
    }
    console.error("Templates API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
