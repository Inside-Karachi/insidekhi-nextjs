import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePathId } from "@/lib/mobile/params";
import { MobileApiError } from "@/lib/mobile/errors";
import { query, pool } from "@/lib/db";

export const dynamic = "force-dynamic";

const CARD_SELECT = `
  SELECT uc.id, uc.card_variant_id, uc.nickname, uc.is_primary, uc.created_at,
         cv.card_name, cv.card_type, cv.card_network, cv.card_tier, cv.image_filename,
         b.id AS bank_id, b.name AS bank_name
  FROM user_cards uc
  JOIN card_variants cv ON cv.id = uc.card_variant_id
  JOIN banks b ON b.id = cv.bank_id
`;

function toCard(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    cardVariantId: Number(row.card_variant_id),
    nickname: row.nickname as string | null,
    isPrimary: row.is_primary as boolean,
    createdAt: row.created_at,
    bankId: Number(row.bank_id),
    bankName: row.bank_name as string,
    cardName: row.card_name as string,
    cardType: row.card_type as string | null,
    cardNetwork: row.card_network as string | null,
    cardTier: row.card_tier as string | null,
    imageFilename: row.image_filename as string | null,
  };
}

async function loadOwnCard(cardId: number, userId: string) {
  const { rows } = await query(
    `SELECT id, is_primary FROM user_cards WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [cardId, userId],
  );
  if (!rows[0]) {
    throw new MobileApiError("not_found", "Card not found.", 404);
  }
  return rows[0] as { id: number; is_primary: boolean };
}

const patchSchema = z.object({
  nickname: z.string().trim().max(30).nullable().optional(),
  isPrimary: z.boolean().optional(),
});

/**
 * PATCH /api/mobile/v1/user-cards/{cardId}
 *
 * Rename and/or set-primary, scoped to the caller's own card. Setting
 * primary unsets any other primary first (the DB's partial unique index
 * would reject two primaries anyway - this just does it in the same
 * transaction instead of erroring).
 */
export const PATCH = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const p = await params;
  const cardId = parsePathId(p.cardId, "cardId");
  const { user } = await requireMobileUser(request);

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError("validation_error", "Invalid request body.", 400);
  }
  const { nickname, isPrimary } = parsed.data;

  await loadOwnCard(cardId, user.id);

  if (isPrimary === undefined) {
    if (nickname !== undefined) {
      await query(`UPDATE user_cards SET nickname = $1 WHERE id = $2 AND user_id = $3`, [
        nickname?.trim() || null,
        cardId,
        user.id,
      ]);
    }
  } else if (isPrimary) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE user_cards SET is_primary = false WHERE user_id = $1 AND id != $2`,
        [user.id, cardId],
      );
      await client.query(
        `UPDATE user_cards SET is_primary = true${nickname !== undefined ? ", nickname = $3" : ""}
         WHERE id = $1 AND user_id = $2`,
        nickname !== undefined ? [cardId, user.id, nickname?.trim() || null] : [cardId, user.id],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[mobile-api] user_cards set-primary failed:", error);
      throw new MobileApiError("internal_error", "Failed to update card.", 500);
    } finally {
      client.release();
    }
  }
  // isPrimary === false is a no-op: "unset primary" isn't a supported state
  // (there's always exactly one primary once any card exists), so nothing
  // to do beyond the nickname update already handled above.

  const { rows } = await query(`${CARD_SELECT} WHERE uc.id = $1`, [cardId]);
  return ok(toCard(rows[0]));
});

/**
 * DELETE /api/mobile/v1/user-cards/{cardId}
 *
 * Remove a saved card. If it was primary and other cards remain, promotes
 * the next-oldest one so there's always a primary while any card exists -
 * mirrors the mobile app's local store logic, now enforced server-side.
 */
export const DELETE = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const p = await params;
  const cardId = parsePathId(p.cardId, "cardId");
  const { user } = await requireMobileUser(request);

  const existing = await loadOwnCard(cardId, user.id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM user_cards WHERE id = $1 AND user_id = $2`, [
      cardId,
      user.id,
    ]);

    if (existing.is_primary) {
      await client.query(
        `UPDATE user_cards SET is_primary = true
         WHERE id = (
           SELECT id FROM user_cards WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1
         )`,
        [user.id],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[mobile-api] user_cards delete failed:", error);
    throw new MobileApiError("internal_error", "Failed to remove card.", 500);
  } finally {
    client.release();
  }

  return ok({ deleted: true });
});
