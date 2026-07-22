import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/** `config_value` is jsonb but some rows store a JSON-encoded string (double-encoded) — unwrap once more if so. */
function unwrapConfigValue(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function isTruthy(value: unknown): boolean {
  return value === true || value === "true";
}

/**
 * GET /api/mobile/v1/system/maintenance  (public, unauthenticated)
 *
 * Whether the app is under maintenance, plus the message/estimated end time to
 * show. Only exposes the safe subset of `system_config`'s `maintenance.*` keys
 * (never `maintenance.bypass_roles`, which lists roles allowed to bypass it).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  let rows;
  try {
    const result = await query(
      `SELECT config_key, config_value FROM system_config
       WHERE config_key IN ('maintenance.enabled', 'maintenance.message', 'maintenance.estimated_end')`,
    );
    rows = result.rows;
  } catch (error) {
    console.error(
      "[mobile-api] maintenance config query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to load maintenance status.",
      500,
    );
  }

  const byKey = new Map(rows.map((r) => [r.config_key, unwrapConfigValue(r.config_value)]));

  return ok({
    enabled: isTruthy(byKey.get("maintenance.enabled")),
    message:
      typeof byKey.get("maintenance.message") === "string"
        ? (byKey.get("maintenance.message") as string)
        : null,
    estimated_end:
      typeof byKey.get("maintenance.estimated_end") === "string"
        ? (byKey.get("maintenance.estimated_end") as string)
        : null,
  });
});
