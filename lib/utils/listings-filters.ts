export interface ListingsFilterParams {
  search?: string;
  sort?: string;
  rating?: string;
  category?: string;
  sub?: string;
  deals?: string;
  bank?: string;
  card?: string;
  open_now?: string;
  near?: string;
  lat?: string;
  lng?: string;
}

interface SearchParamReader {
  get(name: string): string | null;
}

/** Canonicalize subcategory query key while supporting legacy subCategory. */
export function getCanonicalSubParam(
  reader: SearchParamReader,
): string | null {
  return reader.get("sub") || reader.get("subCategory") || null;
}

/** Build the filter payload expected by PremiumListingsGrid from route search params. */
export function buildGridSearchParams(
  params: ListingsFilterParams,
  category?: string,
): ListingsFilterParams {
  return {
    search: params.search,
    sort: params.sort,
    rating: params.rating,
    category,
    sub: params.sub,
    deals: params.deals,
    bank: params.bank,
    card: params.card,
    open_now: params.open_now,
    near: params.near,
    lat: params.lat,
    lng: params.lng,
  };
}
