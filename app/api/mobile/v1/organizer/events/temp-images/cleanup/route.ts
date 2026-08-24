import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileOrganizer } from "@/lib/mobile/organizer";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { deleteFile, listFiles } from "@/lib/storage/spaces";

export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/v1/organizer/events/temp-images/cleanup
 *
 * Deletes all staged temp images for a session (called when the create form
 * is abandoned). Mirrors `app/api/organizer/events/temp-images/cleanup/route.ts`.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileOrganizer(request);
  await enforceMobileRateLimit(request, user.id);

  const body = await request.json().catch(() => null);
  const tempSessionId = body?.tempSessionId as string | undefined;
  if (!tempSessionId) {
    throw new MobileApiError(
      "validation_error",
      "tempSessionId is required.",
      400,
    );
  }

  const tempPath = `event-images/temp/${tempSessionId}/`;
  let tempKeys: string[];
  try {
    tempKeys = await listFiles(tempPath);
  } catch (error) {
    console.error("[mobile-api] failed to list temp images:", error);
    throw new MobileApiError(
      "internal_error",
      "Failed to clean up temp images.",
      500,
    );
  }

  if (tempKeys.length === 0) {
    return ok({ deletedCount: 0 });
  }

  try {
    await Promise.all(tempKeys.map((key) => deleteFile(key)));
  } catch (error) {
    console.error("[mobile-api] failed to delete temp images:", error);
    throw new MobileApiError(
      "internal_error",
      "Failed to clean up temp images.",
      500,
    );
  }

  return ok({ deletedCount: tempKeys.length });
});
