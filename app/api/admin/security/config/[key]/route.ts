import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
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

    let data;
    try {
      const { rows } =
        description !== undefined
          ? await query(
              `UPDATE public.system_config
               SET config_value = $1, description = $2, updated_at = timezone('utc', now())
               WHERE config_key = $3
               RETURNING *`,
              [JSON.stringify(value), description, key]
            )
          : await query(
              `UPDATE public.system_config
               SET config_value = $1, updated_at = timezone('utc', now())
               WHERE config_key = $2
               RETURNING *`,
              [JSON.stringify(value), key]
            );
      data = rows[0];
    } catch (updateError) {
      console.error("[UPDATE CONFIG API] Error:", updateError);
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
