import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { createMobilePublicClient } from "@/lib/mobile/supabase";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/categories
 *
 * Reference data for filter/category pickers. `value` is the stringified integer
 * id (contract section 1, IDs) - not the slug. Mirrors `app/api/categories`.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const supabase = createMobilePublicClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, icon_name")
    .order("name", { ascending: true });

  if (error) {
    console.error("[mobile-api] categories query failed:", error.message);
    throw new MobileApiError(
      "internal_error",
      "Failed to load categories.",
      500,
    );
  }

  const categories = (data ?? []).map((c) => ({
    value: String(c.id),
    label: c.name,
    slug: c.slug,
    parentId: c.parent_id != null ? String(c.parent_id) : null,
    iconName: c.icon_name,
  }));

  return ok(categories);
});
