import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  LISTING_CARD_COLUMNS,
  REVIEW_COLUMNS,
  toListingCard,
  toListingImage,
  toReview,
  type ListingImageDTO,
  type ListingRowLike,
  type ReviewRowLike,
} from "@/lib/mobile/mappers";
import { isRestaurantCategory } from "@/lib/utils/category-helpers";

export const dynamic = "force-dynamic";

const MAX_GALLERY_IMAGES = 20;
const REVIEW_PREVIEW_LIMIT = 5;

type BankJoin =
  | { name: string | null; logo_url: string | null }
  | { name: string | null; logo_url: string | null }[]
  | null;

/**
 * GET /api/mobile/v1/listings/{slug}
 *
 * Aggregated listing detail for the mobile detail screen - mirrors the data the
 * website's server component (`app/listing/[slug]/page.tsx`) assembles, in one
 * round trip. Published-only; reviewer auth UUIDs are never exposed.
 */
export const GET = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);

  const { slug } = await params;
  const { user, supabase } = await getOptionalMobileUser(request);
  const currentUserId = user?.id ?? null;

  const { data: listingRow, error: listingError } = await supabase
    .from("listings_with_details")
    .select(`${LISTING_CARD_COLUMNS}, place_id, phone_number, email, website`)
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (listingError || !listingRow) {
    throw new MobileApiError("not_found", "Listing not found.", 404);
  }

  const row = listingRow as unknown as ListingRowLike & {
    id: number;
    category_id: number | null;
    place_id: string | null;
    phone_number: string | null;
    email: string | null;
    website: string | null;
  };
  const listingId = row.id;

  const isRestaurant = await isRestaurantCategory(row.category_id);

  const [
    imagesRes,
    menuRes,
    dealsRes,
    hoursRes,
    branchesRes,
    reviewsRes,
    reviewsCountRes,
  ] = await Promise.all([
    supabase
      .from("listing_images")
      .select("id, listing_id, url, alt_text, display_order, is_primary")
      .eq("listing_id", listingId)
      .order("display_order", { ascending: true })
      .limit(50),
    isRestaurant
      ? supabase
          .from("menu_sections")
          .select(
            "id, name, description, display_order, menu_items(id, name, description, price, display_order, image_url, is_available)",
          )
          .eq("listing_id", listingId)
          .order("display_order", { ascending: true })
          .limit(50)
      : Promise.resolve({ data: [] as unknown[] }),
    supabase
      .from("deals")
      .select(
        "id, title, description, discount_value, deal_type, end_date, banks(name, logo_url)",
      )
      .eq("listing_id", listingId)
      .eq("is_active", true)
      .or(`end_date.is.null,end_date.gte.${new Date().toISOString()}`)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("opening_hours")
      .select("id, day_of_week, open_time, close_time, is_closed, branch_id")
      .eq("listing_id", listingId)
      .order("day_of_week", { ascending: true })
      .limit(100),
    supabase
      .from("listing_branches")
      .select(
        "id, name, address, city, latitude, longitude, is_primary, phone_number",
      )
      .eq("listing_id", listingId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(50),
    supabase
      .from("reviews")
      .select(REVIEW_COLUMNS)
      .eq("listing_id", listingId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(REVIEW_PREVIEW_LIMIT)
      .returns<ReviewRowLike[]>(),
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listingId)
      .eq("status", "approved"),
  ]);

  // Favorited flag (only when authenticated; RLS scopes to the caller's rows).
  let favorited = false;
  if (currentUserId) {
    const { data: fav } = await supabase
      .from("favorite_listings")
      .select("listing_id")
      .eq("user_id", currentUserId)
      .eq("listing_id", listingId)
      .maybeSingle();
    favorited = fav != null;
  }

  const allImages = (imagesRes.data ?? []) as Array<{
    id: number;
    url: string;
    alt_text: string | null;
    display_order: number | null;
    is_primary: boolean | null;
  }>;

  const gallery: ListingImageDTO[] = allImages
    .filter((img) => !img.url.includes("/menu/"))
    .slice(0, MAX_GALLERY_IMAGES)
    .map(toListingImage);

  const menuImages = allImages
    .filter((img) => img.url.includes("/menu/"))
    .map((img, index) => ({
      id: img.id,
      url: img.url,
      alt_text: img.alt_text ?? "Menu image",
      display_order: index,
    }));

  const menuSections = (menuRes.data ?? []) as Array<{
    id: number;
    name: string;
    description: string | null;
    display_order: number | null;
    menu_items: Array<{
      id: number;
      name: string;
      description: string | null;
      price: number;
      display_order: number | null;
      image_url: string | null;
      is_available: boolean;
    }>;
  }>;

  const menu = menuSections.map((section) => ({
    id: section.id,
    name: section.name,
    description: section.description,
    display_order: section.display_order,
    items: [...(section.menu_items ?? [])]
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        display_order: item.display_order,
        image_url: item.image_url,
        is_available: item.is_available,
      })),
  }));

  const dealsRows = (dealsRes.data ?? []) as Array<{
    id: number;
    title: string;
    description: string | null;
    discount_value: string | null;
    deal_type: string;
    end_date: string | null;
    banks: BankJoin;
  }>;

  const deals = dealsRows.map((deal) => {
    const bank = Array.isArray(deal.banks) ? deal.banks[0] : deal.banks;
    return {
      id: deal.id,
      title: deal.title,
      description: deal.description,
      discount_value: deal.discount_value,
      deal_type: deal.deal_type,
      end_date: deal.end_date,
      bank: bank ? { name: bank.name, logo_url: bank.logo_url } : null,
    };
  });

  const openingHours = (
    (hoursRes.data ?? []) as Array<{
      id: number;
      day_of_week: number;
      open_time: string | null;
      close_time: string | null;
      is_closed: boolean | null;
      branch_id: number | null;
    }>
  ).map((h) => ({
    id: h.id,
    day_of_week: h.day_of_week,
    // Postgres `time` serializes as HH:MM:SS; the contract surfaces HH:mm.
    open_time: h.open_time ? h.open_time.slice(0, 5) : null,
    close_time: h.close_time ? h.close_time.slice(0, 5) : null,
    is_closed: h.is_closed,
    branch_id: h.branch_id,
  }));

  const branches = (branchesRes.data ?? []) as Array<{
    id: number;
    name: string;
    address: string;
    city: string;
    latitude: number;
    longitude: number;
    is_primary: boolean | null;
    phone_number: string | null;
  }>;

  const reviewsPreview = (reviewsRes.data ?? []).map((r) =>
    toReview(r, currentUserId),
  );

  // If the count query failed, fall back to the preview length rather than
  // reporting 0 (which would wrongly tell the app "no more reviews to fetch").
  const reviewsTotal = reviewsCountRes.error
    ? reviewsPreview.length
    : (reviewsCountRes.count ?? 0);

  const listing = {
    ...toListingCard(row, gallery),
    place_id: row.place_id,
    phone_number: row.phone_number,
    email: row.email,
    website: row.website,
    is_restaurant: isRestaurant,
    favorited,
  };

  return ok({
    listing,
    menu_images: menuImages,
    menu,
    deals,
    opening_hours: openingHours,
    branches,
    reviews_preview: reviewsPreview,
    reviews_total: reviewsTotal,
    flags: {
      hasMenu: isRestaurant && menu.length > 0,
      hasDeals: deals.length > 0,
      hasOpeningHours: openingHours.length > 0,
      hasReviews: reviewsTotal > 0,
      hasMenuImages: menuImages.length > 0,
    },
  });
});
