import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { USERNAME_RE } from "@/lib/mobile/profile";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ username: z.string() });

/**
 * POST /api/mobile/v1/auth/username-check  (unauthenticated)
 *
 * Pre-signup helper: `{ username }` -> `{ available }`. Validates the format, then
 * checks case-insensitive uniqueness on the world-readable `profiles` table via
 * the anon client (returns only a boolean - usernames are public). IP rate
 * limited.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "A username is required.",
      400,
      "username",
    );
  }
  const username = parsed.data.username.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    throw new MobileApiError(
      "validation_error",
      "Username must be 3–30 characters: letters, numbers, and underscores only.",
      400,
      "username",
    );
  }

  let rows;
  try {
    ({ rows } = await query(
      `SELECT id FROM profiles WHERE username ILIKE $1 LIMIT 1`,
      [username],
    ));
  } catch (error) {
    console.error(
      "[mobile-api] username-check failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError(
      "internal_error",
      "Could not check the username.",
      500,
    );
  }

  return ok({ available: rows[0] == null });
});
