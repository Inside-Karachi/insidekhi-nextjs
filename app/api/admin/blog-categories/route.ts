import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireStaff, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import { generateSlug } from "@/lib/utils/export-import-utils";

export const dynamic = "force-dynamic";

// GET - list all blog categories (including disabled), for admin management
export async function GET(request: NextRequest) {
  try {
    await requireStaff(request);

    const { rows } = await query(
      `SELECT id, name, slug, description, is_enabled, display_order
       FROM blog_categories
       ORDER BY display_order ASC, name ASC`,
    );

    return NextResponse.json({
      success: true,
      data: rows.map((c) => ({ ...c, id: Number(c.id) })),
    });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status },
      );
    }
    console.error("Error in blog-categories GET:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

const createCategorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  description: z.string().max(500).nullish(),
  display_order: z.number().int().nullish(),
});

// POST - create a blog category
export async function POST(request: NextRequest) {
  try {
    await requireStaff(request);

    const body = await request.json();
    const validationResult = createCategorySchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }
    const { name, description, display_order } = validationResult.data;

    const baseSlug = generateSlug(name);
    const { rows: existingRows } = await query(
      `SELECT slug FROM blog_categories WHERE slug = $1`,
      [baseSlug],
    );
    const slug = existingRows[0] ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

    const { rows } = await query(
      `INSERT INTO blog_categories (name, slug, description, display_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, slug, description, is_enabled, display_order`,
      [name, slug, description || null, display_order ?? 0],
    );

    return NextResponse.json({
      success: true,
      data: { ...rows[0], id: Number(rows[0].id) },
    });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status },
      );
    }
    console.error("Error in blog-categories POST:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
