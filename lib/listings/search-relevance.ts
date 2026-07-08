import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";

/**
 * Match tier for listing text search (app-layer ranking; optional SQL mirror in migration).
 * Higher = stronger match. 0 = no match.
 *
 * Tiers: 4 = name starts with term (trimmed, case-insensitive), 3 = name contains,
 * 2 = category only, 1 = description/address only.
 */
export function listingSearchRank(
  name: string | null | undefined,
  description: string | null | undefined,
  address: string | null | undefined,
  categoryName: string | null | undefined,
  rawTerm: string,
): number {
  const t = sanitizeSearchTerm(rawTerm).toLowerCase();
  if (t.length < 2) return 0;

  const n = (name ?? "").trim().toLowerCase();
  const d = (description ?? "").toLowerCase();
  const a = (address ?? "").toLowerCase();
  const c = (categoryName ?? "").toLowerCase();

  if (n.length > 0 && n.startsWith(t)) return 4;
  if (n.includes(t)) return 3;
  if (c.includes(t)) return 2;
  if (d.includes(t) || a.includes(t)) return 1;
  return 0;
}

export type ListingSearchRankFields = {
  name: string | null;
  description: string | null;
  address: string | null;
  category_name: string | null;
};

export function listingSearchRankFromRow(
  row: ListingSearchRankFields,
  rawTerm: string,
): number {
  return listingSearchRank(
    row.name,
    row.description,
    row.address,
    row.category_name,
    rawTerm,
  );
}

/**
 * OR filter for listing search (substring). Matches name, description, and address.
 */
export function buildListingSearchOrFilter(sanitizedTerm: string): string {
  const t = sanitizeSearchTerm(sanitizedTerm);
  if (!t) return "";
  return `name.ilike.%${t}%,description.ilike.%${t}%,address.ilike.%${t}%`;
}

/**
 * After rows are fetched from Supabase (no DB migration required): stronger text matches first,
 * then featured, rating, id. Use on the current page result set only.
 */
export function sortFetchedListingsBySearchRelevance<
  T extends ListingSearchRankFields & {
    is_featured?: boolean | null;
    avg_rating?: number | string | null;
    id?: number | null;
  },
>(rows: T[], rawTerm: string): T[] {
  const term = sanitizeSearchTerm(rawTerm);
  if (term.length < 2) return rows;
  return [...rows].sort((a, b) => {
    const ra = listingSearchRankFromRow(a, term);
    const rb = listingSearchRankFromRow(b, term);
    if (ra !== rb) return rb - ra;
    const fa = (a.is_featured ? 1 : 0) - (b.is_featured ? 1 : 0);
    if (fa !== 0) return -fa;
    const ratA = parseFloat(String(a.avg_rating ?? 0));
    const ratB = parseFloat(String(b.avg_rating ?? 0));
    if (ratA !== ratB) return ratB - ratA;
    return (Number(a.id) || 0) - (Number(b.id) || 0);
  });
}

/**
 * When search is active: higher relevance first; within the same tier, preserve
 * the order produced by the existing sort (featured, rating, distance, etc.).
 */
export function stableReorderBySearchRank<T extends ListingSearchRankFields>(
  items: T[],
  rawSearch: string | undefined,
): T[] {
  const term = rawSearch ? sanitizeSearchTerm(rawSearch) : "";
  if (term.length < 2) return items;

  return items
    .map((item, index) => ({ item, index }))
    .sort((A, B) => {
      const rA = listingSearchRankFromRow(A.item, term);
      const rB = listingSearchRankFromRow(B.item, term);
      if (rA !== rB) return rB - rA;
      return A.index - B.index;
    })
    .map(({ item }) => item);
}

/**
 * Comparator for distance / discount sorts: primary metric first, then relevance, then id.
 */
export function compareSearchRankThenIds(
  a: Record<string, unknown> & { id?: number | null },
  b: Record<string, unknown> & { id?: number | null },
  rawSearch: string | undefined,
  primaryDiff: number,
): number {
  if (primaryDiff !== 0) return primaryDiff;
  const term = rawSearch?.trim() ? sanitizeSearchTerm(rawSearch) : "";
  if (term.length < 2) return (a.id ?? 0) - (b.id ?? 0);
  const rA = listingSearchRankFromRow(
    {
      name: (a.name as string | null) ?? null,
      description: (a.description as string | null) ?? null,
      address: (a.address as string | null) ?? null,
      category_name: (a.category_name as string | null) ?? null,
    },
    term,
  );
  const rB = listingSearchRankFromRow(
    {
      name: (b.name as string | null) ?? null,
      description: (b.description as string | null) ?? null,
      address: (b.address as string | null) ?? null,
      category_name: (b.category_name as string | null) ?? null,
    },
    term,
  );
  if (rA !== rB) return rB - rA;
  return (a.id ?? 0) - (b.id ?? 0);
}
