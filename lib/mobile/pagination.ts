export type Pagination = { page: number; limit: number; offset: number };

export type PaginationMeta = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

/**
 * Parses `?page=&limit=` into a clamped `{ page, limit, offset }`.
 * Invalid values fall back to defaults; `limit` is clamped to `[1, maxLimit]`.
 */
export function parsePagination(
  searchParams: URLSearchParams,
  opts?: { defaultLimit?: number; maxLimit?: number; maxPage?: number },
): Pagination {
  const defaultLimit = opts?.defaultLimit ?? 20;
  const maxLimit = opts?.maxLimit ?? 50;

  // Cap page to avoid pathological deep-offset scans (`?page=99999999`).
  const maxPage = opts?.maxPage ?? 10_000;
  const page = Math.min(
    maxPage,
    Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1),
  );
  const limit = Math.min(
    maxLimit,
    Math.max(
      1,
      parseInt(searchParams.get("limit") ?? String(defaultLimit), 10) ||
        defaultLimit,
    ),
  );

  return { page, limit, offset: (page - 1) * limit };
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  totalItems: number,
): PaginationMeta {
  const totalPages = Math.ceil(totalItems / limit);
  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
