import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const savePushTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android"]),
  deviceId: z.string().max(255).optional(),
});

/**
 * POST /api/mobile/v1/user/push-token
 *
 * Registers (or re-owns) an Expo push token for the caller's device. A token
 * is unique across all users, so re-registering on a shared/reinstalled
 * device just re-points it at the current caller.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);

  const parsed = savePushTokenSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      parsed.error.errors[0]?.message ?? "Invalid push token payload.",
      400,
      parsed.error.errors[0]?.path.join(".") || undefined,
    );
  }
  const body = parsed.data;

  await query(
    `INSERT INTO public.push_tokens (user_id, expo_push_token, platform, device_id, last_seen_at, updated_at)
     VALUES ($1, $2, $3, $4, now(), now())
     ON CONFLICT (expo_push_token)
     DO UPDATE SET user_id = $1, platform = $3, device_id = $4, last_seen_at = now(), updated_at = now()`,
    [user.id, body.token, body.platform, body.deviceId ?? null],
  );

  return ok({ success: true }, undefined, { status: 201 });
});

/**
 * DELETE /api/mobile/v1/user/push-token?token=<expoPushToken>
 *
 * Unregisters a device's push token, e.g. on logout, so a signed-out device
 * stops receiving that user's pushes. Owner-scoped (-> 404 if not theirs).
 */
export const DELETE = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);

  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    throw new MobileApiError(
      "validation_error",
      "Query param 'token' is required.",
      400,
      "token",
    );
  }

  const { rowCount } = await query(
    `DELETE FROM public.push_tokens WHERE expo_push_token = $1 AND user_id = $2`,
    [token, user.id],
  );

  if (rowCount === 0) {
    throw new MobileApiError("not_found", "Push token not found.", 404);
  }

  return ok({ success: true });
});
