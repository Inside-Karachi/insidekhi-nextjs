import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  verifyBusinessOwner,
  verifyListingOwnership,
  apiSuccess,
  apiError,
  handleApiError,
  requiresAdminApproval,
  getChangeRequestType,
} from "@/lib/business-owner/api-utils";
import type { ListingUpdatePayload } from "@/types/business-owner.types";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

function createRequestId(): string {
  return crypto.randomUUID();
}

function listingPatchError(
  requestId: string,
  status: number,
  code: "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "UPDATE_FAILED" | "PENDING_REQUEST_EXISTS" | "INTERNAL_ERROR",
  error: string,
  details?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      success: false,
      code,
      error,
      ...(details ? { details } : {}),
      requestId,
    },
    {
      status,
      headers: {
        "x-request-id": requestId,
      },
    },
  );
}

function logDbError(
  scope: string,
  error: {
    message: string;
    details: string | null;
    hint: string | null;
    code: string;
  },
  meta: Record<string, unknown> = {},
) {
  console.error(scope, {
    ...meta,
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  });
}

/**
 * GET /api/business/listings/[id]
 * Get a single listing with full details
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const listingId = parseInt(id, 10);

    if (isNaN(listingId)) {
      return apiError("Invalid listing ID", 400);
    }

    const userId = await verifyBusinessOwner();
    await verifyListingOwnership(userId, listingId);

    // Fetch listing with all related data (joined via separate queries, then stitched)
    let listing;
    try {
      const { rows: listingRows } = await query(
        `SELECT * FROM listings WHERE id = $1`,
        [listingId],
      );
      const listingRow = listingRows[0];

      if (!listingRow) {
        throw new Error(`Failed to fetch listing: not found`);
      }

      const [categoryResult, branchesResult, imagesResult] = await Promise.all([
        listingRow.category_id
          ? query(
              `SELECT id, name, icon_name FROM categories WHERE id = $1`,
              [listingRow.category_id],
            )
          : { rows: [] },
        query(
          `SELECT id, name, address, phone_number, is_primary
           FROM listing_branches WHERE listing_id = $1`,
          [listingId],
        ),
        query(
          `SELECT id, url, alt_text, is_primary, display_order
           FROM listing_images WHERE listing_id = $1`,
          [listingId],
        ),
      ]);

      listing = {
        ...listingRow,
        category: categoryResult.rows[0] || null,
        branches: branchesResult.rows,
        images: imagesResult.rows,
      };
    } catch (error) {
      console.error("[GET /api/business/listings/[id]] Database error:", {
        error,
        listingId,
        userId,
      });
      throw new Error(
        `Failed to fetch listing: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    return apiSuccess(listing);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/business/listings/[id]
 * Update listing (may create change request if major changes)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const requestId = createRequestId();
  let listingIdForLog: number | null = null;
  let userIdForLog: string | null = null;

  try {
    const { id } = await params;
    const listingId = parseInt(id, 10);
    listingIdForLog = listingId;

    if (isNaN(listingId)) {
      return listingPatchError(
        requestId,
        400,
        "VALIDATION_ERROR",
        "Invalid listing ID",
      );
    }

    const userId = await verifyBusinessOwner();
    userIdForLog = userId;
    await verifyListingOwnership(userId, listingId);

    const body: ListingUpdatePayload = await request.json();

    // Validate input
    if (Object.keys(body).length === 0) {
      return listingPatchError(
        requestId,
        400,
        "VALIDATION_ERROR",
        "No update data provided",
      );
    }

    let profile;
    try {
      const { rows: profileRows } = await query(
        `SELECT role, active_role FROM profiles WHERE id = $1`,
        [userId],
      );
      profile = profileRows[0];
    } catch (profileError) {
      logDbError(
        "[PATCH /api/business/listings/[id]] Profile fetch failed",
        {
          message: profileError instanceof Error ? profileError.message : "Unknown error",
          details: null,
          hint: null,
          code: "",
        },
        { listingId, userId },
      );
    }

    if (!profile) {
      throw new Error("Profile not found");
    }

    const effectiveRole = profile.active_role || profile.role;
    const isStrictBusinessOwner = effectiveRole === "business_owner";

    // Never allow direct privileged updates from business-owner role.
    // Business owners can only publish via submit_for_approval flow.
    const sanitizedBody: Record<string, unknown> = { ...body };
    if (isStrictBusinessOwner) {
      delete sanitizedBody.status;
      delete sanitizedBody.is_featured;
      delete sanitizedBody.owner_id;
      delete sanitizedBody.show_member_badge;
      delete sanitizedBody.display_order;
      delete sanitizedBody.menu_pdf_url;
    }

    // Handle submit_for_approval flag separately
    const submit_for_approval =
      sanitizedBody.submit_for_approval as boolean | undefined;
    const { submit_for_approval: _unused, ...restBody } = sanitizedBody;

    // Get current listing data
    let currentListing;
    try {
      const { rows: currentListingRows } = await query(
        `SELECT * FROM listings WHERE id = $1`,
        [listingId],
      );
      currentListing = currentListingRows[0];
    } catch (fetchError) {
      logDbError(
        "[PATCH /api/business/listings/[id]] Listing fetch failed",
        {
          message: fetchError instanceof Error ? fetchError.message : "Unknown error",
          details: null,
          hint: null,
          code: "",
        },
        { listingId, userId },
      );
    }

    if (!currentListing) {
      throw new Error("Listing not found");
    }

    // Handle draft submission for approval
    if (submit_for_approval && currentListing.status === "draft") {
      const submittedAt = new Date().toISOString();
      const updatedAt = new Date().toISOString();

      let submitError: (Error & { code?: string }) | null = null;
      try {
        await query(
          `UPDATE listings SET status = 'pending_approval', submitted_at = $1, updated_at = $2 WHERE id = $3`,
          [submittedAt, updatedAt, listingId],
        );
      } catch (error) {
        submitError = error as Error & { code?: string };
      }

      // Backward-compatible retry while migration is pending.
      if (submitError?.code === "42703") {
        console.warn(
          "[PATCH /api/business/listings/[id]] submitted_at missing; retrying without submitted_at",
          { listingId, userId },
        );

        try {
          await query(
            `UPDATE listings SET status = 'pending_approval', updated_at = $1 WHERE id = $2`,
            [updatedAt, listingId],
          );
          submitError = null;
        } catch (fallbackError) {
          submitError = fallbackError as Error & { code?: string };
        }
      }

      if (submitError) {
        logDbError(
          "[PATCH /api/business/listings/[id]] Submit for approval failed",
          {
            message: submitError.message,
            details: null,
            hint: null,
            code: submitError.code || "",
          },
          {
            listingId,
            userId,
            currentStatus: currentListing.status,
            targetStatus: "pending_approval",
          },
        );
        throw new Error(`Failed to submit listing: ${submitError.message}`);
      }

      // Notify admins of pending listing
      let adminCount = 0;
      try {
        const { createNotification } =
          await import("@/lib/notifications/service");
        const { rows: admins } = await query(
          `SELECT id FROM profiles WHERE role::text = ANY($1::text[])`,
          [["lister", "admin", "super_admin"]],
        );

        adminCount = admins?.length ?? 0;

        if (admins && admins.length > 0) {
          await Promise.all(
            admins.map((admin) =>
              createNotification({
                recipientId: admin.id,
                roleScope: "admin",
                categorySlug: "general",
                title: "New Listing Awaits Approval",
                body: `${currentListing.name} has been submitted for review by a business owner`,
                priority: "normal",
                ctaLabel: "Review Listing",
                ctaUrl: `/admin/listings/approvals`,
                metadata: {
                  listing_id: listingId,
                  listing_name: currentListing.name,
                  owner_id: userId,
                },
              }),
            ),
          );
        }
      } catch (notifError) {
        const errorCause =
          typeof notifError === "object" &&
          notifError !== null &&
          "cause" in notifError
            ? (notifError as { cause?: unknown }).cause
            : undefined;

        console.error("[PATCH /api/business/listings/[id]] Failed to notify admins", {
          listingId,
          userId,
          adminCount,
          errorMessage:
            notifError instanceof Error ? notifError.message : String(notifError),
          errorStack: notifError instanceof Error ? notifError.stack : undefined,
          errorCause,
        });
      }

      return apiSuccess(
        { status: "pending_approval" },
        "Listing submitted for approval",
      );
    }

    // Check if changes require admin approval
    const needsApproval = requiresAdminApproval(
      currentListing,
      restBody as Record<string, unknown>,
    );

    if (needsApproval) {
      // Check if there's already a pending change request for this listing
      const { rows: existingRequestRows } = await query(
        `SELECT id, created_at, change_type FROM listing_change_requests
         WHERE listing_id = $1 AND status = 'pending'`,
        [listingId],
      );
      const existingRequest = existingRequestRows[0];

      if (existingRequest) {
        return listingPatchError(
          requestId,
          409,
          "PENDING_REQUEST_EXISTS",
          "You already have a pending change request for this listing. Please wait for admin review or cancel the existing request.",
          {
            existingRequestId: existingRequest.id,
            createdAt: existingRequest.created_at,
            changeType: existingRequest.change_type,
          },
        );
      }

      // Create change request instead of direct update
      const changeType = getChangeRequestType(
        currentListing,
        restBody as Record<string, unknown>,
      );

      const priority =
        changeType === "name_change" || changeType === "address_change"
          ? "priority"
          : "normal";

      const reason =
        typeof restBody.reason === "string" ? restBody.reason : null;

      let changeRequest;
      try {
        const { rows: changeRequestRows } = await query(
          `INSERT INTO listing_change_requests
             (listing_id, requested_by, change_type, current_data, proposed_data, reason, status, priority)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
           RETURNING *`,
          [
            listingId,
            userId,
            changeType,
            JSON.stringify(currentListing),
            JSON.stringify(restBody),
            reason,
            priority,
          ],
        );
        changeRequest = changeRequestRows[0];
      } catch (createError) {
        const code =
          createError && typeof createError === "object" && "code" in createError
            ? (createError as { code?: string }).code
            : undefined;
        logDbError(
          "[PATCH /api/business/listings/[id]] Change request create failed",
          {
            message: createError instanceof Error ? createError.message : "Unknown error",
            details: null,
            hint: null,
            code: code || "",
          },
          { listingId, userId, changeType },
        );
        // Handle unique constraint violation gracefully
        if (code === "23505") {
          return listingPatchError(
            requestId,
            409,
            "UPDATE_FAILED",
            "A pending change request already exists for this listing",
            { dbCode: code ?? null },
          );
        }
        throw new Error(
          `Failed to create change request: ${createError instanceof Error ? createError.message : "Unknown error"}`,
        );
      }

      // Notify admins for review
      try {
        const { createNotification } =
          await import("@/lib/notifications/service");
        const { rows: admins } = await query(
          `SELECT id FROM profiles WHERE role::text = ANY($1::text[])`,
          [["lister", "admin", "super_admin"]],
        );

        if (admins && admins.length > 0) {
          await Promise.all(
            admins.map((admin) =>
              createNotification({
                recipientId: admin.id,
                roleScope: "admin",
                categorySlug: "general",
                title: "Listing Change Request",
                body: `${currentListing.name} has requested ${changeType} changes`,
                priority:
                  changeType === "name_change" ||
                  changeType === "category_change"
                    ? "high"
                    : "normal",
                ctaLabel: "Review Changes",
                ctaUrl: `/admin/listings/approvals`,
                metadata: {
                  listing_id: listingId,
                  change_request_id: changeRequest.id,
                  change_type: changeType,
                },
              }),
            ),
          );
        }
      } catch (notifError) {
        console.error("Failed to notify admins:", notifError);
      }

      return apiSuccess(
        {
          change_request_created: true,
          change_request: changeRequest,
          message: "Change request submitted for admin approval",
        },
        "Your changes will be reviewed by an admin",
      );
    }

    // Minor changes - apply directly (reason not needed for direct updates)
    const { reason: _reason, ...updateData } = sanitizedBody;

    // Column names can never be parameterized, so only a fixed whitelist of
    // known listing columns may be written here (Section 7 of the migration guide).
    const ALLOWED_UPDATE_COLUMNS = [
      "name",
      "description",
      "category_id",
      "address",
      "phone_number",
      "email",
      "website",
      "facebook_url",
      "instagram_url",
      "whatsapp_number",
      "youtube_url",
      "google_maps_url",
      "latitude",
      "longitude",
      "custom_attributes",
      "parking_information",
      "parking_amenities",
      "status",
      "is_featured",
      "owner_id",
      "show_member_badge",
      "display_order",
      "menu_pdf_url",
    ];
    const updateKeys = Object.keys(updateData).filter((key) =>
      ALLOWED_UPDATE_COLUMNS.includes(key),
    );

    // Reject unknown fields explicitly rather than silently ignoring them
    const rejectedKeys = Object.keys(updateData).filter(
      (key) => !ALLOWED_UPDATE_COLUMNS.includes(key),
    );
    if (rejectedKeys.length > 0 && updateKeys.length === 0) {
      return listingPatchError(
        requestId,
        400,
        "VALIDATION_ERROR",
        `No valid update fields provided. Unsupported fields: ${rejectedKeys.join(", ")}`,
        { rejectedKeys },
      );
    }

    if (updateKeys.length === 0) {
      return listingPatchError(
        requestId,
        400,
        "VALIDATION_ERROR",
        "No valid update fields provided",
      );
    }

    const setClauses = updateKeys.map(
      (key, idx) => `"${key}" = $${idx + 1}`,
    );
    setClauses.push(`updated_at = $${updateKeys.length + 1}`);
    const values = [
      ...updateKeys.map((key) => {
        const value = (updateData as Record<string, unknown>)[key];
        // JSON/JSONB columns need stringified objects/arrays for node-pg
        if (
          (key === "custom_attributes" || key === "parking_amenities") &&
          value !== null &&
          typeof value === "object"
        ) {
          return JSON.stringify(value);
        }
        return value;
      }),
      new Date().toISOString(),
    ];
    values.push(listingId);

    let updatedListing;
    let updateError: (Error & { code?: string }) | null = null;
    try {
      const { rows: updatedRows } = await query(
        `UPDATE listings SET ${setClauses.join(", ")} WHERE id = $${values.length} RETURNING *`,
        values,
      );
      updatedListing = updatedRows[0];
    } catch (error) {
      updateError = error as Error & { code?: string };
    }

    if (updateError) {
      logDbError(
        "[PATCH /api/business/listings/[id]] Direct listing update failed",
        {
          message: updateError.message,
          details: null,
          hint: null,
          code: updateError.code || "",
        },
        {
          listingId,
          userId,
          updateKeys,
        },
      );
      const isValidationError =
        updateError.code === "23503" || updateError.code === "22P02";
      return listingPatchError(
        requestId,
        isValidationError ? 400 : 500,
        isValidationError ? "VALIDATION_ERROR" : "UPDATE_FAILED",
        "Failed to update listing",
        { dbCode: updateError.code ?? null },
      );
    }

    return apiSuccess(updatedListing, "Listing updated successfully");
  } catch (error) {
    console.error("[PATCH /api/business/listings/[id]] Unhandled error", {
      listingId: listingIdForLog,
      userId: userIdForLog,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) {
        return listingPatchError(requestId, 403, "FORBIDDEN", error.message);
      }
      if (error.message.toLowerCase().includes("not found")) {
        return listingPatchError(requestId, 404, "NOT_FOUND", error.message);
      }
      if (
        error.message.includes("Invalid") ||
        error.message.includes("required")
      ) {
        return listingPatchError(
          requestId,
          400,
          "VALIDATION_ERROR",
          error.message,
        );
      }
    }
    return listingPatchError(
      requestId,
      500,
      "INTERNAL_ERROR",
      "An unexpected error occurred while updating listing",
    );
  }
}

/**
 * DELETE /api/business/listings/[id]
 * Create deletion request for admin approval (no direct archive)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const listingId = parseInt(id, 10);

    if (isNaN(listingId)) {
      return apiError("Invalid listing ID", 400);
    }

    const userId = await verifyBusinessOwner();
    await verifyListingOwnership(userId, listingId);

    const rawBody = await request
      .json()
      .catch(() => ({ reason: "" } as { reason?: string }));
    const deletionReason =
      typeof rawBody.reason === "string" ? rawBody.reason.trim() : "";

    if (!deletionReason) {
      return apiError(
        "Please provide a reason for deletion request",
        400,
        "REASON_REQUIRED",
      );
    }

    let listing;
    try {
      const { rows: listingRows } = await query(
        `SELECT id, name, status, owner_id FROM listings WHERE id = $1`,
        [listingId],
      );
      listing = listingRows[0];
    } catch (listingError) {
      logDbError(
        "[DELETE /api/business/listings/[id]] Listing fetch failed",
        {
          message: listingError instanceof Error ? listingError.message : "Unknown error",
          details: null,
          hint: null,
          code: "",
        },
        { listingId, userId },
      );
    }

    if (!listing) {
      return apiError("Listing not found", 404);
    }

    if (listing.status === "archived") {
      return apiError(
        "This listing is already archived",
        400,
        "ALREADY_ARCHIVED",
      );
    }

    let pendingRequest;
    try {
      const result = await query(
        `SELECT id, change_type, created_at
         FROM listing_change_requests
         WHERE listing_id = $1 AND status = 'pending'
         LIMIT 1`,
        [listingId],
      );
      pendingRequest = result.rows[0] || null;
    } catch (pendingRequestError) {
      logDbError(
        "[DELETE /api/business/listings/[id]] Pending request check failed",
        {
          message: pendingRequestError instanceof Error ? pendingRequestError.message : "Unknown error",
          details: null,
          hint: null,
          code: "",
        },
        { listingId, userId },
      );
      throw new Error("Failed to validate pending requests");
    }

    if (pendingRequest) {
      return apiError(
        "You already have a pending request for this listing. Please wait for admin review.",
        409,
        "PENDING_REQUEST_EXISTS",
        {
          existingRequestId: pendingRequest.id,
          changeType: pendingRequest.change_type,
          createdAt: pendingRequest.created_at,
        },
      );
    }

    const proposedDeleteData = {
      action: "archive",
      previous_status: listing.status,
      request_kind: "delete_request",
      requested_at: new Date().toISOString(),
    };

    let createdRequest;
    let createRequestError: (Error & { code?: string }) | null = null;
    let changeType = "delete_request";
    try {
      const { rows } = await query(
        `INSERT INTO listing_change_requests
           (listing_id, requested_by, change_type, current_data, proposed_data, reason, status, priority)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'priority')
         RETURNING id, status, change_type, created_at`,
        [
          listingId,
          userId,
          changeType,
          JSON.stringify(listing),
          JSON.stringify(proposedDeleteData),
          deletionReason,
        ],
      );
      createdRequest = rows[0];
    } catch (error) {
      createRequestError = error as Error & { code?: string };
    }

    // Backward compatibility: legacy DB constraint may not allow delete_request yet.
    if (
      createRequestError?.code === "23514" &&
      createRequestError.message.includes("valid_change_type")
    ) {
      console.warn(
        "[DELETE /api/business/listings/[id]] Legacy valid_change_type constraint detected, retrying with major_update",
        { listingId, userId },
      );

      changeType = "major_update";
      try {
        const { rows } = await query(
          `INSERT INTO listing_change_requests
             (listing_id, requested_by, change_type, current_data, proposed_data, reason, status, priority)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'priority')
           RETURNING id, status, change_type, created_at`,
          [
            listingId,
            userId,
            changeType,
            JSON.stringify(listing),
            JSON.stringify(proposedDeleteData),
            deletionReason,
          ],
        );
        createdRequest = rows[0];
        createRequestError = null;
      } catch (retryError) {
        createRequestError = retryError as Error & { code?: string };
      }
    }

    if (createRequestError || !createdRequest) {
      if (createRequestError) {
        logDbError(
          "[DELETE /api/business/listings/[id]] Create delete request failed",
          {
            message: createRequestError.message,
            details: null,
            hint: null,
            code: createRequestError.code || "",
          },
          { listingId, userId },
        );
      }

      return apiError(
        "Failed to create deletion request. Please ask admin to run the latest listing change-request migration.",
        500,
        "DELETE_REQUEST_SCHEMA_MISMATCH",
      );
    }

    const submittedAt = new Date().toISOString();
    const updatedAt = new Date().toISOString();

    let submitError: (Error & { code?: string }) | null = null;
    try {
      await query(
        `UPDATE listings SET status = 'pending_approval', submitted_at = $1, updated_at = $2 WHERE id = $3`,
        [submittedAt, updatedAt, listingId],
      );
    } catch (error) {
      submitError = error as Error & { code?: string };
    }

    if (submitError?.code === "42703") {
      try {
        await query(
          `UPDATE listings SET status = 'pending_approval', updated_at = $1 WHERE id = $2`,
          [updatedAt, listingId],
        );
        submitError = null;
      } catch (fallbackError) {
        submitError = fallbackError as Error & { code?: string };
      }
    }

    if (submitError) {
      logDbError(
        "[DELETE /api/business/listings/[id]] Move listing to review queue failed",
        {
          message: submitError.message,
          details: null,
          hint: null,
          code: submitError.code || "",
        },
        { listingId, userId },
      );
      throw new Error(`Failed to submit deletion request: ${submitError.message}`);
    }

    try {
      const { createNotification } = await import("@/lib/notifications/service");
      const { rows: admins } = await query(
        `SELECT id FROM profiles WHERE role::text = ANY($1::text[])`,
        [["lister", "admin", "super_admin"]],
      );

      if (admins && admins.length > 0) {
        await Promise.all(
          admins.map((admin) =>
            createNotification({
              recipientId: admin.id,
              roleScope: "admin",
              categorySlug: "general",
              title: "Listing Deletion Request",
              body: `${listing.name} has requested listing deletion approval`,
              priority: "high",
              ctaLabel: "Review Request",
              ctaUrl: "/admin/listings/approvals",
              metadata: {
                listing_id: listingId,
                listing_name: listing.name,
                change_request_id: createdRequest.id,
                change_type: createdRequest.change_type,
              },
            }),
          ),
        );
      }
    } catch (notifError) {
      console.error("[DELETE /api/business/listings/[id]] Failed to notify admins", {
        listingId,
        userId,
        errorMessage:
          notifError instanceof Error ? notifError.message : String(notifError),
      });
    }

    return apiSuccess(
      {
        change_request_created: true,
        change_request_id: createdRequest.id,
        status: "pending_approval",
      },
      "Deletion request submitted for admin approval",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
