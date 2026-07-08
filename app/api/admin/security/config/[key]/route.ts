import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/admin";

interface RouteContext {
  params: Promise<{
    key: string;
  }>;
}

// PATCH /api/admin/security/config/[key] - Update system config
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    // Verify super admin
    await requireSuperAdmin(request);

    const { key } = await context.params;
    const body = await request.json();
    const { value, description } = body;

    if (value === undefined) {
      return NextResponse.json({ error: "value is required" }, { status: 400 });
    }

    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    const updateData: Record<string, unknown> = { value };
    if (description !== undefined) {
      updateData.description = description;
    }

    const { data, error } = await adminSupabase
      .from("system_config")
      .update(updateData)
      .eq("key", key)
      .select()
      .single();

    if (error) {
      console.error("[UPDATE CONFIG API] Error:", error);
      return NextResponse.json(
        { error: "Failed to update configuration" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Configuration key not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ config: data });
  } catch (error) {
    console.error("[UPDATE CONFIG API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
