import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
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
import type { Database } from "@/types/supabase";
import type { Json } from "@/types/supabase";

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
  code: "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "UPDATE_FAILED" | "INTERNAL_ERROR",
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

    const supabase = await createServerSupabase();

    // Fetch listing with all related data
    // Note: Using specific FK constraint name to resolve ambiguous relationship
    const { data: listing, error } = await supabase
      .from("listings")
      .select(
        `
        *,
        category:categories(id, name, icon_name),
        branches:listing_branches(
          id,
          name,
          address,
          phone_number,
          is_primary
        ),
        images:listing_images!listing_images_listing_id_fkey(
          id,
          url,
          alt_text,
          is_primary,
          display_order
        )
      `,
      )
      .eq("id", listingId)
      .single();

    if (error) {
      console.error("[GET /api/business/listings/[id]] Database error:", {
        error,
        listingId,
        userId,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      throw new Error(`Failed to fetch listing: ${error.message}`);
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

    const supabase = await createServerSupabase();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, active_role")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      if (profileError) {
        logDbError("[PATCH /api/business/listings/[id]] Profile fetch failed", profileError, {
          listingId,
          userId,
        });
      }
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
    const { data: currentListing, error: fetchError } = await supabase
      .from("listings")
      .select("*")
      .eq("id", listingId)
      .single();

    if (fetchError || !currentListing) {
      if (fetchError) {
        logDbError("[PATCH /api/business/listings/[id]] Listing fetch failed", fetchError, {
          listingId,
          userId,
        });
      }
      throw new Error("Listing not found");
    }

    // Handle draft submission for approval
    if (submit_for_approval && currentListing.status === "draft") {
      const submitPayload: Record<string, unknown> = {
        status: "pending_approval",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let { error: submitError } = await supabase
        .from("listings")
        .update(submitPayload)
        .eq("id", listingId);

      // Backward-compatible retry while migration is pending.
      if (
        submitError?.code === "PGRST204" &&
        submitError.message.includes("'submitted_at' column of 'listings'")
      ) {
        console.warn(
          "[PATCH /api/business/listings/[id]] submitted_at missing; retrying without submitted_at",
          { listingId, userId },
        );

        const fallbackPayload = {
          status:
            "pending_approval" as Database["public"]["Enums"]["listing_status"],
          updated_at: new Date().toISOString(),
        };

        const fallbackResult = await supabase
          .from("listings")
          .update(fallbackPayload)
          .eq("id", listingId);

        submitError = fallbackResult.error;
      }

      if (submitError) {
        logDbError("[PATCH /api/business/listings/[id]] Submit for approval failed", submitError, {
          listingId,
          userId,
          currentStatus: currentListing.status,
          targetStatus: "pending_approval",
        });
        throw new Error(`Failed to submit listing: ${submitError.message}`);
      }

      // Notify admins of pending listing
      let adminCount = 0;
      try {
        const { createNotification } =
          await import("@/lib/notifications/service");
        const { data: admins } = await supabase
          .from("profiles")
          .select("id")
          .in("role", ["lister", "admin", "super_admin"]);

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
      const { data: existingRequest } = await supabase
        .from("listing_change_requests")
        .select("id, created_at, change_type")
        .eq("listing_id", listingId)
        .eq("status", "pending")
        .single();

      if (existingRequest) {
        return listingPatchError(
          requestId,
          409,
          "UPDATE_FAILED",
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

      // Properly type the insert data according to Supabase schema
      const insertData: Database["public"]["Tables"]["listing_change_requests"]["Insert"] =
        {
          listing_id: listingId,
          requested_by: userId,
          change_type: changeType,
          current_data: currentListing as Json,
          proposed_data: restBody as Json,
          reason:
            typeof restBody.reason === "string" ? restBody.reason : null,
          status: "pending",
          priority,
        };

      const { data: changeRequest, error: createError } = await supabase
        .from("listing_change_requests")
        .insert(insertData)
        .select()
        .single();

      if (createError) {
        logDbError("[PATCH /api/business/listings/[id]] Change request create failed", createError, {
          listingId,
          userId,
          changeType,
        });
        // Handle unique constraint violation gracefully
        if (createError.code === "23505") {
          return listingPatchError(
            requestId,
            409,
            "UPDATE_FAILED",
            "A pending change request already exists for this listing",
            { dbCode: createError.code ?? null },
          );
        }
        throw new Error(
          `Failed to create change request: ${createError.message}`,
        );
      }

      // Notify admins for review
      try {
        const { createNotification } =
          await import("@/lib/notifications/service");
        const { data: admins } = await supabase
          .from("profiles")
          .select("id")
          .in("role", ["lister", "admin", "super_admin"]);

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

    const { data: updatedListing, error: updateError } = await supabase
      .from("listings")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", listingId)
      .select()
      .single();

    if (updateError) {
      logDbError("[PATCH /api/business/listings/[id]] Direct listing update failed", updateError, {
        listingId,
        userId,
        updateKeys: Object.keys(updateData),
      });
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

    const supabase = await createServerSupabase();

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

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("id, name, status, owner_id")
      .eq("id", listingId)
      .single();

    if (listingError || !listing) {
      if (listingError) {
        logDbError(
          "[DELETE /api/business/listings/[id]] Listing fetch failed",
          listingError,
          { listingId, userId },
        );
      }
      return apiError("Listing not found", 404);
    }

    if (listing.status === "archived") {
      return apiError(
        "This listing is already archived",
        400,
        "ALREADY_ARCHIVED",
      );
    }

    const { data: pendingRequest, error: pendingRequestError } = await supabase
      .from("listing_change_requests")
      .select("id, change_type, created_at")
      .eq("listing_id", listingId)
      .eq("status", "pending")
      .maybeSingle();

    if (pendingRequestError) {
      logDbError(
        "[DELETE /api/business/listings/[id]] Pending request check failed",
        pendingRequestError,
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

    let changeRequestPayload: Database["public"]["Tables"]["listing_change_requests"]["Insert"] =
      {
        listing_id: listingId,
        requested_by: userId,
        change_type: "delete_request",
        current_data: listing as Json,
        proposed_data: proposedDeleteData as Json,
        reason: deletionReason,
        status: "pending",
        priority: "priority",
      };

    let { data: createdRequest, error: createRequestError } = await supabase
      .from("listing_change_requests")
      .insert(changeRequestPayload)
      .select("id, status, change_type, created_at")
      .single();

    // Backward compatibility: legacy DB constraint may not allow delete_request yet.
    if (
      createRequestError?.code === "23514" &&
      createRequestError.message.includes("valid_change_type")
    ) {
      console.warn(
        "[DELETE /api/business/listings/[id]] Legacy valid_change_type constraint detected, retrying with major_update",
        { listingId, userId },
      );

      changeRequestPayload = {
        ...changeRequestPayload,
        change_type: "major_update",
      };

      const retryResult = await supabase
        .from("listing_change_requests")
        .insert(changeRequestPayload)
        .select("id, status, change_type, created_at")
        .single();

      createdRequest = retryResult.data;
      createRequestError = retryResult.error;
    }

    if (createRequestError || !createdRequest) {
      if (createRequestError) {
        logDbError(
          "[DELETE /api/business/listings/[id]] Create delete request failed",
          createRequestError,
          { listingId, userId },
        );
      }

      return apiError(
        "Failed to create deletion request. Please ask admin to run the latest listing change-request migration.",
        500,
        "DELETE_REQUEST_SCHEMA_MISMATCH",
      );
    }

    const submitPayload: Record<string, unknown> = {
      status: "pending_approval",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let { error: submitError } = await supabase
      .from("listings")
      .update(submitPayload)
      .eq("id", listingId);

    if (
      submitError?.code === "PGRST204" &&
      submitError.message.includes("'submitted_at' column of 'listings'")
    ) {
      const fallbackPayload = {
        status:
          "pending_approval" as Database["public"]["Enums"]["listing_status"],
        updated_at: new Date().toISOString(),
      };

      const fallbackResult = await supabase
        .from("listings")
        .update(fallbackPayload)
        .eq("id", listingId);

      submitError = fallbackResult.error;
    }

    if (submitError) {
      logDbError(
        "[DELETE /api/business/listings/[id]] Move listing to review queue failed",
        submitError,
        { listingId, userId },
      );
      throw new Error(`Failed to submit deletion request: ${submitError.message}`);
    }

    try {
      const { createNotification } = await import("@/lib/notifications/service");
      const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .in("role", ["lister", "admin", "super_admin"]);

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
