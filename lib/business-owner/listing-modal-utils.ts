import type { Listing } from "@/types/listing.types";

type ListingPatchPayload = Record<string, unknown>;

function compactObject<T extends Record<string, unknown>>(obj: T): T {
  const entries = Object.entries(obj).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as T;
}

function normalizeCategoryId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function normalizeString(value: unknown): string | null | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildBusinessOwnerCreatePayload(
  listingData: Partial<Listing>,
): ListingPatchPayload {
  const payload = {
    name: normalizeString(listingData.name),
    description: normalizeString(listingData.description),
    category_id: normalizeCategoryId(listingData.category_id),
    address: normalizeString(listingData.address),
    phone_number: normalizeString(listingData.phone_number),
    email: normalizeString(listingData.email),
    website: normalizeString(listingData.website),
    facebook_url: normalizeString(listingData.facebook_url),
    instagram_url: normalizeString(listingData.instagram_url),
    whatsapp_number: normalizeString(listingData.whatsapp_number),
    parking_information: normalizeString(listingData.parking_information),
    parking_amenities: Array.isArray(listingData.parking_amenities)
      ? listingData.parking_amenities
      : undefined,
  };

  return compactObject(payload);
}

export function buildBusinessOwnerUpdatePayload(
  listingData: Partial<Listing>,
): ListingPatchPayload {
  const payload = {
    name: normalizeString(listingData.name),
    description: normalizeString(listingData.description),
    category_id: normalizeCategoryId(listingData.category_id),
    address: normalizeString(listingData.address),
    phone_number: normalizeString(listingData.phone_number),
    email: normalizeString(listingData.email),
    website: normalizeString(listingData.website),
    latitude:
      typeof listingData.latitude === "number" ? listingData.latitude : undefined,
    longitude:
      typeof listingData.longitude === "number"
        ? listingData.longitude
        : undefined,
    custom_attributes: listingData.custom_attributes,
    facebook_url: normalizeString(listingData.facebook_url),
    instagram_url: normalizeString(listingData.instagram_url),
    whatsapp_number: normalizeString(listingData.whatsapp_number),
    youtube_url: normalizeString(listingData.youtube_url),
    google_maps_url: normalizeString(listingData.google_maps_url),
    parking_information: normalizeString(listingData.parking_information),
    parking_amenities: Array.isArray(listingData.parking_amenities)
      ? listingData.parking_amenities
      : undefined,
  };

  return compactObject(payload);
}
