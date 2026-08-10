import { queryPaginatedListings } from "@/lib/listings/query-paginated-listings";
import {
  toListingCard,
  toListingImage,
  toNumericListingRow,
  type ListingCardDTO,
  type ListingImageDTO,
} from "@/lib/mobile/mappers";

/**
 * Fetch published ListingCard DTOs for outing planning.
 * Uses the same listings_with_details path as the web browse query.
 */
export async function fetchListingCards(opts: {
  categorySlug?: string | null;
  search?: string | null;
  limit?: number;
}): Promise<ListingCardDTO[]> {
  const limit = Math.min(30, Math.max(1, opts.limit ?? 10));
  const { listings } = await queryPaginatedListings({
    page: 1,
    limit,
    categorySlug: opts.categorySlug ?? null,
    search: opts.search ?? null,
    sort: "top-rated",
  });

  return listings
    .filter((row) => row.id != null)
    .map((row) => {
      const numeric = toNumericListingRow(row as Record<string, unknown>);
      const rawImages = (row.images ?? []) as Array<{
        id: number;
        url: string;
        alt_text: string | null;
        display_order: number | null;
        is_primary: boolean | null;
      }>;
      const images: ListingImageDTO[] = rawImages.map((img) => toListingImage(img));
      return toListingCard(numeric, images);
    });
}

/** Highest rated first; null ratings sink. */
export function byRatingDesc(a: ListingCardDTO, b: ListingCardDTO): number {
  return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
}
