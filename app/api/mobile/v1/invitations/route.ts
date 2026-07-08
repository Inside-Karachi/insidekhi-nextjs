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
  invitee_email: z.string().email().max(320),
});

type CreateInvitationResult = {
  success: boolean;
  invite_code?: string;
  invite_token?: string;
  expires_at?: string;
  error?: string;
};

// Creates a referral invitation via the create_invitation RPC (service_role-only). The DB
// enforces domain/duplicate rules and rate limits (account age >= 7 days, <= 10/day, <= 50 pending)
// and returns the code + token; the shareable invite_url carries the token. Duplicate email -> 409.
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

  const service = createMobileServiceClient();
  const { data, error } = await service.rpc("create_invitation", {
    p_invitee_email: parsed.data.invitee_email,
    p_inviter_ip: clientInet(request),
    p_inviter_id: user.id,
  });

  if (error) {
    // Only the (inviter_id, invitee_email) unique index means "already invited";
    // gate on its name so a (vanishingly rare) code/token collision doesn't
    // masquerade as it. Anything else is a genuine failure.
    if (
      error.code === "23505" &&
      error.message?.includes("unique_inviter_email")
    ) {
      throw new MobileApiError(
        "already_invited",
        "You've already invited this email address.",
        409,
      );
    }
    console.error("[mobile-api] create_invitation failed:", error.message);
    throw new MobileApiError(
      "internal_error",
      "Failed to create invitation.",
      500,
    );
  }

  const result = data as CreateInvitationResult;
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
