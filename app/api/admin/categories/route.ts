import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit";
import {
  categoryCreateSchema,
  generateCategorySlug,
  DEFAULT_CATEGORY_ICON,
  type Category,
  type CategoryWithParent,
  type CategoryStats,
  type CategoryType,
} from "@/types/category.types";
import type { GradientStyle } from "@/lib/utils/gradientStyles";

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

/**
 * GET /api/admin/categories
 * Fetch all categories with optional filters
 * Query params: parent_id, show_in_nav, search
 */
export async function GET(request: NextRequest) {
  try {
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const parentIdParam = searchParams.get("parent_id");
    const showInNavParam = searchParams.get("show_in_nav");
    const categoryTypeParam = searchParams.get("category_type");
    const searchParam = searchParams.get("search");

    // Build query - fetch categories (no nested select due to missing FK constraint)
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    // Filter by parent_id
    if (parentIdParam !== null && parentIdParam !== "all") {
      if (parentIdParam === "null" || parentIdParam === "roots") {
        conditions.push("parent_id IS NULL");
      } else {
        const parentId = parseInt(parentIdParam);
        if (!isNaN(parentId)) {
          conditions.push(`parent_id = $${paramIdx}`);
          params.push(parentId);
          paramIdx++;
        }
      }
    }

    // Filter by show_in_nav
    if (showInNavParam !== null && showInNavParam !== "all") {
      conditions.push(`show_in_nav = $${paramIdx}`);
      params.push(showInNavParam === "true");
      paramIdx++;
    }

    // Filter by category_type
    if (categoryTypeParam && categoryTypeParam !== "all") {
      if (categoryTypeParam === "listing" || categoryTypeParam === "event") {
        conditions.push(
          `(category_type = $${paramIdx} OR category_type = 'both')`
        );
        params.push(categoryTypeParam);
        paramIdx++;
      } else if (categoryTypeParam === "both") {
        conditions.push(`category_type = $${paramIdx}`);
        params.push("both");
        paramIdx++;
      }
    }

    // Search filter
    if (searchParam) {
      conditions.push(
        `(name ILIKE $${paramIdx} OR slug ILIKE $${paramIdx})`
      );
      params.push(`%${searchParam}%`);
      paramIdx++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows: categories } = await query(
      `SELECT
        id,
        name,
        slug,
        parent_id,
        icon_name,
        show_in_nav,
        show_in_featured,
        show_in_filters,
        is_enabled,
        category_type,
        display_order,
        gradient_style,
        created_at
      FROM public.categories
      ${whereClause}
      ORDER BY name ASC`,
      params
    );

    const typedCategories = categories as CategoryRow[];

    // Build a map of category id -> category for parent lookups
    const categoryMap = new Map<number, { name: string; slug: string }>();
    typedCategories.forEach((cat) => {
      categoryMap.set(cat.id, { name: cat.name, slug: cat.slug });
    });

    // Count published listings per category via junction (supports multi-category)
    const { rows: allListings } = await query(
      `SELECT lc.category_id
       FROM public.listing_categories lc
       INNER JOIN public.listings l ON l.id = lc.listing_id
       WHERE l.status = 'published'`
    );

    const listingCountMap = new Map<number, number>();
    (allListings as { category_id: number | null }[]).forEach((l) => {
      if (l.category_id) {
        listingCountMap.set(
          l.category_id,
          (listingCountMap.get(l.category_id) || 0) + 1
        );
      }
    });

    // Fetch all events to count them
    const { rows: allEvents } = await query(
      `SELECT category_id FROM public.events WHERE status = 'published'`
    );

    const eventCountMap = new Map<number, number>();
    (allEvents as { category_id: number | null }[]).forEach((evt) => {
      if (evt.category_id) {
        eventCountMap.set(
          evt.category_id,
          (eventCountMap.get(evt.category_id) || 0) + 1
        );
      }
    });

    // Build tree to calculate cumulative counts for parents
    const categoryTree = new Map<
      number,
      {
        id: number;
        parent_id: number | null;
        listing_count: number;
        event_count: number;
        children: number[];
      }
    >();

    // Initialize tree nodes
    typedCategories.forEach((cat) => {
      categoryTree.set(cat.id, {
        id: cat.id,
        parent_id: cat.parent_id,
        listing_count: listingCountMap.get(cat.id) || 0,
        event_count: eventCountMap.get(cat.id) || 0,
        children: [],
      });
    });

    // Build hierarchy
    typedCategories.forEach((cat) => {
      if (cat.parent_id && categoryTree.has(cat.parent_id)) {
        categoryTree.get(cat.parent_id)!.children.push(cat.id);
      }
    });

    // Recursive function to get total counts
    const getTotalCounts = (id: number): { listings: number; events: number } => {
      const node = categoryTree.get(id);
      if (!node) return { listings: 0, events: 0 };

      let listings = node.listing_count;
      let events = node.event_count;

      node.children.forEach((childId) => {
        const childCounts = getTotalCounts(childId);
        listings += childCounts.listings;
        events += childCounts.events;
      });

      return { listings, events };
    };

    // Calculate final counts for all categories
    const finalCounts = new Map<number, { listings: number; events: number }>();
    typedCategories.forEach((cat) => {
      finalCounts.set(cat.id, getTotalCounts(cat.id));
    });

    // Transform data to include parent name and counts
    const transformedCategories: CategoryWithParent[] = typedCategories.map(
      (cat) => {
        const parentInfo = cat.parent_id
          ? categoryMap.get(cat.parent_id)
          : null;

        const counts = finalCounts.get(cat.id) || { listings: 0, events: 0 };

        return {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          parent_id: cat.parent_id,
          icon_name: cat.icon_name,
          show_in_nav: cat.show_in_nav,
          show_in_featured: cat.show_in_featured,
          show_in_filters: cat.show_in_filters,
          is_enabled: cat.is_enabled,
          category_type: cat.category_type as CategoryType,
          display_order: cat.display_order,
          gradient_style: cat.gradient_style as GradientStyle | null,
          created_at: cat.created_at,
          parent_name: parentInfo?.name || null,
          parent_slug: parentInfo?.slug || null,
          listing_count: counts.listings,
          event_count: counts.events,
        };
      }
    );

    // Calculate stats
    const allCategories = transformedCategories;
    const stats: CategoryStats = {
      total: allCategories.length,
      parentCategories: allCategories.filter((c) => c.parent_id === null)
        .length,
      subcategories: allCategories.filter((c) => c.parent_id !== null).length,
      shownInNav: allCategories.filter((c) => c.show_in_nav).length,
      featured: allCategories.filter((c) => c.show_in_featured).length,
      enabled: allCategories.filter((c) => c.is_enabled).length,
      listingCategories: allCategories.filter((c) =>
        ["listing", "both"].includes(c.category_type)
      ).length,
      eventCategories: allCategories.filter((c) =>
        ["event", "both"].includes(c.category_type)
      ).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        categories: transformedCategories,
        stats,
      },
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/admin/categories:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/categories
 * Create a new category
 */
export async function POST(request: NextRequest) {
  try {
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

    // Parse and validate request body
    const body = await request.json();
    const validation = categoryCreateSchema.safeParse(body);

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

    const {
      name,
      slug: providedSlug,
      parent_id,
      icon_name,
      show_in_nav,
      show_in_featured,
      show_in_filters,
      is_enabled,
      category_type,
      display_order,
      gradient_style,
    } = validation.data;

    // Generate slug if not provided
    const slug = providedSlug || generateCategorySlug(name);

    // Check slug uniqueness
    const { rows: existingSlugRows } = await query(
      "SELECT id FROM public.categories WHERE slug ILIKE $1 LIMIT 1",
      [slug]
    );

    if (existingSlugRows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Slug '${slug}' already exists. Please choose a unique slug or try '${slug}-2'.`,
        },
        { status: 400 }
      );
    }

    // Validate parent_id exists (if provided)
    if (parent_id !== null && parent_id !== undefined) {
      const { rows: parentRows } = await query(
        "SELECT id, parent_id FROM public.categories WHERE id = $1 LIMIT 1",
        [parent_id]
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

      // Enforce max depth of 1 (parent cannot have a parent)
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
    }

    // Create category
    let newCategory: CategoryRow;
    try {
      const { rows: insertedRows } = await query(
        `INSERT INTO public.categories
          (name, slug, parent_id, icon_name, show_in_nav, show_in_featured, show_in_filters, is_enabled, category_type, display_order, gradient_style)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          name.trim(),
          slug,
          parent_id ?? null,
          icon_name || DEFAULT_CATEGORY_ICON,
          show_in_nav ?? false,
          show_in_featured ?? false,
          show_in_filters ?? true,
          is_enabled ?? true,
          category_type ?? "listing",
          display_order ?? null,
          gradient_style ?? "slate",
        ]
      );
      newCategory = insertedRows[0] as CategoryRow;
    } catch (insertError) {
      console.error("Error creating category:", insertError);
      return NextResponse.json(
        { success: false, error: "Failed to create category" },
        { status: 500 }
      );
    }

    // Log audit event
    await logAuditEvent({
      admin_id: session.userId,
      action: "category_created",
      entity_type: "category",
      entity_id: newCategory.id.toString(),
      new_values: {
        name: newCategory.name,
        slug: newCategory.slug,
        parent_id: newCategory.parent_id,
        icon_name: newCategory.icon_name,
        show_in_nav: newCategory.show_in_nav,
      },
    });

    return NextResponse.json({
      success: true,
      data: newCategory as Category,
    });
  } catch (error) {
    console.error("Unexpected error in POST /api/admin/categories:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
