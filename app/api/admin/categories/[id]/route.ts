import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit";
import {
  categoryUpdateSchema,
  generateCategorySlug,
  type Category,
} from "@/types/category.types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  icon_name: string | null;
  show_in_nav: boolean;
  show_in_featured: boolean;
  show_in_filters: boolean;
  is_enabled: boolean;
  category_type: string;
  display_order: number | null;
  gradient_style: string | null;
  created_at: string;
};

// Helper to get parent_id for a category
async function getParentId(categoryId: number): Promise<number | null> {
  const { rows } = await query(
    "SELECT parent_id FROM public.categories WHERE id = $1 LIMIT 1",
    [categoryId]
  );
  const row = rows[0] as { parent_id: number | null } | undefined;
  return row?.parent_id ?? null;
}

// Helper to check circular reference
async function checkCircularReference(
  categoryId: number,
  newParentId: number
): Promise<boolean> {
  // Cannot be own parent
  if (categoryId === newParentId) return true;

  // Walk up the parent chain
  let currentParentId: number | null = newParentId;
  let depth = 0;
  const maxDepth = 10;

  while (currentParentId !== null && depth < maxDepth) {
    if (currentParentId === categoryId) return true;
    currentParentId = await getParentId(currentParentId);
    depth++;
  }

  return false;
}

// Helper to get children count
async function getChildrenCount(categoryId: number): Promise<number> {
  const { rows } = await query(
    "SELECT COUNT(*)::int AS count FROM public.categories WHERE parent_id = $1",
    [categoryId]
  );
  return (rows[0] as { count: number })?.count ?? 0;
}

// Helper to get usage count
async function getUsageCount(
  categoryId: number
): Promise<{ listingsCount: number; eventsCount: number }> {
  const { rows: listingRows } = await query(
    "SELECT COUNT(DISTINCT listing_id)::int AS count FROM public.listing_categories WHERE category_id = $1",
    [categoryId]
  );
  const { rows: eventRows } = await query(
    "SELECT COUNT(*)::int AS count FROM public.events WHERE category_id = $1",
    [categoryId]
  );

  return {
    listingsCount: (listingRows[0] as { count: number })?.count ?? 0,
    eventsCount: (eventRows[0] as { count: number })?.count ?? 0,
  };
}

/**
 * PATCH /api/admin/categories/[id]
 * Update an existing category
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const categoryId = parseInt(id);

    if (isNaN(categoryId)) {
      return NextResponse.json(
        { success: false, error: "Invalid category ID" },
        { status: 400 }
      );
    }

    // Verify authentication
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify super_admin role
    const { rows: profileRows } = await query(
      "SELECT role FROM profiles WHERE id = $1 LIMIT 1",
      [session.userId]
    );
    const profile = profileRows[0] as { role: string } | undefined;

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    if (profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Access denied. Super admin role required." },
        { status: 403 }
      );
    }

    // Fetch existing category
    const { rows: existingRows } = await query(
      "SELECT * FROM public.categories WHERE id = $1 LIMIT 1",
      [categoryId]
    );
    const existingCategory = existingRows[0] as CategoryRow | undefined;

    if (!existingCategory) {
      return NextResponse.json(
        { success: false, error: "Category not found" },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = categoryUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const updateData = validation.data;

    // If name changes and slug not provided, regenerate slug
    if (updateData.name && !updateData.slug) {
      updateData.slug = generateCategorySlug(updateData.name);
    }

    // Check slug uniqueness (exclude current category)
    if (updateData.slug) {
      const { rows: existingSlugRows } = await query(
        "SELECT id FROM public.categories WHERE slug ILIKE $1 AND id != $2 LIMIT 1",
        [updateData.slug, categoryId]
      );

      if (existingSlugRows.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Slug '${updateData.slug}' already exists. Please choose a unique slug or try '${updateData.slug}-2'.`,
          },
          { status: 400 }
        );
      }
    }

    // Validate parent_id changes
    if (updateData.parent_id !== undefined) {
      const newParentId = updateData.parent_id;

      if (newParentId !== null) {
        // Cannot set self as parent
        if (newParentId === categoryId) {
          return NextResponse.json(
            {
              success: false,
              error: "A category cannot be its own parent.",
            },
            { status: 400 }
          );
        }

        // Check if parent exists
        const { rows: parentRows } = await query(
          "SELECT id, parent_id FROM public.categories WHERE id = $1 LIMIT 1",
          [newParentId]
        );
        const parentCategory = parentRows[0] as
          | { id: number; parent_id: number | null }
          | undefined;

        if (!parentCategory) {
          return NextResponse.json(
            {
              success: false,
              error: "Parent category not found.",
            },
            { status: 400 }
          );
        }

        // Enforce max depth (parent cannot have a parent)
        if (parentCategory.parent_id !== null) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Maximum category depth is 1 level (parent → child). The selected parent already has a parent.",
            },
            { status: 400 }
          );
        }

        // Check circular reference
        const hasCircularRef = await checkCircularReference(
          categoryId,
          newParentId
        );

        if (hasCircularRef) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Cannot set parent - this would create a circular reference.",
            },
            { status: 400 }
          );
        }

        // Check if this category has children (cannot become a child if it has children)
        const childrenCount = await getChildrenCount(categoryId);

        if (childrenCount > 0) {
          return NextResponse.json(
            {
              success: false,
              error: `Cannot set a parent for this category - it has ${childrenCount} subcategories. A category with children cannot become a subcategory (max depth is 1 level).`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Build update object (only include changed fields)
    const updates: Record<string, unknown> = {};
    if (updateData.name !== undefined) updates.name = updateData.name.trim();
    if (updateData.slug !== undefined) updates.slug = updateData.slug;
    if (updateData.parent_id !== undefined)
      updates.parent_id = updateData.parent_id;
    if (updateData.icon_name !== undefined)
      updates.icon_name = updateData.icon_name;
    if (updateData.show_in_nav !== undefined)
      updates.show_in_nav = updateData.show_in_nav;
    if (updateData.show_in_featured !== undefined)
      updates.show_in_featured = updateData.show_in_featured;
    if (updateData.show_in_filters !== undefined)
      updates.show_in_filters = updateData.show_in_filters;
    if (updateData.is_enabled !== undefined)
      updates.is_enabled = updateData.is_enabled;
    if (updateData.category_type !== undefined)
      updates.category_type = updateData.category_type;
    if (updateData.display_order !== undefined)
      updates.display_order = updateData.display_order;
    if (updateData.gradient_style !== undefined)
      updates.gradient_style = updateData.gradient_style;

    // Update category
    const updateKeys = Object.keys(updates);
    let updatedCategory: CategoryRow;

    if (updateKeys.length === 0) {
      // Nothing to update; return existing category as-is
      updatedCategory = existingCategory;
    } else {
      const setClauses = updateKeys.map((key, idx) => `${key} = $${idx + 1}`);
      const values = updateKeys.map((key) => updates[key]);
      values.push(categoryId);

      try {
        const { rows: updatedRows } = await query(
          `UPDATE public.categories
           SET ${setClauses.join(", ")}
           WHERE id = $${updateKeys.length + 1}
           RETURNING *`,
          values
        );
        updatedCategory = updatedRows[0] as CategoryRow;
      } catch (updateError) {
        console.error("Error updating category:", updateError);
        return NextResponse.json(
          { success: false, error: "Failed to update category" },
          { status: 500 }
        );
      }
    }

    // Log audit event
    await logAuditEvent({
      admin_id: session.userId,
      action: "category_updated",
      entity_type: "category",
      entity_id: categoryId.toString(),
      old_values: {
        name: existingCategory.name,
        slug: existingCategory.slug,
        parent_id: existingCategory.parent_id,
        icon_name: existingCategory.icon_name,
        show_in_nav: existingCategory.show_in_nav,
      },
      new_values: {
        name: updatedCategory.name,
        slug: updatedCategory.slug,
        parent_id: updatedCategory.parent_id,
        icon_name: updatedCategory.icon_name,
        show_in_nav: updatedCategory.show_in_nav,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedCategory as Category,
    });
  } catch (error) {
    console.error(
      "Unexpected error in PATCH /api/admin/categories/[id]:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/categories/[id]
 * Delete a category (with safety checks)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const categoryId = parseInt(id);

    if (isNaN(categoryId)) {
      return NextResponse.json(
        { success: false, error: "Invalid category ID" },
        { status: 400 }
      );
    }

    // Verify authentication
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify super_admin role
    const { rows: profileRows } = await query(
      "SELECT role FROM profiles WHERE id = $1 LIMIT 1",
      [session.userId]
    );
    const profile = profileRows[0] as { role: string } | undefined;

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    if (profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Access denied. Super admin role required." },
        { status: 403 }
      );
    }

    // Fetch existing category
    const { rows: existingRows } = await query(
      "SELECT * FROM public.categories WHERE id = $1 LIMIT 1",
      [categoryId]
    );
    const existingCategory = existingRows[0] as CategoryRow | undefined;

    if (!existingCategory) {
      return NextResponse.json(
        { success: false, error: "Category not found" },
        { status: 404 }
      );
    }

    // Check for child categories
    const childrenCount = await getChildrenCount(categoryId);

    if (childrenCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete category '${existingCategory.name}' - it has ${childrenCount} subcategories. Delete subcategories first.`,
          details: { children_count: childrenCount },
        },
        { status: 400 }
      );
    }

    // Check for listings and events using this category
    const usageStats = await getUsageCount(categoryId);

    const listingsCount = usageStats.listingsCount;
    const eventsCount = usageStats.eventsCount;

    if (listingsCount > 0 || eventsCount > 0) {
      const parts: string[] = [];
      if (listingsCount > 0) {
        parts.push(`${listingsCount} listing${listingsCount !== 1 ? "s" : ""}`);
      }
      if (eventsCount > 0) {
        parts.push(`${eventsCount} event${eventsCount !== 1 ? "s" : ""}`);
      }

      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete category '${
            existingCategory.name
          }' - ${parts.join(" and ")} depend on it.`,
          details: {
            listings_count: listingsCount,
            events_count: eventsCount,
          },
        },
        { status: 400 }
      );
    }

    // Delete category
    try {
      await query("DELETE FROM public.categories WHERE id = $1", [categoryId]);
    } catch (deleteError) {
      console.error("Error deleting category:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to delete category" },
        { status: 500 }
      );
    }

    // Log audit event
    await logAuditEvent({
      admin_id: session.userId,
      action: "category_deleted",
      entity_type: "category",
      entity_id: categoryId.toString(),
      old_values: {
        name: existingCategory.name,
        slug: existingCategory.slug,
        parent_id: existingCategory.parent_id,
        icon_name: existingCategory.icon_name,
        show_in_nav: existingCategory.show_in_nav,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Category '${existingCategory.name}' deleted successfully.`,
    });
  } catch (error) {
    console.error(
      "Unexpected error in DELETE /api/admin/categories/[id]:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
