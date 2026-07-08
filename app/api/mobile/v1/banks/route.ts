import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { createMobilePublicClient } from "@/lib/mobile/supabase";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/banks
 *
 * Bank reference data for deal/bank pickers. `value` is the stringified integer
 * id (contract section 1). Mirrors `app/api/banks`; `banks` is anon-readable by RLS
 * (the website route uses an authed client, but anon read is permitted).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const supabase = createMobilePublicClient();
  const { data, error } = await supabase
    .from("banks")
    .select("id, name, logo_url, code")
    .order("name", { ascending: true });

  if (error) {
    console.error("[mobile-api] banks query failed:", error.message);
    throw new MobileApiError("internal_error", "Failed to load banks.", 500);
  }

  const banks = (data ?? []).map((b) => ({
    value: String(b.id),
    label: b.name,
    code: b.code,
    logoUrl: b.logo_url,
  }));

  return ok(banks);
});
