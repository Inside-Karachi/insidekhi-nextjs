import { Database } from "@/types/database";

type Listing = Database["public"]["Views"]["listings_with_details"]["Row"];

// Extended listing type that includes images
type ListingWithImages = Listing & {
  images?: Array<{
    id: number;
    listing_id: number;
    url: string;
    alt_text: string | null;
    display_order: number | null;
    is_primary: boolean | null;
    created_at: string;
    updated_at: string;
  }>;
};

/**
 * Extract image URL from listing's images array or custom_attributes or provide fallback
 */
export function getListingImageUrl(
  listing: Listing | ListingWithImages
): string {
  // Try to get image from listing.images array (primary method)
  const listingWithImages = listing as ListingWithImages;

  if (
    listingWithImages.images &&
    Array.isArray(listingWithImages.images) &&
    listingWithImages.images.length > 0
  ) {
    const images = listingWithImages.images;
    // Find primary image or return first image
    const primaryImage = images.find((img) => img.is_primary);
    if (primaryImage) {
      return primaryImage.url;
    }
    // Sort by display_order and return first
    const sortedImages = images.sort(
      (a, b) => (a.display_order || 0) - (b.display_order || 0)
    );
    if (sortedImages.length > 0) {
      return sortedImages[0].url;
    }
  }

  // Try to get image from custom_attributes
  if (
    listing.custom_attributes &&
    typeof listing.custom_attributes === "object" &&
    !Array.isArray(listing.custom_attributes)
  ) {
    const attributes = listing.custom_attributes as { image_url?: string };
    if (attributes.image_url) {
      return attributes.image_url;
    }
  }

  // Fallback to name-based mapping for known listings
  const imageMap: Record<string, string> = {
    "Testkitchen by Okra":
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=400&fit=crop&crop=center&auto=format&q=80",
    "Ocean Mall":
      "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=600&h=400&fit=crop&crop=center&auto=format&q=80",
    "Arena Gaming":
      "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&h=400&fit=crop&crop=center&auto=format&q=80",
    "Kolachi Restaurant":
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=400&fit=crop&crop=center&auto=format&q=80",
    "Cafe Flo":
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&h=400&fit=crop&crop=center&auto=format&q=80",
    "Movenpick Hotel":
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=400&fit=crop&crop=center&auto=format&q=80",
    "Pearl Continental Hotel":
      "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=600&h=400&fit=crop&crop=center&auto=format&q=80",
  };

  if (listing.name && imageMap[listing.name]) {
    return imageMap[listing.name];
  }

  // Category-based fallbacks
  const categoryName = listing.category_name?.toLowerCase() || "";

  if (
    categoryName.includes("eat") ||
    categoryName.includes("drink") ||
    categoryName.includes("restaurant") ||
    categoryName.includes("food")
  ) {
    return "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=400&fit=crop&crop=center&auto=format&q=80";
  } else if (categoryName.includes("stay") || categoryName.includes("hotel")) {
    return "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=400&fit=crop&crop=center&auto=format&q=80";
  } else if (
    categoryName.includes("shopping") ||
    categoryName.includes("mall")
  ) {
    return "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=600&h=400&fit=crop&crop=center&auto=format&q=80";
  } else if (
    categoryName.includes("entertainment") ||
    categoryName.includes("fun")
  ) {
    return "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&h=400&fit=crop&crop=center&auto=format&q=80";
  } else if (
    categoryName.includes("things to do") ||
    categoryName.includes("attraction")
  ) {
    return "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop&crop=center&auto=format&q=80";
  } else {
    // Default fallback
    return "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop&crop=center&auto=format&q=80";
  }
}

/**
 * Get multiple images for gallery display
 */
export function getListingGalleryImages(listing: ListingWithImages): string[] {
  // Check if listing has real images from database
  if (
    listing.images &&
    Array.isArray(listing.images) &&
    listing.images.length > 0
  ) {
    // Sort by display_order and return URLs
    const sortedImages = listing.images
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      .map((image) => image.url);

    // Return all images (no arbitrary limit)
    return sortedImages;
  }

  // Fallback to category-based images if no real images
  const mainImage = getListingImageUrl(listing);
  const categoryName = listing.category_name?.toLowerCase() || "";

  // Start with the main image
  const images = [mainImage];

  // Add category-appropriate additional images for gallery
  if (
    categoryName.includes("eat") ||
    categoryName.includes("drink") ||
    categoryName.includes("restaurant") ||
    categoryName.includes("food")
  ) {
    images.push(
      "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1585238342024-78d387f4a707?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&h=600&fit=crop&crop=center&auto=format&q=80"
    );
  } else if (categoryName.includes("stay") || categoryName.includes("hotel")) {
    images.push(
      "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&h=600&fit=crop&crop=center&auto=format&q=80"
    );
  } else if (
    categoryName.includes("shopping") ||
    categoryName.includes("mall")
  ) {
    images.push(
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1519201945132-7b9e46fa5c91?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=800&h=600&fit=crop&crop=center&auto=format&q=80"
    );
  } else if (
    categoryName.includes("entertainment") ||
    categoryName.includes("fun")
  ) {
    images.push(
      "https://images.unsplash.com/photo-1489599511986-c2c2c3c8e4b8?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=600&fit=crop&crop=center&auto=format&q=80"
    );
  } else {
    // Default additional images
    images.push(
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1444927714506-8492d94b5ba0?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop&crop=center&auto=format&q=80"
    );
  }

  return images; // No limit
}

/**
 * Get hero images for the listing hero section
 */
export function getListingHeroImages(listing: ListingWithImages): string[] {
  // Check if listing has real images from database
  if (
    listing.images &&
    Array.isArray(listing.images) &&
    listing.images.length > 0
  ) {
    // Sort by display_order and return URLs, prioritizing primary image
    const sortedImages = listing.images
      .sort((a, b) => {
        // Primary image first, then by display_order
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return (a.display_order || 0) - (b.display_order || 0);
      })
      .map((image) => image.url);

    // Return all images (hero slider can handle unlimited)
    return sortedImages;
  }

  // Fallback to category-based images if no real images
  const mainImage = getListingImageUrl(listing);
  const categoryName = listing.category_name?.toLowerCase() || "";

  // For hero, we want 5-6 high-quality images for a better slider experience
  const images = [mainImage];

  if (
    categoryName.includes("eat") ||
    categoryName.includes("drink") ||
    categoryName.includes("restaurant") ||
    categoryName.includes("food")
  ) {
    images.push(
      "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1585238342024-78d387f4a707?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=1200&h=800&fit=crop&crop=center&auto=format&q=80"
    );
  } else if (categoryName.includes("stay") || categoryName.includes("hotel")) {
    images.push(
      "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&h=800&fit=crop&crop=center&auto=format&q=80"
    );
  } else if (
    categoryName.includes("shopping") ||
    categoryName.includes("mall")
  ) {
    images.push(
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1519201945132-7b9e46fa1db4?w=1200&h=800&fit=crop&crop=center&auto=format&q=80"
    );
  } else if (
    categoryName.includes("entertainment") ||
    categoryName.includes("fun")
  ) {
    images.push(
      "https://images.unsplash.com/photo-1489599511986-c2c2c3c8e4b8?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=800&fit=crop&crop=center&auto=format&q=80"
    );
  } else {
    images.push(
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1444927714506-8492d94b5ba0?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=800&fit=crop&crop=center&auto=format&q=80"
    );
  }

  return images; // Return all images for hero slider (component handles pagination)
}

/**
 * Get gallery images for events from event_images table
 */
export function getEventGalleryImages(
  eventImages: Array<{
    id: number;
    event_id: number;
    url: string;
    alt_text?: string | null;
    is_primary?: boolean | null;
    display_order?: number | null;
    created_at?: string | null;
  }> | null
): string[] {
  if (!eventImages || eventImages.length === 0) {
    // Return diverse placeholder images for events
    return [
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=600&fit=crop&crop=center&auto=format&q=80",
    ];
  }

  // Sort by display_order, then by is_primary (primary images first), then by created_at
  const sortedImages = [...eventImages].sort((a, b) => {
    // Primary images first
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;

    // Then by display_order
    const aOrder = a.display_order ?? 999;
    const bOrder = b.display_order ?? 999;
    if (aOrder !== bOrder) return aOrder - bOrder;

    // Finally by created_at (newest first)
    const aDate = new Date(a.created_at || 0).getTime();
    const bDate = new Date(b.created_at || 0).getTime();
    return bDate - aDate;
  });

  // Extract URLs and limit to reasonable number for gallery
  return sortedImages.slice(0, 10).map((img) => img.url);
}
