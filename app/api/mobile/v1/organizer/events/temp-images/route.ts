import { type NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileOrganizer } from "@/lib/mobile/organizer";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { uploadFile } from "@/lib/storage/spaces";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

/**
 * POST /api/mobile/v1/organizer/events/temp-images
 *
 * Uploads an event photo to temp storage before the event (or its pending
 * change request) exists. Mirrors `app/api/organizer/events/temp-images/route.ts`
 * (web). The organizer stages 1+ images here, then references their URLs in
 * `event_data.temp_images` on `POST /organizer/events/manage`; an admin
 * approving the create request is what moves them into `event_images`.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileOrganizer(request);
  await enforceMobileRateLimit(request, user.id);

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const tempSessionId = formData.get("tempSessionId") as string | null;

  if (!file || !tempSessionId) {
    throw new MobileApiError(
      "validation_error",
      "A file and tempSessionId are required.",
      400,
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new MobileApiError(
      "invalid_file_type",
      "Only JPEG, PNG, and WebP images are allowed.",
      400,
      "file",
    );
  }

  if (file.size > MAX_SIZE) {
    throw new MobileApiError(
      "file_too_large",
      "Maximum file size is 5MB.",
      400,
      "file",
    );
  }

  const ext = file.name.split(".").pop();
  const filename = `${uuidv4()}.${ext}`;
  const path = `event-images/temp/${tempSessionId}/${filename}`;

  let publicUrl: string;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uploaded = await uploadFile(path, Buffer.from(arrayBuffer), {
      contentType: file.type,
    });
    publicUrl = uploaded.publicUrl;
  } catch (uploadError) {
    console.error("[mobile-api] temp image upload failed:", uploadError);
    throw new MobileApiError(
      "upload_failed",
      "Failed to upload image. Please try again.",
      500,
    );
  }

  return ok({
    id: Date.now(),
    event_id: null,
    url: publicUrl,
    alt_text: file.name,
    is_primary: false,
    display_order: 0,
    created_at: new Date().toISOString(),
  });
});
