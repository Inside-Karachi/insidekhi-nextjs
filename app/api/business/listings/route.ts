import { NextRequest } from "next/server";
import { query } from "@/lib/db";
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

    const { searchParams } = new URL(request.url);

    // Parse filters
    const status = searchParams.get("status") || undefined;
    const { page, limit } = getPaginationParams(searchParams);

    // Calculate offset
    const offset = (page - 1) * limit;

    // Build WHERE clause: always filter by owner (or legacy created_by), optionally by status
    const whereParams: unknown[] = [userId];
    let whereSql = "(owner_id = $1 OR created_by = $1)";
    if (status) {
      whereParams.push(status);
      whereSql += ` AND status = $${whereParams.length}`;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM listings WHERE ${whereSql}`,
      whereParams,
    );
    const count = parseInt(countResult.rows[0].count, 10);

    const listingsParams = [...whereParams, limit, offset];
    const { rows: listings } = await query(
      `SELECT id, name, slug, status, category_id, created_at
       FROM listings
       WHERE ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${listingsParams.length - 1} OFFSET $${listingsParams.length}`,
      listingsParams,
    );

    const listingIds = listings.map((listing) => listing.id);

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
    const pendingDeletionRequests =
      listingIds.length > 0
        ? (
            await query(
              `SELECT id, listing_id, reason, created_at, change_type, proposed_data
               FROM listing_change_requests
               WHERE status = 'pending' AND listing_id = ANY($1::int[])`,
              [listingIds],
            )
          ).rows
        : [];

    const pendingDeletionByListingId = new Map(
      pendingDeletionRequests
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
      listings.map(async (listing) => {
        const [branchesResult, imagesResult, reviewsResult] = await Promise.all(
          [
            query(
              `SELECT COUNT(*) FROM listing_branches WHERE listing_id = $1`,
              [listing.id],
            ),
            query(
              `SELECT COUNT(*) FROM listing_images WHERE listing_id = $1`,
              [listing.id],
            ),
            query(
              `SELECT rating FROM reviews WHERE listing_id = $1 AND status = 'approved'`,
              [listing.id],
            ),
          ],
        );

        const reviews = reviewsResult.rows;

        // Calculate average rating
        const avgRating =
          reviews.length > 0
            ? reviews.reduce((acc, r) => acc + (r.rating || 0), 0) /
              reviews.length
            : 0;

        return {
          ...listing,
          total_views: 0, // TODO: Implement view tracking
          avg_rating: avgRating,
          total_reviews: reviews.length,
          branches_count: parseInt(branchesResult.rows[0].count, 10),
          images_count: parseInt(imagesResult.rows[0].count, 10),
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
    const { rows: existingListingRows } = await query(
      `SELECT slug FROM listings WHERE slug = $1`,
      [baseSlug],
    );
    const existingListing = existingListingRows[0];

    // If slug exists, append timestamp to ensure uniqueness
    const slug = existingListing
      ? `${baseSlug}-${Date.now().toString(36)}`
      : baseSlug;

    // Create listing with status='draft' and owner_id=userId
    let newListing;
    try {
      const { rows: insertedRows } = await query(
        `INSERT INTO listings (
           name, slug, description, category_id, address, phone_number,
           email, website, facebook_url, instagram_url, whatsapp_number,
           parking_information, parking_amenities, owner_id, status,
           is_featured, display_order
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
           'draft', false, 0
         )
         RETURNING id, slug, status, name`,
        [
          validatedData.name,
          slug,
          validatedData.description || null,
          validatedData.category_id,
          validatedData.address || null,
          validatedData.phone_number || null,
          validatedData.email || null,
          validatedData.website || null,
          validatedData.facebook_url || null,
          validatedData.instagram_url || null,
          validatedData.whatsapp_number || null,
          validatedData.parking_information || null,
          validatedData.parking_amenities || [],
          userId,
        ],
      );
      newListing = insertedRows[0];
    } catch (insertError) {
      console.error("Insert error:", insertError);
      return apiError(
        `Failed to create listing: ${insertError instanceof Error ? insertError.message : "Unknown error"}`,
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
