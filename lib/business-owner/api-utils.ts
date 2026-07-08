import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ApiResponse } from "@/types/business-owner.types";

/**
 * Verify business owner authorization
 * Returns user ID if authorized, throws error if not
 * Respects active_role for role switching functionality
 */
export async function verifyBusinessOwner(): Promise<string> {
  const supabase = await createServerSupabase();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized: Authentication required");
  }

  // Check user's role and active_role for role switching support
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, active_role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Unauthorized: Profile not found");
  }

  // Use active_role if set, otherwise fall back to role
  const effectiveRole = profile.active_role || profile.role;

  // Business owner access requires business_owner active role
  // Admin/super_admin can also access when in their staff role
  if (
    effectiveRole !== "business_owner" &&
    effectiveRole !== "admin" &&
    effectiveRole !== "super_admin"
  ) {
    throw new Error("Forbidden: Business owner access requires business_owner role");
  }

  return user.id;
}

/**
 * Verify listing ownership
 * Returns listing if owned by user, throws error if not
 * Also checks created_by as fallback for legacy listings
 */
export async function verifyListingOwnership(
  userId: string,
  listingId: number,
): Promise<boolean> {
  const supabase = await createServerSupabase();

  const { data: listing, error } = await supabase
    .from("listings")
    .select("owner_id, created_by")
    .eq("id", listingId)
    .single();

  if (error || !listing) {
    throw new Error("Listing not found");
  }

  // Check owner_id first, then fall back to created_by for legacy listings
  const isOwner = listing.owner_id === userId || listing.created_by === userId;

  if (!isOwner) {
    throw new Error("Forbidden: You do not own this listing");
  }

  return true;
}

/**
 * Standard API success response
 */
export function apiSuccess<T>(
  data: T,
  message?: string,
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    ...(message && { message }),
  });
}

/**
 * Standard API error response
 */
export function apiError(
  error: string,
  status: number = 400,
  code?: string,
  details?: Record<string, unknown>,
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(code && { code }),
      ...(details && { details }),
    },
    { status },
  );
}

/**
 * Handle API errors with proper status codes
 */
export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  if (error instanceof Error) {
    // Auth errors
    if (error.message.includes("Unauthorized")) {
      return apiError(error.message, 401, "UNAUTHORIZED");
    }
    if (error.message.includes("Forbidden")) {
      return apiError(error.message, 403, "FORBIDDEN");
    }
    // Not found
    if (error.message.includes("not found")) {
      return apiError(error.message, 404, "NOT_FOUND");
    }
    // Validation
    if (
      error.message.includes("Invalid") ||
      error.message.includes("required")
    ) {
      return apiError(error.message, 400, "VALIDATION_ERROR");
    }
    // Generic
    return apiError(error.message, 500, "INTERNAL_ERROR");
  }

  return apiError("An unexpected error occurred", 500, "UNKNOWN_ERROR");
}

/**
 * Parse pagination params from request
 */
export function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10)),
  );

  return { page, limit };
}

/**
 * Calculate pagination metadata
 */
export function calculatePagination(
  total: number,
  page: number,
  limit: number,
) {
  const total_pages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    total_pages,
    has_next: page < total_pages,
    has_prev: page > 1,
  };
}

/**
 * Validate required fields
 */
export function validateRequiredFields(
  data: Record<string, unknown>,
  requiredFields: string[],
): { valid: boolean; missing: string[] } {
  const missing = requiredFields.filter((field) => {
    const value = data[field];
    return value === undefined || value === null || value === "";
  });

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Detect if listing change requires admin approval
 * Major changes: name, category, address
 * Minor changes: description, hours, gallery, menu
 */
export function requiresAdminApproval(
  currentData: Record<string, unknown>,
  proposedData: Record<string, unknown>,
): boolean {
  const majorFields = ["name", "category_id", "address"];

  return majorFields.some((field) => {
    return (
      currentData[field] !== proposedData[field] &&
      proposedData[field] !== undefined
    );
  });
}

/**
 * Determine change request type
 */
export function getChangeRequestType(
  currentData: Record<string, unknown>,
  proposedData: Record<string, unknown>,
): "name_change" | "category_change" | "address_change" | "major_update" {
  if (
    proposedData.name !== undefined &&
    proposedData.name !== currentData.name
  ) {
    return "name_change";
  }
  if (
    proposedData.category_id !== undefined &&
    proposedData.category_id !== currentData.category_id
  ) {
    return "category_change";
  }
  if (
    proposedData.address !== undefined &&
    proposedData.address !== currentData.address
  ) {
    return "address_change";
  }
  return "major_update";
}

/**
 * Get system config value
 */
export async function getSystemConfig(
  key: string,
  defaultValue: string,
): Promise<string> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("system_config")
    .select("config_value")
    .eq("config_key", key)
    .single();

  if (error || !data || !data.config_value) {
    return defaultValue;
  }

  return String(data.config_value);
}

/**
 * Check if reply can be edited
 * - Within 24 hours of creation
 * - Edit count < max edits allowed
 * - Status is still pending
 */
export async function canEditReply(
  replyCreatedAt: string,
  editCount: number,
  status: string,
): Promise<{ can_edit: boolean; reason?: string }> {
  // Check status
  if (status !== "pending") {
    return {
      can_edit: false,
      reason: "Reply has been reviewed and cannot be edited",
    };
  }

  // Check 24-hour window
  const createdDate = new Date(replyCreatedAt);
  const now = new Date();
  const hoursSinceCreation =
    (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);

  if (hoursSinceCreation > 24) {
    return { can_edit: false, reason: "Edit window expired (24 hours)" };
  }

  // Check edit count
  const maxEdits = parseInt(
    await getSystemConfig("business_portal_max_reply_edits", "3"),
    10,
  );

  if (editCount >= maxEdits) {
    return {
      can_edit: false,
      reason: `Maximum edit limit reached (${maxEdits})`,
    };
  }

  return { can_edit: true };
}
