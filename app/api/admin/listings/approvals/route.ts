import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { createNotification } from "@/lib/notifications/service";
import { getListingCategoryIdsMap } from "@/lib/listings/sync-listing-categories";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

// GET - Get pending listings for approval
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") || "pending_approval";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId],
    );
    const profile = profileRows[0];

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }

    if (!["lister", "admin", "super_admin"].includes(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 },
      );
    }

    const whereParams: unknown[] = [];
    let whereSql = "";
    if (status && status !== "all") {
      whereParams.push(status);
      whereSql = `WHERE status = $${whereParams.length}`;
    }

    let listings, count;
    try {
      const countResult = await query(
        `SELECT COUNT(*) FROM listings ${whereSql}`,
        whereParams,
      );
      count = parseInt(countResult.rows[0].count, 10);

      const offset = (page - 1) * limit;
      const listParams = [...whereParams, limit, offset];
      const listingsResult = await query(
        `SELECT * FROM listings ${whereSql}
         ORDER BY created_at DESC
         LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams,
      );
      listings = listingsResult.rows;
    } catch (error) {
      console.error("Error fetching listings for approval:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch listings" },
        { status: 500 },
      );
    }

    const listingIds = listings.map((listing) => listing.id);
    const categoryIdsByListing = await getListingCategoryIdsMap(listingIds);
    const allCategoryIds = new Set<number>();
    for (const ids of categoryIdsByListing.values()) {
      ids.forEach((id) => allCategoryIds.add(id));
    }
    listings.forEach((l) => {
      if (l.category_id != null) allCategoryIds.add(l.category_id);
    });
    const ownerIds = [
      ...new Set(listings.map((l) => l.owner_id).filter((id) => id != null)),
    ];

    const [categoriesResult, ownersResult] = await Promise.all([
      allCategoryIds.size > 0
        ? query(
            `SELECT id, name, icon_name FROM categories WHERE id = ANY($1::int[])`,
            [[...allCategoryIds]],
          )
        : { rows: [] },
      ownerIds.length > 0
        ? query(
            `SELECT id, full_name FROM profiles WHERE id = ANY($1::uuid[])`,
            [ownerIds],
          )
        : { rows: [] },
    ]);

    const categoryById = new Map(categoriesResult.rows.map((c) => [c.id, c]));
    const ownerById = new Map(ownersResult.rows.map((o) => [o.id, o]));

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

    const pendingDeleteRequests =
      listingIds.length > 0
        ? (
            await query(
              `SELECT id, listing_id, change_type, reason, created_at, proposed_data
               FROM listing_change_requests
               WHERE status = 'pending' AND listing_id = ANY($1::int[])`,
              [listingIds],
            )
          ).rows
        : [];

    const deleteRequestByListingId = new Map(
      pendingDeleteRequests
        .filter(isDeletionRequest)
        .map((request) => [
          request.listing_id,
          {
            id: request.id,
            change_type: request.change_type,
            reason: request.reason,
            created_at: request.created_at,
          },
        ]),
    );

    const listingsWithRequestContext = listings.map((listing) => {
      const ids =
        categoryIdsByListing.get(listing.id) ??
        (listing.category_id != null ? [listing.category_id] : []);
      return {
        ...listing,
        categories: ids
          .map((id) => categoryById.get(id))
          .filter((c): c is { id: number; name: string; icon_name: string | null } => !!c),
        profiles: ownerById.get(listing.owner_id) || null,
        deletion_request: deleteRequestByListingId.get(listing.id) || null,
      };
    });

    const [draftResult, pendingResult, publishedResult, rejectedResult] =
      await Promise.all([
        query(`SELECT COUNT(*) FROM listings WHERE status = 'draft'`),
        query(`SELECT COUNT(*) FROM listings WHERE status = 'pending_approval'`),
        query(`SELECT COUNT(*) FROM listings WHERE status = 'published'`),
        query(`SELECT COUNT(*) FROM listings WHERE status = 'rejected'`),
      ]);

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      success: true,
      data: {
        listings: listingsWithRequestContext,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        draftCount: parseInt(draftResult.rows[0].count, 10) || 0,
        pendingCount: parseInt(pendingResult.rows[0].count, 10) || 0,
        publishedCount: parseInt(publishedResult.rows[0].count, 10) || 0,
        rejectedCount: parseInt(rejectedResult.rows[0].count, 10) || 0,
      },
    });
  } catch (error) {
    console.error("Error in listing approvals GET:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST - Approve or reject a listing
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId],
    );
    const profile = profileRows[0];

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }

    if (!["lister", "admin", "super_admin"].includes(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      listing_id,
      action,
      review_notes,
    }: {
      listing_id: number;
      action: "approve" | "reject";
      review_notes?: string;
    } = body;

    if (!listing_id) {
      return NextResponse.json(
        { success: false, error: "Listing ID is required" },
        { status: 400 },
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 },
      );
    }

    if (action === "reject" && !review_notes?.trim()) {
      return NextResponse.json(
        { success: false, error: "Review notes required for rejection" },
        { status: 400 },
      );
    }

    const { rows: listingRows } = await query(
      `SELECT id, name, status, owner_id FROM listings WHERE id = $1`,
      [listing_id],
    );
    const listing = listingRows[0];

    if (!listing) {
      return NextResponse.json(
        { success: false, error: "Listing not found" },
        { status: 404 },
      );
    }

    if (listing.status !== "pending_approval") {
      return NextResponse.json(
        {
          success: false,
          error: "Only pending listings can be approved/rejected",
        },
        { status: 400 },
      );
    }

    let pendingRequest;
    try {
      const result = await query(
        `SELECT id, change_type, proposed_data
         FROM listing_change_requests
         WHERE listing_id = $1 AND status = 'pending'
         LIMIT 1`,
        [listing_id],
      );
      pendingRequest = result.rows[0] || null;
    } catch (pendingDeleteRequestError) {
      console.error(
        "[POST /api/admin/listings/approvals] Failed to load pending delete request",
        {
          listingId: listing_id,
          message:
            pendingDeleteRequestError instanceof Error
              ? pendingDeleteRequestError.message
              : "Unknown error",
        },
      );
      return NextResponse.json(
        { success: false, error: "Failed to process approval context" },
        { status: 500 },
      );
    }

    const proposedData =
      pendingRequest?.proposed_data &&
      typeof pendingRequest.proposed_data === "object" &&
      !Array.isArray(pendingRequest.proposed_data)
        ? (pendingRequest.proposed_data as Record<string, unknown>)
        : null;

    const isDeleteRequest = Boolean(
      pendingRequest &&
        (pendingRequest.change_type === "delete_request" ||
          (pendingRequest.change_type === "major_update" &&
            proposedData &&
            (proposedData.request_kind === "delete_request" ||
              proposedData.action === "archive"))),
    );

    const allowedRestoreStatuses: Database["public"]["Enums"]["listing_status"][] = [
      "draft",
      "published",
      "rejected",
      "archived",
    ];

    const previousStatusCandidate = proposedData?.previous_status;
    const restoreStatus: Database["public"]["Enums"]["listing_status"] =
      typeof previousStatusCandidate === "string" &&
      allowedRestoreStatuses.includes(
        previousStatusCandidate as Database["public"]["Enums"]["listing_status"],
      )
        ? (previousStatusCandidate as Database["public"]["Enums"]["listing_status"])
        : "published";

    const newStatus: Database["public"]["Enums"]["listing_status"] =
      isDeleteRequest
        ? action === "approve"
          ? "archived"
          : restoreStatus
        : action === "approve"
          ? "published"
          : "rejected";

    const reviewedAt = new Date().toISOString();
    const updatedAt = new Date().toISOString();

    let updateError: (Error & { code?: string }) | null = null;
    try {
      await query(
        `UPDATE listings
         SET status = $1, reviewed_at = $2, reviewed_by = $3, review_notes = $4, updated_at = $5
         WHERE id = $6`,
        [newStatus, reviewedAt, session.userId, review_notes || null, updatedAt, listing_id],
      );
    } catch (error) {
      updateError = error as Error & { code?: string };
    }

    // Backward-compatible retry until review metadata columns are migrated.
    if (updateError?.code === "42703") {
      console.warn(
        "[POST /api/admin/listings/approvals] Review metadata columns missing; retrying with status-only payload",
        {
          listingId: listing_id,
          action,
          message: updateError.message,
        },
      );

      try {
        await query(
          `UPDATE listings SET status = $1, updated_at = $2 WHERE id = $3`,
          [newStatus, updatedAt, listing_id],
        );
        updateError = null;
      } catch (fallbackError) {
        updateError = fallbackError as Error & { code?: string };
      }
    }

    if (updateError) {
      console.error("[POST /api/admin/listings/approvals] Error updating listing status", {
        listingId: listing_id,
        action,
        message: updateError.message,
        code: updateError.code,
      });
      return NextResponse.json(
        { success: false, error: "Failed to process approval" },
        { status: 500 },
      );
    }

    if (pendingRequest && isDeleteRequest) {
      try {
        await query(
          `UPDATE listing_change_requests
           SET status = $1, reviewed_by = $2, reviewed_at = $3, review_notes = $4, updated_at = $5
           WHERE id = $6 AND status = 'pending'`,
          [
            action === "approve" ? "approved" : "rejected",
            session.userId,
            new Date().toISOString(),
            review_notes || null,
            new Date().toISOString(),
            pendingRequest.id,
          ],
        );
      } catch (changeRequestUpdateError) {
        console.error(
          "[POST /api/admin/listings/approvals] Failed to finalize delete change request",
          {
            listingId: listing_id,
            changeRequestId: pendingRequest.id,
            message:
              changeRequestUpdateError instanceof Error
                ? changeRequestUpdateError.message
                : "Unknown error",
          },
        );
      }
    }

    try {
      // Only send notification if listing has an owner
      if (listing.owner_id) {
        await createNotification({
          recipientId: listing.owner_id,
          roleScope: "business_owner",
          categorySlug: "general",
          title: isDeleteRequest
            ? action === "approve"
              ? "Listing Deletion Approved"
              : "Listing Deletion Rejected"
            : action === "approve"
              ? "Listing Approved"
              : "Listing Requires Changes",
          body: isDeleteRequest
            ? action === "approve"
              ? `Your deletion request for "${listing.name}" has been approved and the listing is now archived.`
              : `Your deletion request for "${listing.name}" was rejected. ${review_notes || ""}`
            : action === "approve"
              ? `Your listing "${listing.name}" has been approved and is now live!`
              : `Your listing "${listing.name}" needs revisions. ${review_notes || ""}`,
          priority: action === "approve" ? "normal" : "high",
          ctaLabel: "View Listing",
          ctaUrl: `/dashboard/business/listings/${listing.id}`,
          metadata: {
            listing_id: listing.id,
            listing_name: listing.name,
            review_notes: review_notes || "",
            action: action,
            is_delete_request: isDeleteRequest,
            status_after_review: newStatus,
          },
        });
      }
    } catch (notifError) {
      console.error("Failed to send notification:", notifError);
    }

    try {
      const { logAuditEvent } = await import("@/lib/audit");
      await logAuditEvent({
        action: "listing_updated",
        entity_type: "listing",
        entity_id: listing_id.toString(),
        admin_id: session.userId,
        new_values: {
          status: newStatus,
          review_notes: review_notes || "No notes provided",
        },
        metadata: {
          listing_name: listing.name,
          owner_id: listing.owner_id,
        },
        ip_address:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        user_agent: request.headers.get("user-agent") || undefined,
      });
    } catch (logError) {
      console.error("Failed to log action:", logError);
    }

    return NextResponse.json({
      success: true,
      data: {
        listing_id: listing.id,
        status: newStatus,
        message: isDeleteRequest
          ? action === "approve"
            ? "Listing deletion approved and archived successfully"
            : "Listing deletion request rejected successfully"
          : `Listing ${action === "approve" ? "approved" : "rejected"} successfully`,
      },
    });
  } catch (error) {
    console.error("Error in listing approvals POST:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
