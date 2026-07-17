import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { clientInet } from "@/lib/mobile/invites";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  invitee_email: z.string().email().max(320),
});

type CreateInvitationResult = {
  success: boolean;
  invite_code?: string;
  invite_token?: string;
  expires_at?: string;
  error?: string;
};

/**
 * POST /api/mobile/v1/invitations
 *
 * Creates a referral invitation via the `create_invitation` RPC. That
 * function is SECURITY DEFINER and falls back to the explicit p_inviter_id
 * parameter when `auth.uid()` is unset (which it always is over a direct pg
 * connection), so it's safe to call as-is. The DB enforces domain/duplicate
 * rules and rate limits (account age >= 7 days, <= 10/day, <= 50 pending) and
 * returns the code + token; the shareable invite_url carries the token.
 * Duplicate email -> 409.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "A valid invitee email is required.",
      400,
      "invitee_email",
    );
  }

  let result: CreateInvitationResult;
  try {
    const { rows } = await query(
      // Positional args must match create_invitation(p_invitee_email,
      // p_inviter_ip, p_inviter_id) - reorder here if that signature changes.
      `SELECT create_invitation($1, $2::inet, $3) AS result`,
      [parsed.data.invitee_email, clientInet(request), user.id],
    );
    result = rows[0].result;
  } catch (error) {
    const pgError = error as { code?: string; constraint?: string };
    // Only the (inviter_id, invitee_email) unique index means "already
    // invited"; gate on its name so a (vanishingly rare) code/token collision
    // doesn't masquerade as it. Anything else is a genuine failure.
    if (pgError.code === "23505" && pgError.constraint === "unique_inviter_email") {
      throw new MobileApiError(
        "already_invited",
        "You've already invited this email address.",
        409,
      );
    }
    console.error("[mobile-api] create_invitation failed:", error);
    throw new MobileApiError(
      "internal_error",
      "Failed to create invitation.",
      500,
    );
  }

  if (!result?.success || !result.invite_code || !result.invite_token) {
    // Don't pass the RPC's "This email is already registered" through verbatim -
    // it turns this endpoint into an account-existence oracle. Collapse it into
    // the same neutral message as any other business rejection.
    const reveals = result?.error === "This email is already registered";
    throw new MobileApiError(
      "invitation_rejected",
      reveals
        ? "We couldn't send an invitation to that address."
        : (result?.error ?? "Failed to create invitation."),
      400,
    );
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  if (!base) {
    console.error(
      "[mobile-api] NEXT_PUBLIC_APP_URL is not set; cannot build invite_url.",
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to create invitation.",
      500,
    );
  }
  const inviteUrl = `${base}/signup?invite=${encodeURIComponent(result.invite_token)}`;

  return ok(
    {
      invite_code: result.invite_code,
      invite_url: inviteUrl,
      expires_at: result.expires_at ?? null,
    },
    undefined,
    { status: 201 },
  );
});
