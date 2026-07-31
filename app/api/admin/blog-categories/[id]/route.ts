import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireStaff, getAdminAuthErrorStatus } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateCategorySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).nullish(),
  is_enabled: z.boolean().optional(),
  display_order: z.number().int().optional(),
});

// PUT - update a blog category
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    await requireStaff(request);

    const { id } = await params;
    const categoryId = parseInt(id, 10);
    if (isNaN(categoryId)) {
      return NextResponse.json(
        { success: false, error: "Invalid category ID" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validationResult = updateCategorySchema.safeParse(body);
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
    const data = validationResult.data;

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(data)) {
      setClauses.push(`${key} = $${idx++}`);
      values.push(value);
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 },
      );
    }
    values.push(categoryId);

    const { rows } = await query(
      `UPDATE blog_categories SET ${setClauses.join(", ")} WHERE id = $${idx}
       RETURNING id, name, slug, description, is_enabled, display_order`,
      values,
    );

    if (!rows[0]) {
      return NextResponse.json(
        { success: false, error: "Category not found" },
        { status: 404 },
      );
    }

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
    console.error("Error in blog-categories PUT:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE - remove a blog category (blocked while posts still reference it, via ON DELETE RESTRICT)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireStaff(request);

    const { id } = await params;
    const categoryId = parseInt(id, 10);
    if (isNaN(categoryId)) {
      return NextResponse.json(
        { success: false, error: "Invalid category ID" },
        { status: 400 },
      );
    }

    try {
      const { rowCount } = await query(`DELETE FROM blog_categories WHERE id = $1`, [
        categoryId,
      ]);
      if (!rowCount) {
        return NextResponse.json(
          { success: false, error: "Category not found" },
          { status: 404 },
        );
      }
    } catch (deleteError) {
      if ((deleteError as { code?: string })?.code === "23503") {
        return NextResponse.json(
          {
            success: false,
            error: "Cannot delete a category that still has posts assigned to it",
          },
          { status: 409 },
        );
      }
      throw deleteError;
    }

    return NextResponse.json({ success: true, message: "Category deleted" });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status },
      );
    }
    console.error("Error in blog-categories DELETE:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
