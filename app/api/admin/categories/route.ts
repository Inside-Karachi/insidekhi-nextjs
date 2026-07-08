import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
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

/**
 * GET /api/admin/categories
 * Fetch all categories with optional filters
 * Query params: parent_id, show_in_nav, search
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify super_admin role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
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
    let query = supabase
      .from("categories")
      .select(
        `
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
      `
      )
      .order("name", { ascending: true });

    // Filter by parent_id
    if (parentIdParam !== null && parentIdParam !== "all") {
      if (parentIdParam === "null" || parentIdParam === "roots") {
        query = query.is("parent_id", null);
      } else {
        const parentId = parseInt(parentIdParam);
        if (!isNaN(parentId)) {
          query = query.eq("parent_id", parentId);
        }
      }
    }

    // Filter by show_in_nav
    if (showInNavParam !== null && showInNavParam !== "all") {
      query = query.eq("show_in_nav", showInNavParam === "true");
    }

    // Filter by category_type
    if (categoryTypeParam && categoryTypeParam !== "all") {
      if (categoryTypeParam === "listing" || categoryTypeParam === "event") {
        query = query.or(
          `category_type.eq.${categoryTypeParam},category_type.eq.both`
        );
      } else if (categoryTypeParam === "both") {
        query = query.eq("category_type", "both");
      }
    }

    // Search filter
    if (searchParam) {
      query = query.or(
        `name.ilike.%${searchParam}%,slug.ilike.%${searchParam}%`
      );
    }

    const { data: categories, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching categories:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch categories" },
        { status: 500 }
      );
    }

    // Build a map of category id -> category for parent lookups
    const categoryMap = new Map<number, { name: string; slug: string }>();
    (categories || []).forEach((cat) => {
      categoryMap.set(cat.id, { name: cat.name, slug: cat.slug });
    });

    // Fetch all listings to count them (manual aggregation for accuracy)
    const { data: allListings } = await supabase
      .from("listings")
      .select("category_id")
      .eq("status", "published");

    const listingCountMap = new Map<number, number>();
    if (allListings) {
      allListings.forEach((l) => {
        if (l.category_id) {
          listingCountMap.set(
            l.category_id,
            (listingCountMap.get(l.category_id) || 0) + 1
          );
        }
      });
    }

    // Fetch all events to count them
    const { data: allEvents } = await supabase
      .from("events")
      .select("category_id")
      .eq("status", "published");

    const eventCountMap = new Map<number, number>();
    if (allEvents) {
      allEvents.forEach((evt) => {
        if (evt.category_id) {
          eventCountMap.set(
            evt.category_id,
            (eventCountMap.get(evt.category_id) || 0) + 1
          );
        }
      });
    }

    // Build tree to calculate cumulative counts for parents
    const categoryTree = new Map<number, { id: number; parent_id: number | null; listing_count: number; event_count: number; children: number[] }>();

    // Initialize tree nodes
    (categories || []).forEach(cat => {
      categoryTree.set(cat.id, {
        id: cat.id,
        parent_id: cat.parent_id,
        listing_count: listingCountMap.get(cat.id) || 0,
        event_count: eventCountMap.get(cat.id) || 0,
        children: []
      });
    });

    // Build hierarchy
    (categories || []).forEach(cat => {
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

      node.children.forEach(childId => {
        const childCounts = getTotalCounts(childId);
        listings += childCounts.listings;
        events += childCounts.events;
      });

      return { listings, events };
    };

    // Calculate final counts for all categories
    const finalCounts = new Map<number, { listings: number; events: number }>();
    (categories || []).forEach(cat => {
      finalCounts.set(cat.id, getTotalCounts(cat.id));
    });

    // Transform data to include parent name and counts
    const transformedCategories: CategoryWithParent[] = (categories || []).map(
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
    const supabase = await createServerSupabase();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify super_admin role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
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
    const { data: existingSlug } = await supabase
      .from("categories")
      .select("id")
      .ilike("slug", slug)
      .single();

    if (existingSlug) {
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
      const { data: parentCategory } = await supabase
        .from("categories")
        .select("id, parent_id")
        .eq("id", parent_id)
        .single();

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
    const { data: newCategory, error: insertError } = await supabase
      .from("categories")
      .insert({
        name: name.trim(),
        slug,
        parent_id: parent_id ?? null,
        icon_name: icon_name || DEFAULT_CATEGORY_ICON,
        show_in_nav: show_in_nav ?? false,
        show_in_featured: show_in_featured ?? false,
        show_in_filters: show_in_filters ?? true,
        is_enabled: is_enabled ?? true,
        category_type: category_type ?? "listing",
        display_order: display_order ?? null,
        gradient_style: gradient_style ?? "slate",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating category:", insertError);
      return NextResponse.json(
        { success: false, error: "Failed to create category" },
        { status: 500 }
      );
    }

    // Log audit event
    await logAuditEvent({
      admin_id: user.id,
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
