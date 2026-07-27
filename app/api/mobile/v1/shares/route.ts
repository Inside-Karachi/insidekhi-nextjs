import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  // `social_share_content_type` also allows `post`, but the website share flow
  // only ever shares listings/events - keep the mobile surface to those two.
  content_type: z.enum(["listing", "event"]),
  content_id: z.number().int().positive(),
  content_title: z.string().min(1).max(300),
  content_url: z.string().min(1).max(2048),
  platform: z.enum([
    "facebook",
    "twitter",
    "linkedin",
    "instagram",
    "whatsapp",
    "copy_link",
    "other",
  ]),
  verification_method: z.enum(["screenshot", "tracking_url", "oauth"]),
});

type CreateShareResult = {
  success: boolean;
  share_id?: number;
  tracking_url?: string | null;
  xp_amount?: number;
  requires_verification?: boolean;
  error?: string;
};

/**
 * POST /api/mobile/v1/shares
 *
 * Records a social share for the caller via the SECURITY DEFINER
 * `create_share_record` RPC (EXECUTE is service_role-only), passing the caller's
 * id explicitly. The DB owns the XP/verification rules: it returns
 * `requires_verification` (the client then uploads proof through the website's
 * admin-verified flow) and the configured `xp_amount`. Business rejections
 * (platform not enabled, daily share cap) surface as 400. Mirrors
 * `app/api/shares/create`.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.errors[0];
    throw new MobileApiError(
      "validation_error",
      issue?.message ?? "Invalid share.",
      400,
      issue?.path.join(".") || undefined,
    );
  }
  const input = parsed.data;

  let rpcRows;
  try {
    ({ rows: rpcRows } = await query(
      `SELECT create_share_record($1, $2, $3, $4, $5, $6, $7) AS result`,
      [
        input.content_type,
        input.content_id,
        input.content_title,
        input.content_url,
        input.platform,
        input.verification_method,
        user.id,
      ],
    ));
  } catch (rpcError) {
    console.error(
      "[mobile-api] create_share_record failed:",
      rpcError instanceof Error ? rpcError.message : rpcError,
    );
    throw new MobileApiError("internal_error", "Failed to record share.", 500);
  }

  const result = rpcRows[0]?.result as CreateShareResult;
  if (!result?.success) {
    throw new MobileApiError(
      "share_rejected",
      result?.error ?? "Failed to record share.",
      400,
    );
  }

  return ok(
    {
      share_id: result.share_id ?? null,
      tracking_url: result.tracking_url ?? null,
      xp_amount: result.xp_amount ?? 0,
      requires_verification: result.requires_verification ?? true,
    },
    undefined,
    { status: 201 },
  );
});
