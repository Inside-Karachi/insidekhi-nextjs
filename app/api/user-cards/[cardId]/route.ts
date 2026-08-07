import { NextRequest, NextResponse } from "next/server";
import { query, pool } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

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

/**
 * PATCH /api/user-cards/{cardId}
 *
 * Rename and/or set-primary, scoped to the caller's own card. Web
 * counterpart of `app/api/mobile/v1/user-cards/[cardId]` (same table,
 * cookie session instead of a bearer token).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { cardId: cardIdParam } = await params;
  const cardId = parseInt(cardIdParam, 10);
  if (Number.isNaN(cardId)) {
    return NextResponse.json({ error: "invalid_card_id" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const nickname: string | null | undefined =
    typeof body.nickname === "string"
      ? body.nickname.trim().slice(0, 30) || null
      : body.nickname === null
        ? null
        : undefined;
  const isPrimary: boolean | undefined =
    typeof body.isPrimary === "boolean" ? body.isPrimary : undefined;

  const { rows: existingRows } = await query(
    `SELECT id, is_primary FROM user_cards WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [cardId, session.userId],
  );
  if (!existingRows[0]) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    if (isPrimary) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `UPDATE user_cards SET is_primary = false WHERE user_id = $1 AND id != $2`,
          [session.userId, cardId],
        );
        await client.query(
          `UPDATE user_cards SET is_primary = true${nickname !== undefined ? ", nickname = $3" : ""}
           WHERE id = $1 AND user_id = $2`,
          nickname !== undefined
            ? [cardId, session.userId, nickname]
            : [cardId, session.userId],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    } else if (nickname !== undefined) {
      await query(`UPDATE user_cards SET nickname = $1 WHERE id = $2 AND user_id = $3`, [
        nickname,
        cardId,
        session.userId,
      ]);
    }
  } catch (error) {
    console.error("Error updating user card:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const { rows } = await query(`${CARD_SELECT} WHERE uc.id = $1`, [cardId]);
  return NextResponse.json({ card: toCard(rows[0]) });
}

/**
 * DELETE /api/user-cards/{cardId}
 *
 * Remove a saved card. If it was primary and other cards remain, promotes
 * the next-oldest one so there's always a primary while any card exists.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { cardId: cardIdParam } = await params;
  const cardId = parseInt(cardIdParam, 10);
  if (Number.isNaN(cardId)) {
    return NextResponse.json({ error: "invalid_card_id" }, { status: 400 });
  }

  const { rows: existingRows } = await query(
    `SELECT id, is_primary FROM user_cards WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [cardId, session.userId],
  );
  if (!existingRows[0]) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const wasPrimary = existingRows[0].is_primary as boolean;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM user_cards WHERE id = $1 AND user_id = $2`, [
      cardId,
      session.userId,
    ]);

    if (wasPrimary) {
      await client.query(
        `UPDATE user_cards SET is_primary = true
         WHERE id = (
           SELECT id FROM user_cards WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1
         )`,
        [session.userId],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error deleting user card:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({ deleted: true });
}
