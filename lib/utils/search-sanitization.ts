/**
 * Escape PostgREST/ilike special characters to prevent query parsing issues.
 */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[&|:*!()\\'"%]/g, " ").trim();
}
