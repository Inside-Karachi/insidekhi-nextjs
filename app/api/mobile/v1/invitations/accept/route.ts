import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { createMobileServiceClient } from "@/lib/mobile/supabase";
import { clientInet } from "@/lib/mobile/invites";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  invite_token: z.string().min(1).max(512),
});

type AcceptInvitationResult = {
  success: boolean;
  xp_awarded?: boolean;
  message?: string;
  error?: string;
};

/**
 * POST /api/mobile/v1/invitations/accept
 *
 * Accepts an invitation the caller received, via the SECURITY DEFINER
 * `accept_invitation` RPC (EXECUTE is service_role-only). The DB requires the
 * token to be pending + unexpired AND the caller's account email to match the
 * invitee email; it awards the inviter/invitee XP only once both profiles are
 * complete (so `xp_awarded` may be false on a valid accept). An invalid/expired
 * token or an email mismatch surfaces as 400. Mirrors
 * `app/api/invitations/accept`.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "An invite token is required.",
      400,
      "invite_token",
    );
  }

  const service = createMobileServiceClient();
  const { data, error } = await service.rpc("accept_invitation", {
    p_invite_token: parsed.data.invite_token,
    p_invitee_ip: clientInet(request),
    p_invitee_id: user.id,
  });

  if (error) {
    console.error("[mobile-api] accept_invitation failed:", error.message);
    throw new MobileApiError(
      "internal_error",
      "Failed to accept invitation.",
      500,
    );
  }

  const result = data as AcceptInvitationResult;
  if (!result?.success) {
    throw new MobileApiError(
      "invitation_invalid",
      result?.error ?? "Invalid or expired invitation.",
      400,
    );
  }

  return ok({
    accepted: true,
    xp_awarded: result.xp_awarded ?? false,
    message: result.message ?? "Invitation accepted.",
  });
});
