/**
 * FIELD MAPPER
 * Transforms Peekaboo entity data to Inside Karachi database schema
 */

import type {
  PeekabooEntity,
  PeekabooBranch,
  PeekabooRichContent,
  MappedListing,
  MappedBranch,
  MappedImage,
} from "@/types/peekaboo-scraper.types";
import { SYNC_CONFIG } from "../config";
import { openingHoursParser } from "./opening-hours-parser";

export class FieldMapper {
  /**
   * Format phone number
   */
  private formatPhone(phone?: string | string[]): string | null {
    if (!phone) return null;

    // Handle array of phone numbers
    if (Array.isArray(phone)) {
      return phone[0]?.trim() || null;
    }

    return phone.trim() || null;
  }

  /**
   * Format WhatsApp number (convert to E.164 format)
   */
  private formatWhatsApp(whatsapp?: string): string | null {
    if (!whatsapp) return null;

    // Clean number (remove spaces, hyphens, etc.)
    const cleaned = whatsapp.replace(/[^\d+]/g, "");

    // Ensure it starts with +
    if (!cleaned.startsWith("+")) {
      return `+92${cleaned}`; // Assume Pakistan if no country code
    }

    return cleaned || null;
  }

  /**
   * Clean and validate URL
   */
  private cleanUrl(
    url?: string,
    excludeSocial: boolean = false,
  ): string | null {
    if (!url) return null;

    const trimmed = url.trim();
    if (!trimmed) return null;

    // Exclude social media URLs if requested (for website field)
    if (excludeSocial) {
      const socialDomains = [
        "facebook.com",
        "instagram.com",
        "twitter.com",
        "youtube.com",
      ];
      if (
        socialDomains.some((domain) => trimmed.toLowerCase().includes(domain))
      ) {
        return null;
      }
    }

    // Add protocol if missing
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      return `https://${trimmed}`;
    }

    return trimmed;
  }

  /**
   * Generate slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /**
   * Extract images from richContent
   */
  /**
   * Extract images from richContent with types
   */
  public extractImages(
    richContent?: PeekabooRichContent,
  ): Array<{ url: string; type: "cover" | "logo" | "gallery" | "menu" }> {
    if (!richContent) return [];

    const images: Array<{
      url: string;
      type: "cover" | "logo" | "gallery" | "menu";
    }> = [];

    // Add cover image(s)
    if (richContent.cover?.content) {
      if (Array.isArray(richContent.cover.content)) {
        richContent.cover.content.forEach((url) => {
          if (url && url.trim()) images.push({ url, type: "cover" });
        });
      } else if (richContent.cover.content.trim()) {
        images.push({ url: richContent.cover.content, type: "cover" });
      }
    }

    // Add logo
    if (richContent.logo?.content && richContent.logo.content.trim()) {
      images.push({ url: richContent.logo.content, type: "logo" });
    }

    // Add gallery images
    if (
      richContent.gallery?.content &&
      Array.isArray(richContent.gallery.content)
    ) {
      richContent.gallery.content.forEach((url) => {
        if (url && url.trim()) images.push({ url, type: "gallery" });
      });
    }

    // Add menu images
    if (richContent.menu?.content && Array.isArray(richContent.menu.content)) {
      richContent.menu.content.forEach((url) => {
        if (url && url.trim()) images.push({ url, type: "menu" });
      });
    }

    return images;
  }

  /**
   * Generate Google Maps URL from coordinates
   */
  private generateGoogleMapsUrl(lat: number, long: number): string {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${long}`;
  }

  /**
   * Map Peekaboo entity to Inside Karachi listing schema
   */
  mapToListing(
    entity: PeekabooEntity,
    primaryBranch?: PeekabooBranch,
  ): MappedListing {
    // Use primary branch for address/coordinates if available
    const address = primaryBranch?.address || null;
    const latitude = primaryBranch?.latitude || null;
    const longitude = primaryBranch?.longitude || null;

    // Extract website from social object (Peekaboo stores it there)
    const website =
      this.cleanUrl(entity.social?.website, true) || // Exclude social media
      this.cleanUrl(entity.meta?.website, true) || // Fallback to meta
      null;

    // Extract email from social or meta
    const email = entity.social?.email || entity.meta?.email || null;

    // Extract parking info from meta
    const parkingInfo = entity.meta?.parking || null;

    // Extract timings from primary branch (for opening hours parsing)
    const timings = primaryBranch?.timings || null;

    return {
      // Required fields
      name: entity.name,
      slug: this.generateSlug(entity.name),
      status: SYNC_CONFIG.defaultStatus,

      // Optional basic fields
      description: entity.description || null,
      address,
      latitude,
      longitude,
      phone_number: this.formatPhone(entity.contactNumber),
      website,
      email,
      category_id: null, // Will be mapped separately by CategoryMapper

      // Social links (from social object)
      facebook_url: this.cleanUrl(entity.social?.facebook),
      instagram_url: this.cleanUrl(entity.social?.instagram),
      whatsapp_number: this.formatWhatsApp(entity.social?.whatsapp),
      youtube_url: this.cleanUrl(entity.social?.youtube),
      google_maps_url:
        latitude && longitude
          ? this.generateGoogleMapsUrl(latitude, longitude)
          : null,

      // Metadata (tracked in custom_attributes + dedicated column)
      peekaboo_id: entity.id,
      custom_attributes: {
        peekaboo_slug: entity.slug,
        peekaboo_tags: entity.tags || [],
        peekaboo_last_sync: new Date().toISOString(),
        peekaboo_rating: entity.rating,
        peekaboo_review_count: entity.stats?.reviewsCount,
        peekaboo_package: entity.package,
        peekaboo_timings: timings, // Store for opening hours parsing
        peekaboo_logo_url: this.getLogoUrl(entity), // Logo URL (NOT in gallery)
      },

      // Admin-controlled fields (defaults)
      owner_id: null,
      created_by: null,
      is_featured: false,
      show_member_badge: false,
      display_order: 0,
      parking_information: parkingInfo,
      parking_amenities: [],
    };
  }

  /**
   * Map Peekaboo branch to Inside Karachi listing_branches schema
   * (Renamed from mapToVenue to reflect new architecture)
   */
  mapToBranch(branch: PeekabooBranch, _listingId: number): MappedBranch {
    return {
      name: branch.name,
      address: branch.address,
      city: branch.city || "Karachi",
      country: branch.country || "Pakistan",
      latitude: branch.latitude,
      longitude: branch.longitude,
      phone_number: this.formatPhone(branch.contactNumber),
      timings: branch.timings || null,
      is_open_now: branch.branchOpenNow === "1" || false,
      is_primary: branch.isVerified === 1, // First verified branch becomes primary
      is_verified: branch.isVerified === 1,
      distance_from_center: branch.distance || null,
      peekaboo_branch_id: branch.id, // Top-level for database column
      custom_attributes: {
        peekaboo_city: branch.city,
        peekaboo_timings: branch.timings,
        peekaboo_distance: branch.distance,
      },
      // Parse opening hours from detailed object or fallback to simple string
      opening_hours:
        branch.everyDayTimngs &&
        Object.keys(branch.everyDayTimngs as object).length > 0
          ? openingHoursParser.parseEveryDayTimings(
              branch.everyDayTimngs as Record<string, string>,
            )
          : openingHoursParser.parse(branch.timings),
    };
  }

  /**
   * @deprecated Use mapToBranch instead
   * Kept for backward compatibility during migration
   */
  mapToVenue(branch: PeekabooBranch, listingId: number): MappedBranch {
    return this.mapToBranch(branch, listingId);
  }

  /**
   * Map Peekaboo images to listing images (EXCLUDING logo)
   * Logo should be uploaded but NOT displayed in gallery
   */
  mapToImages(_listingId: number, entity: PeekabooEntity): MappedImage[] {
    const images = this.extractImages(entity.richContent);

    // Filter out logo - it should NOT appear in gallery
    const galleryImages = images.filter((img) => img.type !== "logo");

    return galleryImages.map((img, index) => ({
      image_url: img.url, // Set to the Supabase URL after upload
      display_order: index,
      custom_attributes: {
        peekaboo_original_url: img.url,
        peekaboo_type: img.type,
      },
    }));
  }

  /**
   * Get all image URLs from entity (for image processor)
   * Includes ALL images (cover, logo, gallery, menu) for upload
   */
  getImageUrls(entity: PeekabooEntity): string[] {
    return this.extractImages(entity.richContent).map((img) => img.url);
  }

  /**
   * Get logo URL from entity (for storing in custom_attributes)
   */
  getLogoUrl(entity: PeekabooEntity): string | null {
    const images = this.extractImages(entity.richContent);
    const logo = images.find((img) => img.type === "logo");
    return logo?.url || null;
  }

  /**
   * Validate mapped listing data
   */
  validateListing(listing: MappedListing): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Required field validation
    if (!listing.name || listing.name.trim().length === 0) {
      errors.push("Name is required");
    }

    if (!listing.slug || listing.slug.trim().length === 0) {
      errors.push("Slug is required");
    }

    // Field length validation
    if (listing.name && listing.name.length > 255) {
      errors.push("Name exceeds 255 characters");
    }

    if (listing.description && listing.description.length > 5000) {
      errors.push("Description exceeds 5000 characters");
    }

    // URL validation
    const urlFields = [
      { field: "website", value: listing.website },
      { field: "facebook_url", value: listing.facebook_url },
      { field: "instagram_url", value: listing.instagram_url },
      { field: "youtube_url", value: listing.youtube_url },
    ];

    for (const { field, value } of urlFields) {
      if (value && !value.startsWith("http")) {
        errors.push(`${field} must be a valid URL`);
      }
    }

    // Email validation
    if (listing.email && !listing.email.includes("@")) {
      errors.push("Email must be valid");
    }

    // Coordinate validation
    if (listing.latitude !== null && listing.latitude !== undefined) {
      if (listing.latitude < -90 || listing.latitude > 90) {
        errors.push(`Invalid latitude: ${listing.latitude}`);
      }
    }

    if (listing.longitude !== null && listing.longitude !== undefined) {
      if (listing.longitude < -180 || listing.longitude > 180) {
        errors.push(`Invalid longitude: ${listing.longitude}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate branch data before sync
   */
  validateBranch(branch: MappedBranch): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!branch.name || branch.name.trim().length === 0) {
      errors.push("Branch name is required");
    }

    if (!branch.address || branch.address.trim().length === 0) {
      errors.push("Branch address is required");
    }

    // Coordinate validation
    if (branch.latitude < -90 || branch.latitude > 90) {
      errors.push(`Invalid latitude: ${branch.latitude}`);
    }

    if (branch.longitude < -180 || branch.longitude > 180) {
      errors.push(`Invalid longitude: ${branch.longitude}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * @deprecated Use validateBranch instead
   */
  validateVenue(venue: MappedBranch): { valid: boolean; errors: string[] } {
    return this.validateBranch(venue);
  }
}

// Export singleton instance
export const fieldMapper = new FieldMapper();
