import { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { apiError, apiSuccess, handleApiError } from "@/lib/blogs/api-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/writer-applications
 * The caller's own latest writer application, if any.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return apiError("Unauthorized: Authentication required", 401, "UNAUTHORIZED");
    }

    const { rows } = await query(
      `SELECT id, message, portfolio_url, status, review_notes,
              to_json(created_at) #>> '{}' AS created_at,
              to_json(reviewed_at) #>> '{}' AS reviewed_at
       FROM writer_applications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [session.userId],
    );

    return apiSuccess(rows[0] ?? null);
  } catch (error) {
    return handleApiError(error);
  }
}

const applySchema = z.object({
  message: z
    .string({ required_error: "Tell us why you want to write for us" })
    .min(20, "Message must be at least 20 characters")
    .max(2000, "Message must not exceed 2000 characters"),
  portfolio_url: z
    .string()
    .transform((val) => {
      if (!val) return val;
      if (!/^https?:\/\//i.test(val)) return `https://${val}`;
      return val;
    })
    .pipe(z.string().url("Invalid portfolio URL"))
    .nullish(),
});

/**
 * POST /api/writer-applications
 * Apply to become a blog writer. Admin-reviewed via /api/admin/writer-applications.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return apiError("Unauthorized: Authentication required", 401, "UNAUTHORIZED");
    }

    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId],
    );
    const profile = profileRows[0];
    if (!profile) {
      return apiError("Unauthorized: Profile not found", 401, "UNAUTHORIZED");
    }

    if (["writer", "admin", "super_admin"].includes(profile.role)) {
      return apiError(
        "You already have writer access",
        409,
        "ALREADY_WRITER",
      );
    }

    const { rows: pendingRows } = await query(
      `SELECT id FROM writer_applications WHERE user_id = $1 AND status = 'pending' LIMIT 1`,
      [session.userId],
    );
    if (pendingRows[0]) {
      return apiError(
        "You already have a pending writer application",
        409,
        "APPLICATION_PENDING",
      );
    }

    const rawBody = await request.json();
    const validationResult = applySchema.safeParse(rawBody);
    if (!validationResult.success) {
      return apiError(
        "Validation failed",
        400,
        "VALIDATION_ERROR",
        validationResult.error.flatten().fieldErrors,
      );
    }
    const { message, portfolio_url } = validationResult.data;

    try {
      const { rows } = await query(
        `INSERT INTO writer_applications (user_id, message, portfolio_url, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING id, status`,
        [session.userId, message, portfolio_url || null],
      );

      return apiSuccess(
        rows[0],
        "Application submitted. You'll be notified once it's reviewed.",
      );
    } catch (insertError) {
      // Unique-violation fallback for the race where two requests land at once.
      if ((insertError as { code?: string })?.code === "23505") {
        return apiError(
          "You already have a pending writer application",
          409,
          "APPLICATION_PENDING",
        );
      }
      throw insertError;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
