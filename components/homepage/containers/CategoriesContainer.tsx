import { createServerSupabase } from "@/lib/supabase/server";
import { FeaturedCategoriesSection } from "@/components/homepage/FeaturedCategoriesSection";
import type { GradientStyle } from "@/lib/utils/gradientStyles";

export async function CategoriesContainer() {
  const supabase = await createServerSupabase({ publicAnon: true });

  const [
    { data: categoriesView },
    { data: categoriesTable },
    { count: eventCount },
  ] =
    await Promise.all([
      supabase
        .from("categories_with_published_listing_count")
        .select("*")
        .order("name", { ascending: true }),
      supabase
        .from("categories")
        .select(
          "id, parent_id, show_in_featured, is_enabled, icon_name, category_type, display_order, slug, gradient_style"
        )
        .eq("show_in_featured", true)
        .eq("is_enabled", true)
        .in("category_type", ["listing", "event", "both"])
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true }),
      supabase
        .from("events_with_details")
        .select("*", { count: "exact", head: true })
        .eq("event_status", "published")
        .gte("start_time", new Date().toISOString()),
    ]);

  // Build a map of category counts including subcategory aggregation
  const categoryCountMap = new Map<number, number>();

  // First, populate direct counts from the view
  (categoriesView || []).forEach((cat) => {
    if (cat.id !== null && cat.published_listing_count !== null) {
      categoryCountMap.set(cat.id as number, cat.published_listing_count as number);
    }
  });

  // Then, aggregate subcategory counts for parent categories
  // This matches the behavior in app/listings/[slug]/page.tsx (lines 53-64)
  (categoriesView || []).forEach((cat) => {
    if (cat.id !== null && cat.parent_id === null) {
      // This is a parent category - sum up its own count + all subcategory counts
      const parentId = cat.id as number;
      let totalCount = categoryCountMap.get(parentId) || 0;

      // Add counts from all subcategories
      (categoriesView || []).forEach((subCat) => {
        if (subCat.parent_id === parentId && subCat.id !== null) {
          totalCount += categoryCountMap.get(subCat.id as number) || 0;
        }
      });

      categoryCountMap.set(parentId, totalCount);
    }
  });

  const categories = (categoriesView || [])
    .map((cat) => {
      // Find matching row in categories table for filtering fields
      const meta = (categoriesTable || []).find((c) => c.id === cat.id);
      return meta &&
        cat.id !== null &&
        cat.name !== null &&
        cat.slug !== null &&
        cat.published_listing_count !== null
        ? {
          id: cat.id as number,
          name: cat.name as string,
          slug: cat.slug as string,
          published_listing_count:
            meta.category_type === "event"
              ? eventCount || 0
              : (categoryCountMap.get(cat.id as number) || 0),
          icon_name: meta.icon_name,
          category_type: meta.category_type,
          gradient_style:
            (meta.gradient_style as GradientStyle | null) || null,
        }
        : null;
    })
    .filter(
      (
        c
      ): c is {
        id: number;
        name: string;
        slug: string;
        published_listing_count: number;
        icon_name: string | null;
        category_type: string;
        gradient_style: GradientStyle | null;
      } => !!c
    );

  return <FeaturedCategoriesSection categories={categories} />;
}
