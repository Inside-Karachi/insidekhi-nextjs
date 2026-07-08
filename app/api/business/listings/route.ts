import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  verifyBusinessOwner,
  apiSuccess,
  apiError,
  handleApiError,
  getPaginationParams,
  calculatePagination,
} from "@/lib/business-owner/api-utils";
import type {
  BusinessOwnerListing,
  PaginatedResponse,
} from "@/types/business-owner.types";
import { z } from "zod";
import { generateSlug } from "@/lib/utils/export-import-utils";

/**
 * GET /api/business/listings
 * Get all listings owned by the authenticated business owner
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const userId = await verifyBusinessOwner();

    const supabase = await createServerSupabase();
    const { searchParams } = new URL(request.url);

    // Parse filters
    const status = searchParams.get("status") || undefined;
    const { page, limit } = getPaginationParams(searchParams);

    // Calculate offset
    const offset = (page - 1) * limit;

    // Build query directly instead of using RPC (avoids role vs active_role mismatch)
    let query = supabase
      .from("listings")
      .select(
        `
        id,
        name,
        slug,
        status,
        category_id,
        created_at
      `,
        { count: "exact" },
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    // Apply status filter if provided
    if (status) {
      query = query.eq(
        "status",
        status as
          | "draft"
          | "published"
          | "pending_approval"
          | "archived"
          | "rejected",
      );
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: listings, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch listings: ${error.message}`);
    }

    const listingIds = (listings || []).map((listing) => listing.id);

    const isDeletionRequest = (request: {
      change_type: string;
      proposed_data: unknown;
    }) => {
      if (request.change_type === "delete_request") {
        return true;
      }

      if (
        request.change_type === "major_update" &&
        request.proposed_data &&
        typeof request.proposed_data === "object" &&
        !Array.isArray(request.proposed_data)
      ) {
        const payload = request.proposed_data as Record<string, unknown>;
        return (
          payload.request_kind === "delete_request" ||
          payload.action === "archive"
        );
      }

      return false;
    };

    // Fetch pending deletion requests in one query for owner UX context.
    const { data: pendingDeletionRequests } =
      listingIds.length > 0
        ? await supabase
            .from("listing_change_requests")
            .select(
              "id, listing_id, reason, created_at, change_type, proposed_data",
            )
            .eq("status", "pending")
            .in("listing_id", listingIds)
        : {
            data: [] as Array<{
              id: number;
              listing_id: number;
              reason: string | null;
              created_at: string;
              change_type: string;
              proposed_data: unknown;
            }>,
          };

    const pendingDeletionByListingId = new Map(
      (pendingDeletionRequests || [])
        .filter(isDeletionRequest)
        .map((request) => [
          request.listing_id,
          {
            id: request.id,
            reason: request.reason,
            created_at: request.created_at,
          },
        ]),
    );

    // Get branches, images, and review stats for each listing
    const enrichedListings = await Promise.all(
      (listings || []).map(async (listing) => {
        const [branchesResult, imagesResult, reviewsResult] = await Promise.all(
          [
            supabase
              .from("listing_branches")
              .select("id", { count: "exact", head: true })
              .eq("listing_id", listing.id),
            supabase
              .from("listing_images")
              .select("id", { count: "exact", head: true })
              .eq("listing_id", listing.id),
            supabase
              .from("reviews")
              .select("rating", { count: "exact" })
              .eq("listing_id", listing.id)
              .eq("status", "approved"),
          ],
        );

        // Calculate average rating
        const avgRating =
          reviewsResult.data && reviewsResult.data.length > 0
            ? reviewsResult.data.reduce((acc, r) => acc + (r.rating || 0), 0) /
              reviewsResult.data.length
            : 0;

        return {
          ...listing,
          total_views: 0, // TODO: Implement view tracking
          avg_rating: avgRating,
          total_reviews: reviewsResult.count || 0,
          branches_count: branchesResult.count || 0,
          images_count: imagesResult.count || 0,
          deletion_request: pendingDeletionByListingId.get(listing.id) || null,
        };
      }),
    );

    // Build response
    const response: PaginatedResponse<BusinessOwnerListing> = {
      items: enrichedListings,
      pagination: calculatePagination(count || 0, page, limit),
    };

    return apiSuccess(response);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/business/listings
 * Create a new listing (status = draft) for business owner
 */

// Validation schema for listing creation
const createListingSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .min(3, "Name must be at least 3 characters")
    .max(200, "Name must not exceed 200 characters"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(5000, "Description must not exceed 5000 characters")
    .nullish(),
  category_id: z
    .number({ required_error: "Category is required" })
    .int()
    .positive("Category ID must be a positive number"),
  address: z
    .string()
    .min(5, "Address must be at least 5 characters")
    .max(500, "Address is too long")
    .nullish(),
  phone_number: z
    .string()
    .transform((val) => {
      if (!val) return val;
      // Strip spaces, dashes, parentheses for validation
      return val.replace(/[\s\-()]/g, "");
    })
    .pipe(
      z
        .string()
        .regex(
          /^(\+92|92|0)[0-9]{10,11}$/,
          "Phone number must be a valid Pakistani mobile or landline (e.g., 03001234567 or 02112345678)",
        ),
    )
    .nullish(),
  email: z.string().email("Invalid email address").nullish(),
  website: z
    .string()
    .transform((val) => {
      if (!val) return val;
      // Add https:// if no protocol present
      if (!/^https?:\/\//i.test(val)) {
        return `https://${val}`;
      }
      return val;
    })
    .pipe(z.string().url("Invalid website URL"))
    .nullish(),
  facebook_url: z
    .string()
    .transform((val) => {
      if (!val) return val;
      if (!/^https?:\/\//i.test(val)) {
        return `https://${val}`;
      }
      return val;
    })
    .pipe(z.string().url("Invalid Facebook URL"))
    .nullish(),
  instagram_url: z
    .string()
    .transform((val) => {
      if (!val) return val;
      if (!/^https?:\/\//i.test(val)) {
        return `https://${val}`;
      }
      return val;
    })
    .pipe(z.string().url("Invalid Instagram URL"))
    .nullish(),
  whatsapp_number: z
    .string()
    .transform((val) => {
      if (!val) return val;
      // Strip spaces, dashes, parentheses for consistency
      return val.replace(/[\s\-()]/g, "");
    })
    .nullish(),
  parking_information: z.string().max(500).nullish(),
  parking_amenities: z.array(z.string()).nullish(),
});

export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const userId = await verifyBusinessOwner();

    const supabase = await createServerSupabase();

    // Parse and validate request body
    const rawBody = await request.json();

    // Preprocess: convert empty strings to null for optional fields
    const body = Object.fromEntries(
      Object.entries(rawBody).map(([key, value]) => [
        key,
        value === "" ? null : value,
      ]),
    );

    const validationResult = createListingSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("Validation failed:", validationResult.error.flatten()); // Debug log
      return apiError(
        "Validation failed",
        400,
        "VALIDATION_ERROR",
        validationResult.error.flatten().fieldErrors,
      );
    }

    const validatedData = validationResult.data;

    // Generate unique slug from name
    const baseSlug = generateSlug(validatedData.name);

    // Check if slug already exists and make it unique if needed
    const { data: existingListing } = await supabase
      .from("listings")
      .select("slug")
      .eq("slug", baseSlug)
      .single();

    // If slug exists, append timestamp to ensure uniqueness
    const slug = existingListing
      ? `${baseSlug}-${Date.now().toString(36)}`
      : baseSlug;

    // Create listing with status='draft' and owner_id=userId
    const { data: newListing, error: insertError } = await supabase
      .from("listings")
      .insert({
        name: validatedData.name,
        slug: slug,
        description: validatedData.description || null,
        category_id: validatedData.category_id,
        address: validatedData.address || null,
        phone_number: validatedData.phone_number || null,
        email: validatedData.email || null,
        website: validatedData.website || null,
        facebook_url: validatedData.facebook_url || null,
        instagram_url: validatedData.instagram_url || null,
        whatsapp_number: validatedData.whatsapp_number || null,
        parking_information: validatedData.parking_information || null,
        parking_amenities: validatedData.parking_amenities || [],
        owner_id: userId,
        status: "draft", // Default status for business owner creations
        is_featured: false,
        display_order: 0,
      })
      .select("id, slug, status, name")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return apiError(
        `Failed to create listing: ${insertError.message}`,
        500,
        "INSERT_ERROR",
      );
    }

    return apiSuccess(
      {
        id: newListing.id,
        slug: newListing.slug,
        status: newListing.status,
        name: newListing.name,
      },
      "Listing created successfully as draft. Submit for admin review to publish.",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
