import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
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
 * GET /api/user-cards
 *
 * The signed-in user's saved cards, for Deals & Discounts personalization.
 * Web counterpart of `app/api/mobile/v1/user-cards` (same table, cookie
 * session instead of a bearer token).
 */
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { rows } = await query(
      `${CARD_SELECT} WHERE uc.user_id = $1 ORDER BY uc.is_primary DESC, uc.created_at ASC`,
      [session.userId],
    );
    return NextResponse.json({ cards: rows.map(toCard) });
  } catch (error) {
    console.error("Error fetching user cards:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/user-cards
 *
 * Save a card: body `{ cardVariantId, nickname? }`. The first card a user
 * saves becomes primary automatically. No payment fields exist on this
 * table to accept - bank/card product + label only.
 */
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const cardVariantId = Number(body.cardVariantId);
    if (!Number.isInteger(cardVariantId) || cardVariantId < 1) {
      return NextResponse.json({ error: "invalid_card_variant_id" }, { status: 400 });
    }
    const nickname = typeof body.nickname === "string" ? body.nickname.trim().slice(0, 30) : null;

    const { rows: cardRows } = await query(
      `SELECT id FROM card_variants WHERE id = $1 AND is_active = true LIMIT 1`,
      [cardVariantId],
    );
    if (!cardRows[0]) {
      return NextResponse.json({ error: "card_not_found" }, { status: 404 });
    }

    const { rows: existing } = await query(
      `SELECT id FROM user_cards WHERE user_id = $1 AND card_variant_id = $2 LIMIT 1`,
      [session.userId, cardVariantId],
    );
    if (existing[0]) {
      return NextResponse.json({ error: "already_saved" }, { status: 409 });
    }

    const { rows: countRows } = await query(
      `SELECT count(*)::int AS n FROM user_cards WHERE user_id = $1`,
      [session.userId],
    );
    const isFirstCard = (countRows[0]?.n ?? 0) === 0;

    const { rows: inserted } = await query(
      `INSERT INTO user_cards (user_id, card_variant_id, nickname, is_primary)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [session.userId, cardVariantId, nickname || null, isFirstCard],
    );

    const { rows: full } = await query(`${CARD_SELECT} WHERE uc.id = $1`, [inserted[0].id]);
    return NextResponse.json({ card: toCard(full[0]) }, { status: 201 });
  } catch (error) {
    console.error("Error saving user card:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
