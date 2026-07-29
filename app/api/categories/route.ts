import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { rows: categories } = await query(
      `SELECT id, name, slug, parent_id, icon_name
       FROM categories
       ORDER BY name ASC`,
    );

    const categoryOptions = categories.map((category) => ({
      value: String(category.id),
      label: category.name as string,
      slug: category.slug as string,
      parentId: category.parent_id ? String(category.parent_id) : null,
      iconName: category.icon_name as string | null,
    }));

    const response = NextResponse.json({
      success: true,
      categories: categoryOptions,
      count: categoryOptions.length,
    });

    response.headers.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate",
    );

    return response;
  } catch (error) {
    console.error("API error fetching categories:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
