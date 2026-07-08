import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications/service";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

// GET - Get pending listings for approval
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") || "pending_approval";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
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

    let query = supabase
      .from("listings")
      .select(
        `
        *,
        categories(id, name, icon_name),
        profiles:owner_id(id, full_name)
      `,
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq(
        "status",
        status as Database["public"]["Enums"]["listing_status"],
      );
    }

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: listings, error, count } = await query;

    if (error) {
      console.error("Error fetching listings for approval:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch listings" },
        { status: 500 },
      );
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

    const { data: pendingDeleteRequests } =
      listingIds.length > 0
        ? await supabase
            .from("listing_change_requests")
            .select("id, listing_id, change_type, reason, created_at, proposed_data")
            .eq("status", "pending")
            .in("listing_id", listingIds)
        : {
            data: [] as Array<{
              id: number;
              listing_id: number;
              change_type: string;
              reason: string | null;
              created_at: string;
              proposed_data: unknown;
            }>,
          };

    const deleteRequestByListingId = new Map(
      (pendingDeleteRequests || [])
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

    const listingsWithRequestContext = (listings || []).map((listing) => ({
      ...listing,
      deletion_request: deleteRequestByListingId.get(listing.id) || null,
    }));

    const [draftResult, pendingResult, publishedResult, rejectedResult] =
      await Promise.all([
        supabase
          .from("listings")
          .select("*", { count: "exact", head: true })
          .eq("status", "draft"),
        supabase
          .from("listings")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending_approval"),
        supabase
          .from("listings")
          .select("*", { count: "exact", head: true })
          .eq("status", "published"),
        supabase
          .from("listings")
          .select("*", { count: "exact", head: true })
          .eq("status", "rejected"),
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
        draftCount: draftResult.count || 0,
        pendingCount: pendingResult.count || 0,
        publishedCount: publishedResult.count || 0,
        rejectedCount: rejectedResult.count || 0,
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
    const supabase = await createServerSupabase();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
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

    const { data: listing, error: fetchError } = await supabase
      .from("listings")
      .select("id, name, status, owner_id")
      .eq("id", listing_id)
      .single();

    if (fetchError || !listing) {
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

    const { data: pendingRequest, error: pendingDeleteRequestError } =
      await supabase
        .from("listing_change_requests")
        .select("id, change_type, proposed_data")
        .eq("listing_id", listing_id)
        .eq("status", "pending")
        .maybeSingle();

    if (pendingDeleteRequestError) {
      console.error(
        "[POST /api/admin/listings/approvals] Failed to load pending delete request",
        {
          listingId: listing_id,
          message: pendingDeleteRequestError.message,
          details: pendingDeleteRequestError.details,
          hint: pendingDeleteRequestError.hint,
          code: pendingDeleteRequestError.code,
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

    const approvalPayload: Record<string, unknown> = {
      status: newStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      review_notes: review_notes || null,
      updated_at: new Date().toISOString(),
    };

    let { error: updateError } = await supabase
      .from("listings")
      .update(approvalPayload)
      .eq("id", listing_id);

    // Backward-compatible retry until review metadata columns are migrated.
    if (
      updateError?.code === "PGRST204" &&
      updateError.message.includes("column of 'listings'")
    ) {
      console.warn(
        "[POST /api/admin/listings/approvals] Review metadata columns missing; retrying with status-only payload",
        {
          listingId: listing_id,
          action,
          message: updateError.message,
        },
      );

      const fallbackPayload = {
        status: newStatus as Database["public"]["Enums"]["listing_status"],
        updated_at: new Date().toISOString(),
      };

      const fallbackResult = await supabase
        .from("listings")
        .update(fallbackPayload)
        .eq("id", listing_id);

      updateError = fallbackResult.error;
    }

    if (updateError) {
      console.error("[POST /api/admin/listings/approvals] Error updating listing status", {
        listingId: listing_id,
        action,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code,
      });
      return NextResponse.json(
        { success: false, error: "Failed to process approval" },
        { status: 500 },
      );
    }

    if (pendingRequest && isDeleteRequest) {
      const { error: changeRequestUpdateError } = await supabase
        .from("listing_change_requests")
        .update({
          status: action === "approve" ? "approved" : "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: review_notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pendingRequest.id)
        .eq("status", "pending");

      if (changeRequestUpdateError) {
        console.error(
          "[POST /api/admin/listings/approvals] Failed to finalize delete change request",
          {
            listingId: listing_id,
            changeRequestId: pendingRequest.id,
            message: changeRequestUpdateError.message,
            details: changeRequestUpdateError.details,
            hint: changeRequestUpdateError.hint,
            code: changeRequestUpdateError.code,
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
        admin_id: user.id,
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
