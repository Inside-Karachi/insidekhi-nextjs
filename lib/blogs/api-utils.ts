import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Verify writer authorization. Returns the user ID if authorized, throws otherwise.
 * `writer` is not a staff-switchable role (see validate_active_role trigger), so
 * unlike verifyBusinessOwner there is no active_role override case to handle -
 * effective role is simply active_role falling back to role.
 */
export async function verifyWriter(): Promise<string> {
  const session = await getSessionFromCookies();

  if (!session) {
    throw new Error("Unauthorized: Authentication required");
  }

  const { rows } = await query(
    `SELECT role, active_role FROM profiles WHERE id = $1`,
    [session.userId],
  );
  const profile = rows[0];

  if (!profile) {
    throw new Error("Unauthorized: Profile not found");
  }

  const effectiveRole = profile.active_role || profile.role;

  if (
    effectiveRole !== "writer" &&
    effectiveRole !== "admin" &&
    effectiveRole !== "super_admin"
  ) {
    throw new Error("Forbidden: Writer access requires the writer role");
  }

  return session.userId;
}

/**
 * Verify a post is owned (authored) by the given user.
 */
export async function verifyPostOwnership(
  userId: string,
  postId: number,
): Promise<boolean> {
  const { rows } = await query(`SELECT author_id FROM posts WHERE id = $1`, [
    postId,
  ]);
  const post = rows[0];

  if (!post) {
    throw new Error("Post not found");
  }

  if (post.author_id !== userId) {
    throw new Error("Forbidden: You do not own this post");
  }

  return true;
}

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

export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  if (error instanceof Error) {
    if (error.message.includes("Unauthorized")) {
      return apiError(error.message, 401, "UNAUTHORIZED");
    }
    if (error.message.includes("Forbidden")) {
      return apiError(error.message, 403, "FORBIDDEN");
    }
    if (error.message.includes("not found")) {
      return apiError(error.message, 404, "NOT_FOUND");
    }
    if (
      error.message.includes("Invalid") ||
      error.message.includes("required")
    ) {
      return apiError(error.message, 400, "VALIDATION_ERROR");
    }
    return apiError(error.message, 500, "INTERNAL_ERROR");
  }

  return apiError("An unexpected error occurred", 500, "UNKNOWN_ERROR");
}

export function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10)),
  );

  return { page, limit };
}

export function calculatePagination(total: number, page: number, limit: number) {
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
