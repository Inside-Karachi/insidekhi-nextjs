import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { createMobilePublicClient } from "@/lib/mobile/supabase";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/sort-options
 *
 * Active listing sort options for the picker. Mirrors `app/api/sort-options`
 * (the website's `as "listings"` cast is unnecessary - `sort_options` is a
 * fully typed table). Anon-readable rows are gated to `is_active = true` by RLS.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const supabase = createMobilePublicClient();
  const { data, error } = await supabase
    .from("sort_options")
    .select("key, label, icon_name, is_default")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[mobile-api] sort-options query failed:", error.message);
    throw new MobileApiError(
      "internal_error",
      "Failed to load sort options.",
      500,
    );
  }

  const sortOptions = (data ?? []).map((s) => ({
    key: s.key,
    label: s.label,
    icon_name: s.icon_name,
    is_default: s.is_default,
  }));

  return ok(sortOptions);
});
