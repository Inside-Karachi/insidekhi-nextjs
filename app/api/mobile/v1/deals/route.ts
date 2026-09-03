import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { query } from "@/lib/db";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { formatDiscount, daysUntil, normalizeCardName } from "@/lib/mobile/deal-format";

export const dynamic = "force-dynamic";

/**
 * Explicit column list - never use `*`. `l.category_id`/`category_name` are
 * the listing's own (sub)category - e.g. "Jewelry & Watches" - which is one
 * level too specific for the Deals tab's category tabs (that UI mirrors the
 * Home screen's 7-parent grid). `top_category` resolves each listing's
 * top-level ancestor: taxonomy depth is capped at parent -> child (enforced
 * in the admin API), so a single self-join on `parent_id` is enough - no
 * recursion needed.
 */
const DEAL_SQL_COLUMNS = `
  d.id, d.title, d.description, d.deal_type, d.bank_id, d.discount_value, d.end_date,
  d.valid_card_variants, d.metadata,
  l.id AS listing_id, l.slug AS listing_slug, l.name AS listing_name,
  l.category_id, l.category_name, l.latitude, l.longitude,
  top_category.id AS top_category_id, top_category.name AS top_category_name
`;
const DEAL_SQL_JOINS = `
  JOIN listings_with_details l ON l.id = d.listing_id
  LEFT JOIN categories cat ON cat.id = l.category_id
  LEFT JOIN categories top_category ON top_category.id = COALESCE(cat.parent_id, cat.id)
`;

type DealRow = {
  id: string | number;
  title: string;
  description: string | null;
  deal_type: "general" | "bank_discount";
  discount_value: string | null;
  end_date: string | null;
  /** `bigint[]` in Postgres - `pg` parses each element as a string, same as
   * a scalar bigint column. Always run through `Number()` before use. */
  valid_card_variants: (string | number)[] | null;
  bank_id: string | number | null;
  /** Scraper-sourced deals carry `card_associations` here - see the
   * name-matching fallback below for why this is needed. */
  metadata: { card_associations?: { typeId: number; name: string }[] } | null;
  listing_id: string | number;
  listing_slug: string;
  listing_name: string;
  category_id: string | number | null;
  category_name: string | null;
  top_category_id: string | number | null;
  top_category_name: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
};

type CardMatchDTO = { cardVariantId: number; bankId: number; label: string };

/**
 * GET /api/mobile/v1/deals
 *
 * Public, deal-first catalog: every active, non-expired deal on a published
 * listing, with the listing's own display info (name/slug/image/location/category)
 * and the specific bank cards it applies to. Small unpaginated catalog, same
 * shape as GET /banks and GET /cards - not a paginated feed.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  let rows: DealRow[];
  try {
    const result = await query(
      `SELECT ${DEAL_SQL_COLUMNS}
       FROM deals d
       ${DEAL_SQL_JOINS}
       WHERE d.is_active = true
         AND (d.end_date IS NULL OR d.end_date >= NOW())
         AND l.status = 'published'
       ORDER BY d.created_at DESC
       LIMIT 300`,
    );
    rows = result.rows as DealRow[];
  } catch (error) {
    console.error(
      "[mobile-api] deals query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError("internal_error", "Failed to load deals.", 500);
  }

  const listingIds = [...new Set(rows.map((r) => Number(r.listing_id)))];
  const imageByListing = new Map<number, string>();
  if (listingIds.length > 0) {
    const { rows: images } = await query(
      `SELECT id, listing_id, url, display_order, is_primary
       FROM listing_images
       WHERE listing_id = ANY($1::int[])
       ORDER BY display_order ASC`,
      [listingIds],
    );
    for (const img of images as {
      listing_id: number;
      url: string;
      is_primary: boolean | null;
    }[]) {
      if (img.url.includes("/menu/")) continue;
      const existing = imageByListing.get(img.listing_id);
      if (!existing || img.is_primary) {
        imageByListing.set(img.listing_id, img.url);
      }
    }
  }

  const cardVariantIds = [
    ...new Set(rows.flatMap((r) => (r.valid_card_variants ?? []).map(Number))),
  ];
  const bankIds = [
    ...new Set(
      rows.map((r) => (r.bank_id !== null ? Number(r.bank_id) : null)).filter((id): id is number => id !== null),
    ),
  ];

  type CardVariantRow = { id: number; cardName: string; bankId: number; label: string };
  const cardById = new Map<number, CardVariantRow>();
  /** Same rows as `cardById`, indexed by bank + normalized card name - the
   * fallback path below (see `cardMatches`). */
  const cardByBankAndName = new Map<number, Map<string, CardVariantRow>>();

  if (cardVariantIds.length > 0 || bankIds.length > 0) {
    const { rows: cards } = await query(
      `SELECT cv.id, cv.card_name, cv.bank_id, b.name AS bank_name
       FROM card_variants cv
       JOIN banks b ON b.id = cv.bank_id
       WHERE cv.id = ANY($1::int[]) OR cv.bank_id = ANY($2::int[])`,
      [cardVariantIds, bankIds],
    );
    for (const c of cards as {
      id: string | number;
      card_name: string;
      bank_id: string | number;
      bank_name: string;
    }[]) {
      const bankId = Number(c.bank_id);
      const row: CardVariantRow = {
        id: Number(c.id),
        cardName: c.card_name,
        bankId,
        label: `${c.bank_name} ${c.card_name}`.trim(),
      };
      cardById.set(row.id, row);
      if (!cardByBankAndName.has(bankId)) cardByBankAndName.set(bankId, new Map());
      cardByBankAndName.get(bankId)!.set(normalizeCardName(c.card_name), row);
    }
  }

  const deals = rows.map((row) => {
    const { label: discountLabel, weight: discountWeight } = formatDiscount(
      row.discount_value,
    );

    // Primary path: `valid_card_variants` ids that resolve directly against
    // `card_variants.id` (true for admin-entered deals).
    let cardMatches: CardMatchDTO[] = (row.valid_card_variants ?? [])
      .map((rawId): CardMatchDTO | null => {
        const id = Number(rawId);
        const card = cardById.get(id);
        if (!card) return null;
        return { cardVariantId: id, bankId: card.bankId, label: card.label };
      })
      .filter((m): m is CardMatchDTO => m !== null);

    // Fallback: scraper-sourced deals write Peekaboo's own `typeId` into
    // `valid_card_variants`, which never matches `card_variants.id` (see
    // `entity-scraper.ts`'s `validCards: deal.associations.map(assoc =>
    // assoc.typeId)`). Those same associations carry a human-readable card
    // name in `metadata.card_associations`, in the same "Visa Gold Debit
    // Card" style `card_variants.card_name` already uses - match on that,
    // scoped to the deal's own bank so two banks' same-named tier can't cross-match.
    if (cardMatches.length === 0 && row.bank_id !== null) {
      const bankId = Number(row.bank_id);
      const byName = cardByBankAndName.get(bankId);
      const associations = row.metadata?.card_associations ?? [];
      if (byName && associations.length > 0) {
        const seen = new Set<number>();
        cardMatches = associations
          .map((assoc): CardMatchDTO | null => {
            const card = byName.get(normalizeCardName(assoc.name));
            if (!card || seen.has(card.id)) return null;
            seen.add(card.id);
            return { cardVariantId: card.id, bankId: card.bankId, label: card.label };
          })
          .filter((m): m is CardMatchDTO => m !== null);
      }
    }

    return {
      id: Number(row.id),
      title: row.title,
      description: row.description,
      dealType: row.deal_type,
      discountLabel,
      discountWeight,
      endDate: row.end_date,
      expiryDaysLeft: daysUntil(row.end_date),
      merchant: row.listing_name,
      listingSlug: row.listing_slug,
      imageUrl: imageByListing.get(Number(row.listing_id)) ?? null,
      categoryId: row.category_id !== null ? Number(row.category_id) : null,
      categoryName: row.category_name,
      topCategoryId: row.top_category_id !== null ? Number(row.top_category_id) : null,
      topCategoryName: row.top_category_name,
      latitude: row.latitude !== null ? Number(row.latitude) : null,
      longitude: row.longitude !== null ? Number(row.longitude) : null,
      cardMatches,
    };
  });

  return ok(deals);
});
