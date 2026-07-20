"use server";

import { query } from "@/lib/db";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import { z } from "zod";

/**
 * Validation schema for nearby listings query
 * Enforces Karachi boundaries and reasonable search parameters
 */
const NearbyListingsSchema = z.object({
  lat: z.number().min(24.7).max(25.0, "Latitude must be within Karachi bounds"),
  lng: z
    .number()
    .min(66.9)
    .max(67.4, "Longitude must be within Karachi bounds"),
  radius: z.number().min(500).max(50000).default(5000),
  limit: z.number().min(1).max(100).default(50),
});

export type NearbyListingsParams = z.infer<typeof NearbyListingsSchema>;

/**
 * Result type from RPC function
 */
export interface NearbyListing {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_meters: number;
  category_id: number | null;
  category_name: string | null;
  avg_rating: number | null;
  review_count: number | null;
  is_featured: boolean;
  status: string;
  google_maps_url: string | null;
  place_id: string | null;
}

// Nearby listings via PostGIS spatial search, sorted by distance.
export async function getNearbyListings(params: NearbyListingsParams) {
  try {
    const validated = NearbyListingsSchema.parse(params);

    const { rows } = await query(
      `SELECT * FROM get_nearby_listings($1, $2, $3, $4)`,
      [validated.lat, validated.lng, validated.radius, validated.limit],
    );

    return {
      success: true,
      data: (rows || []) as NearbyListing[],
      error: null,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
        data: [] as NearbyListing[],
      };
    }

    captureRouteError(error, { route: "action/getNearbyListings" });
    return {
      success: false,
      error: "An unexpected error occurred",
      data: [] as NearbyListing[],
    };
  }
}

/**
 * Get nearby branches for multi-location listings
 *
 * @param params - Search parameters
 * @returns List of nearby branches sorted by distance
 */
const NearbyBranchesSchema = NearbyListingsSchema.extend({
  listingId: z.number().optional(),
});

export type NearbyBranchesParams = z.infer<typeof NearbyBranchesSchema>;

export interface NearbyBranch {
  id: number;
  listing_id: number;
  listing_name: string;
  branch_name: string;
  address: string;
  latitude: number;
  longitude: number;
  distance_meters: number;
  phone_number: string | null;
  timings: string | null;
  is_open_now: boolean | null;
  is_primary: boolean | null;
}

export async function getNearbyBranches(params: NearbyBranchesParams) {
  try {
    const validated = NearbyBranchesSchema.parse(params);

    const { rows } = await query(
      `SELECT * FROM get_nearby_branches($1, $2, $3, $4, $5)`,
      [
        validated.lat,
        validated.lng,
        validated.radius,
        validated.listingId ?? null,
        validated.limit,
      ],
    );

    return {
      success: true,
      data: (rows || []) as NearbyBranch[],
      error: null,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
        data: [] as NearbyBranch[],
      };
    }

    captureRouteError(error, { route: "action/getNearbyBranches" });
    return {
      success: false,
      error: "An unexpected error occurred",
      data: [] as NearbyBranch[],
    };
  }
}
