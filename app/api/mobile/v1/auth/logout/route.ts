import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser } from "@/lib/mobile/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/v1/auth/logout
 *
 * Thin/no-op: this JWT scheme is stateless with no server-side revocation
 * list (matching the web session's current behavior), so there is nothing to
 * invalidate here. The client just discards its stored token. This route
 * exists for symmetry with login/signup and so a logout event can be
 * audit-logged when a valid token is presented.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  const { user } = await getOptionalMobileUser(request);

  if (user) {
    try {
      const { logUserLogout } = await import("@/lib/audit");
      await logUserLogout(
        user.id,
        request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
      );
    } catch (logError) {
      console.error("Failed to log logout:", logError);
    }
  }

  return ok({ success: true });
});
