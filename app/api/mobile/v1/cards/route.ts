import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { query } from "@/lib/db";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePathId } from "@/lib/mobile/params";
import { MobileApiError } from "@/lib/mobile/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/cards?bankId=
 *
 * Active card products for one bank - the second step of Add Card (bank,
 * then card). Mirrors `app/api/cards`; `card_variants` is anon-readable by
 * RLS (public reference data, same as `banks`).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { searchParams } = new URL(request.url);
  const bankId = parsePathId(searchParams.get("bankId") ?? undefined, "bankId");

  const { rows: bankRows } = await query(
    `SELECT id, name FROM banks WHERE id = $1 LIMIT 1`,
    [bankId],
  );
  if (!bankRows[0]) {
    throw new MobileApiError("not_found", "Bank not found.", 404, "bankId");
  }

  let cards;
  try {
    const { rows } = await query(
      `SELECT id, card_name, card_type, card_network, card_tier, image_filename
       FROM card_variants
       WHERE bank_id = $1 AND is_active = true
       ORDER BY card_tier ASC, card_name ASC`,
      [bankId],
    );
    cards = rows;
  } catch (error) {
    console.error(
      "[mobile-api] cards query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError("internal_error", "Failed to load cards.", 500);
  }

  return ok(
    cards.map((c) => ({
      id: Number(c.id),
      bankId,
      bankName: bankRows[0].name as string,
      cardName: c.card_name,
      cardType: c.card_type,
      cardNetwork: c.card_network,
      cardTier: c.card_tier,
      imageFilename: c.image_filename,
    })),
  );
});
