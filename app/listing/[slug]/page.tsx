import { createServerSupabase } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PremiumListingHero } from "@/components/listing/PremiumListingHeroServer";
import { PremiumGallery } from "@/components/listing/PremiumGallery";
import { ListingFeatures } from "@/components/listing/ListingFeatures";
import { ListingContact } from "@/components/listing/ListingContact";
import { ListingMap } from "@/components/listing/ListingMap";
import { ListingBranches } from "@/components/listing/ListingBranches";
import { ListingPageWrapper } from "@/components/listing/ListingPageWrapper";
import { QuickNavigation } from "@/components/listing/QuickNavigation";
import { MenuImagesViewer } from "@/components/listing/MenuImagesViewer";
import { getListingHeroImages } from "@/lib/utils/listing-images";
import { getFavoritedListingIdsForUser } from "@/lib/utils/favorites-server";
import { isRestaurantCategory } from "@/lib/utils/category-helpers";
import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PremiumHeading } from "@/components/brand/Typography";
import { ReportIssueButton } from "@/components/shared/ReportIssueButton";
import { Suspense } from "react";

// Container Components
import { ReviewsContainer } from "@/components/listing/containers/ReviewsContainer";
import { SimilarListingsContainer } from "@/components/listing/containers/SimilarListingsContainer";
import { MenuContainer } from "@/components/listing/containers/MenuContainer";
import { DealsContainer } from "@/components/listing/containers/DealsContainer";
import { OpeningHoursContainer } from "@/components/listing/containers/OpeningHoursContainer";

// Skeletons
import {
  ReviewsSkeleton,
  SimilarListingsSkeleton,
  MenuSkeleton,
  DealsSkeleton,
  OpeningHoursSkeleton,
} from "@/components/listing/skeletons";

interface ListingPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ListingPage({ params }: ListingPageProps) {
  const publicSupabase = await createServerSupabase({ publicAnon: true });
  const userSupabase = await createServerSupabase();
  const { slug } = await params;

  // Fetch critical listing data
  const { data: listing, error: listingError } = await publicSupabase
    .from("listings_with_details")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (listingError || !listing || !listing.id) {
    if (listingError) {
      console.error("[listing-page] Failed to fetch listing:", {
        slug,
        code: listingError.code,
        message: listingError.message,
      });
    }
    notFound();
  }

  // Fetch images, favorites, section data counts, branches, and opening hours in parallel
  // This allows us to accurately determine which sections to show in QuickNavigation
  const [
    { data: images },
    favSet,
    { count: menuCount },
    { count: dealsCount },
    { count: hoursCount },
    { data: branches },
    { data: _openingHours }, // Not currently used - OpeningHoursContainer fetches its own data
  ] = await Promise.all([
    // Fetch images with reasonable limit (gallery max 20 + menu images)
    publicSupabase
      .from("listing_images")
      .select("*")
      .eq("listing_id", listing.id)
      .order("display_order", { ascending: true })
      .limit(50), // Reasonable limit: 10 gallery + up to 40 menu images
    getFavoritedListingIdsForUser(userSupabase, [listing.id]).catch(
      () => new Set(),
    ),
    // Check if menu exists (only for restaurants)
    publicSupabase
      .from("menu_sections")
      .select("*", { count: "exact", head: true })
      .eq("listing_id", listing.id),
    // Check if active deals exist
    publicSupabase
      .from("deals")
      .select("*", { count: "exact", head: true })
      .eq("listing_id", listing.id)
      .eq("is_active", true)
      .or(`end_date.is.null,end_date.gte.${new Date().toISOString()}`),
    // Check if opening hours exist
    publicSupabase
      .from("opening_hours")
      .select("*", { count: "exact", head: true })
      .eq("listing_id", listing.id),
    // Fetch branches (ordered by primary first, then created_at)
    publicSupabase
      .from("listing_branches")
      .select("*")
      .eq("listing_id", listing.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
    // Fetch opening hours data (for branch display)
    publicSupabase
      .from("opening_hours")
      .select("*")
      .eq("listing_id", listing.id)
      .order("day_of_week", { ascending: true }),
  ]);

  const MAX_GALLERY_IMAGES = 20;

  // Filter out menu images from gallery (they have /menu/ in the URL path)
  const galleryImages = (images || [])
    .filter((img) => !img.url.includes("/menu/"))
    .slice(0, MAX_GALLERY_IMAGES);

  // Extract menu images (separate from gallery)
  const menuImages = (images || [])
    .filter((img) => img.url.includes("/menu/"))
    .map((img, index) => ({
      id: img.id,
      url: img.url,
      alt_text: img.alt_text || "Menu image",
      display_order: index,
    }));

  // Add gallery-only images to listing object
  const listingWithImages = {
    ...listing,
    images: galleryImages,
  };

  // Set favorite flag
  (listing as unknown as { favorited?: boolean }).favorited = favSet.has(
    listing.id,
  );

  // Check if category is restaurant-related via database hierarchy
  // This properly handles subcategories (e.g., "BBQ" under "Eat & Drink")
  const isRestaurant = await isRestaurantCategory(listing.category_id);

  // Calculate section availability flags based on actual data
  const hasMenu = isRestaurant && (menuCount ?? 0) > 0;
  const hasDeals = (dealsCount ?? 0) > 0;
  const hasOpeningHours = (hoursCount ?? 0) > 0;
  // Reviews require at least one branch (ReviewsContainer returns null without branches)
  const hasReviews = (branches?.length ?? 0) > 0;

  // Get real images from listing data
  const heroImages = getListingHeroImages(listingWithImages);
  // Pass full image objects to gallery, not just URLs
  const galleryImageObjects = listingWithImages.images || [];

  // Check if menu images exist (for MenuImagesViewer section)
  const hasMenuImages = menuImages.length > 0;

  return (
    <ListingPageWrapper>
      <div className="min-h-screen bg-background">
        {/* Hero section */}
        <PremiumListingHero
          listing={listing}
          images={heroImages}
          withTopMargin={false}
        />

        {/* MainContent */}
        <div className="container mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 md:gap-16 lg:gap-20">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2 space-y-12 md:space-y-16 lg:space-y-20">
              {/* Gallery Section */}
              <PremiumGallery images={galleryImageObjects} title="Photos" />

              {/* Digital Menu Images - Only for Restaurants with actual menu images */}
              {isRestaurant && hasMenuImages && (
                <MenuImagesViewer
                  listingId={listing.id}
                  restaurantName={listing.name || "Restaurant"}
                  initialImages={menuImages}
                />
              )}

              {/* Features & Amenities */}
              <ListingFeatures listing={listing} />

              {/* Menu Section - Only for Restaurants */}
              {isRestaurant && (
                <Suspense fallback={<MenuSkeleton />}>
                  <MenuContainer
                    listingId={listing.id}
                    restaurantName={listing.name || "Restaurant"}
                    menuPdfUrl={listing.menu_pdf_url}
                  />
                </Suspense>
              )}

              {/* Branches/Locations Section - Only for MULTIPLE branches */}
              {branches && branches.length > 1 && (
                <ListingBranches
                  branches={branches}
                  listingName={listing.name || "This Listing"}
                />
              )}

              {/* Map & Location - Show when NO branches OR single branch */}
              {(!branches || branches.length <= 1) && (
                <ListingMap listing={listing} />
              )}

              {/* Contact Information - Only show on mobile when contact data exists (desktop uses sidebar) */}
              {(listing.phone_number ||
                listing.email ||
                listing.website ||
                listing.address) && (
                <div className="md:hidden space-y-6 md:space-y-8">
                  {/* Mobile-First Header */}
                  <div className="md:hidden">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium">
                          <MessageSquare className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <PremiumHeading
                            level={2}
                            dense
                            className="text-foreground"
                          >
                            Contact{" "}
                            <span className="gradient-text-primary">Info</span>
                          </PremiumHeading>
                          <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
                            Get in touch with us
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="px-3 py-1 text-xs font-medium bg-primary/5"
                      >
                        Details
                      </Badge>
                    </div>
                  </div>

                  {/* Desktop Header */}
                  <div className="hidden md:flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium">
                        <MessageSquare className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <PremiumHeading
                          level={2}
                          dense
                          className="text-foreground"
                        >
                          Contact{" "}
                          <span className="gradient-text-primary">
                            Information
                          </span>
                        </PremiumHeading>
                        <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
                          Get in touch with us
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="px-4 py-2 font-semibold border-2 bg-primary/5"
                    >
                      Contact Details
                    </Badge>
                  </div>

                  <div className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-primary/10 backdrop-blur-sm border-2 md:border rounded-2xl p-6 md:p-8">
                    {/* Background effects for consistency */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-50" />
                    <div className="absolute top-4 right-4 w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-xl" />

                    <div className="relative grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-6">
                      {listing.phone_number && (
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20">
                            <svg
                              className="w-5 h-5 md:w-6 md:h-6 text-primary"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                              />
                            </svg>
                          </div>
                          <div>
                            <p className="font-semibold text-sm md:text-base">
                              Phone
                            </p>
                            <p className="text-muted-foreground text-sm md:text-base">
                              {listing.phone_number}
                            </p>
                          </div>
                        </div>
                      )}
                      {listing.email && (
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20">
                            <svg
                              className="w-5 h-5 md:w-6 md:h-6 text-primary"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                          <div>
                            <p className="font-semibold text-sm md:text-base">
                              Email
                            </p>
                            <p className="text-muted-foreground text-sm md:text-base break-all">
                              {listing.email}
                            </p>
                          </div>
                        </div>
                      )}
                      {listing.website && (
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20">
                            <svg
                              className="w-5 h-5 md:w-6 md:h-6 text-primary"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"
                              />
                            </svg>
                          </div>
                          <div>
                            <p className="font-semibold text-sm md:text-base">
                              Website
                            </p>
                            <a
                              href={listing.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-sm md:text-base break-all"
                            >
                              Visit Website
                            </a>
                          </div>
                        </div>
                      )}
                      {listing.address && (
                        <div className="flex items-start gap-3 md:gap-4 md:col-span-2">
                          <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20 mt-1">
                            <svg
                              className="w-5 h-5 md:w-6 md:h-6 text-primary"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                            </svg>
                          </div>
                          <div>
                            <p className="font-semibold text-sm md:text-base">
                              Address
                            </p>
                            <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                              {listing.address}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Opening Hours Section */}
              <Suspense fallback={<OpeningHoursSkeleton />}>
                <OpeningHoursContainer listingId={listing.id} />
              </Suspense>

              {/* Deals & Discounts Section */}
              <Suspense fallback={<DealsSkeleton count={2} />}>
                <DealsContainer
                  listingId={listing.id}
                  businessName={listing.name || "Business"}
                />
              </Suspense>

              {/* Reviews Section */}
              <Suspense fallback={<ReviewsSkeleton count={3} />}>
                <ReviewsContainer
                  listingId={listing.id}
                  listingName={listing.name || "this place"}
                />
              </Suspense>

              {/* Similar Listings */}
              <Suspense fallback={<SimilarListingsSkeleton count={4} />}>
                <SimilarListingsContainer
                  listingId={listing.id}
                  categoryId={listing.category_id}
                />
              </Suspense>
            </div>

            {/* Right Column - Sticky Sidebar */}
            <div className="lg:sticky lg:top-20 lg:self-start space-y-8 md:space-y-10 lg:space-y-12">
              {/* Quick Navigation - Only shows links to sections that actually have data */}
              <QuickNavigation
                listing={listing}
                hasMenu={hasMenu}
                hasDeals={hasDeals}
                hasOpeningHours={hasOpeningHours}
                hasReviews={hasReviews}
              />

              {/* Contact Section */}
              <ListingContact listing={listing} />

              {/* Report Incorrect Information */}
              <div className="text-center">
                <ReportIssueButton
                  reportType="listing"
                  itemId={listing.id}
                  itemName={listing.name || ""}
                  itemSlug={listing.slug || ""}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ListingPageWrapper>
  );
}

// Generate static params for ISR (top 20 listings)
export async function generateStaticParams() {
  // Use createClient at build time (no cookies needed)
  const { createClient } = await import("@supabase/supabase-js");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data: listings } = await supabase
    .from("listings")
    .select("slug")
    .eq("status", "published")
    .order("display_order", { ascending: false })
    .limit(20);

  return (listings || []).map((listing) => ({
    slug: listing.slug,
  }));
}

// Generate metadata for SEO
export async function generateMetadata({ params }: ListingPageProps) {
  // Use createClient at build time (no cookies needed for public data)
  const { createClient } = await import("@supabase/supabase-js");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { slug } = await params;

  const { data: listing } = await supabase
    .from("listings_with_details")
    .select("name, description")
    .eq("slug", slug)
    .single();

  if (!listing) {
    return {
      title: "Listing Not Found",
    };
  }

  return {
    title: `${listing.name} - Inside Karachi`,
    description:
      listing.description?.substring(0, 160) ||
      `Discover ${listing.name} on Inside Karachi`,
  };
}

// Enable ISR with 1 hour revalidation
export const revalidate = 3600;
