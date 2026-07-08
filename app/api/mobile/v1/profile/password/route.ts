import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import {
  enforceMobileRateLimit,
  enforcePasswordChangeLimit,
} from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  createMobilePublicClient,
  createMobileServiceClient,
} from "@/lib/mobile/supabase";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

/**
 * PUT /api/mobile/v1/profile/password
 *
 * Changes the caller's password. The current password is re-verified via a
 * throwaway `signInWithPassword` (so it never touches the caller's session),
 * then the update is applied with `auth.admin.updateUserById` (service-role -
 * the only reliable server-side password write). New-password rules: >=8 chars
 * with lower+upper+digit and different from the current. Mirrors
 * `app/api/profile/password`.
 */
export const PUT = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);
  await enforcePasswordChangeLimit(user.id);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "Current and new password are required.",
      400,
      parsed.error.errors[0]?.path.join(".") || "newPassword",
    );
  }
  const { currentPassword, newPassword } = parsed.data;

  if (newPassword.length < 8) {
    throw new MobileApiError(
      "validation_error",
      "Password must be at least 8 characters long.",
      400,
      "newPassword",
    );
  }
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
    throw new MobileApiError(
      "validation_error",
      "Password must contain uppercase, lowercase, and a number.",
      400,
      "newPassword",
    );
  }
  if (currentPassword === newPassword) {
    throw new MobileApiError(
      "validation_error",
      "New password must be different from the current password.",
      400,
      "newPassword",
    );
  }
  if (!user.email) {
    throw new MobileApiError("internal_error", "Account has no email.", 500);
  }

  // Verify the current password on a throwaway client (persistSession is off, so
  // this never clobbers the caller's real session).
  const verifier = createMobilePublicClient();
  const { error: signInError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) {
    throw new MobileApiError(
      "validation_error",
      "Current password is incorrect.",
      400,
      "currentPassword",
    );
  }

  const service = createMobileServiceClient();
  const { error: updateError } = await service.auth.admin.updateUserById(
    user.id,
    { password: newPassword },
  );
  if (updateError) {
    console.error("[mobile-api] password update failed:", updateError.message);
    throw new MobileApiError(
      "internal_error",
      "Failed to update password.",
      500,
    );
  }

  return ok({ updated: true });
});
