import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// Public, read-only lookup of active card variants for a bank, optionally
// narrowed to a specific deal's associated cards. Backs the client-side
// BankCardShowcase component (was previously a direct browser Supabase call).
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bankIdParam = searchParams.get("bankId");
    const bankName = searchParams.get("bankName");
    const dealIdParam = searchParams.get("dealId");
    const maxCardsParam = searchParams.get("maxCards");
    const maxCards = Math.min(
      50,
      Math.max(1, parseInt(maxCardsParam || "4", 10) || 4),
    );

    let bankId: number | null = bankIdParam ? parseInt(bankIdParam, 10) : null;
    if (bankId !== null && Number.isNaN(bankId)) bankId = null;

    let targetCardIds: number[] = [];
    let targetCardNames: string[] = [];

    const dealId = dealIdParam ? parseInt(dealIdParam, 10) : null;
    if (dealId !== null && !Number.isNaN(dealId)) {
      const { rows: dealRows } = await query(
        `SELECT valid_card_variants, metadata FROM deals WHERE id = $1 LIMIT 1`,
        [dealId],
      );
      const deal = dealRows[0];
      if (deal) {
        if (
          Array.isArray(deal.valid_card_variants) &&
          deal.valid_card_variants.length > 0
        ) {
          targetCardIds = deal.valid_card_variants.map((id: unknown) =>
            Number(id),
          );
        }

        const metadata = deal.metadata as Record<string, unknown> | null;
        if (
          metadata &&
          Array.isArray(metadata.card_associations) &&
          metadata.card_associations.length > 0
        ) {
          targetCardNames = (
            metadata.card_associations as { name: string }[]
          ).map((c) => c.name);
        }
      }
    }

    // If no bankId provided, try to resolve it by name.
    if (bankId === null && bankName) {
      const { rows: bankRows } = await query(
        `SELECT id FROM banks WHERE name = $1 LIMIT 1`,
        [bankName],
      );
      if (bankRows[0]) bankId = Number(bankRows[0].id);
    }

    let finalRows: Array<Record<string, unknown>> = [];

    // Attempt 1: Fetch by IDs (most precise)
    if (targetCardIds.length > 0) {
      const params: unknown[] = [targetCardIds];
      let sql = `SELECT * FROM card_variants WHERE is_active = true AND id = ANY($1)`;
      if (bankId !== null) {
        params.push(bankId);
        sql += ` AND bank_id = $${params.length}`;
      }
      params.push(maxCards);
      sql += ` ORDER BY card_tier ASC, card_name ASC LIMIT $${params.length}`;

      const { rows } = await query(sql, params);
      if (rows.length > 0) finalRows = rows;
    }

    // Attempt 2: Fetch by names (if IDs failed or returned nothing)
    if (finalRows.length === 0 && targetCardNames.length > 0 && bankId !== null) {
      const { rows } = await query(
        `SELECT * FROM card_variants
         WHERE is_active = true AND bank_id = $1 AND card_name = ANY($2)
         ORDER BY card_tier ASC, card_name ASC
         LIMIT $3`,
        [bankId, targetCardNames, maxCards],
      );
      if (rows.length > 0) finalRows = rows;
    }

    const cards = finalRows.map((row) => ({
      ...row,
      id: Number(row.id),
      bank_id: row.bank_id !== null ? Number(row.bank_id) : null,
    }));

    return NextResponse.json({ cards });
  } catch (error) {
    console.error("Bank cards API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
