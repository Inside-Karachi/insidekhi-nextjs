import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { createMobilePublicClient } from "@/lib/mobile/supabase";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/site-settings
 *
 * Public key->value settings as a flat object. Reads the `site_settings_active`
 * view (security_invoker -> anon sees only `is_active` rows). Mirrors
 * `app/api/site-settings`.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const supabase = createMobilePublicClient();
  const { data, error } = await supabase
    .from("site_settings_active")
    .select("key, value");

  if (error) {
    console.error("[mobile-api] site-settings query failed:", error.message);
    throw new MobileApiError(
      "internal_error",
      "Failed to load site settings.",
      500,
    );
  }

  const settings = (data ?? []).reduce<Record<string, string>>((acc, row) => {
    if (row.key) acc[row.key] = row.value ?? "";
    return acc;
  }, {});

  return ok(settings);
});
