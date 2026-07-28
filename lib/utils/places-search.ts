/**
 * Discover places-search helpers: normalize, tokenize, thresholds, taxonomy scope.
 */

export const MIN_QUERY_LENGTH = 2;
export const MIN_FUZZY_LENGTH = 3;
export const FUZZY_THRESHOLD_DEFAULT = 0.35;
export const FUZZY_THRESHOLD_SHORT = 0.45;
export const CATEGORY_STRONG_SIM = 0.5;
export const TAG_ONLY_CAP = 8;
export const MAX_TOKENS = 5;

/** New taxonomy parent category ids (Food…Education). */
export const NEW_TAXONOMY_PARENT_IDS = [75, 76, 77, 78, 79, 80] as const;

/**
 * Lower-case, strip apostrophes, replace other non-alphanumerics with spaces.
 * Aligns `mcdonald's` ↔ `McDonald's` ↔ `mcdonalds`.
 */
export function normalizeSearchText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Light sanitize for search: strip ILIKE / operator metacharacters but keep
 * apostrophes so normalizeSearchText can collapse them.
 */
export function sanitizePlacesQuery(term: string): string {
  return term.replace(/[&|:*!()\\"%]/g, " ").trim();
}

export type PlacesQueryTokens = {
  normalized: string;
  tokens: string[];
  fuzzyThreshold: number;
};

export function tokenizeQuery(raw: string): PlacesQueryTokens {
  const sanitized = sanitizePlacesQuery(raw);
  const normalized = normalizeSearchText(sanitized);
  const tokens = normalized
    .split(" ")
    .filter((t) => t.length >= MIN_QUERY_LENGTH)
    .slice(0, MAX_TOKENS);

  const effectiveTokens =
    tokens.length > 0 ? tokens : normalized.length >= MIN_QUERY_LENGTH ? [normalized] : [];

  const longest = effectiveTokens.reduce((m, t) => Math.max(m, t.length), 0);
  const fuzzyEnabled = normalized.length >= MIN_FUZZY_LENGTH;
  const fuzzyThreshold = !fuzzyEnabled
    ? 1.1
    : longest <= 4
      ? FUZZY_THRESHOLD_SHORT
      : FUZZY_THRESHOLD_DEFAULT;

  return { normalized, tokens: effectiveTokens, fuzzyThreshold };
}

export function fuzzyEnabled(threshold: number): boolean {
  return threshold <= 1.0;
}
