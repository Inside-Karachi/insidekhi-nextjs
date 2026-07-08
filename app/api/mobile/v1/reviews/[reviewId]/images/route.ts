import { type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser, requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePathId } from "@/lib/mobile/params";
import { MobileApiError } from "@/lib/mobile/errors";
import { createMobileServiceClient } from "@/lib/mobile/supabase";
import {
  REVIEW_IMAGE_COLUMNS,
  toReviewImage,
  type ReviewImageRow,
} from "@/lib/mobile/mappers";

export const dynamic = "force-dynamic";

const MAX_IMAGES_PER_REVIEW = 5;
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB

/**
 * Accepted upload content types -> the canonical MIME + extension used for the
 * stored object. The incoming type is normalized so the object's MIME always
 * matches the storage bucket's `allowed_mime_types` (which lists `image/jpeg`,
 * not the non-standard `image/jpg`).
 */
const ALLOWED_UPLOADS: Record<string, { mime: string; ext: string }> = {
  "image/jpeg": { mime: "image/jpeg", ext: "jpg" },
  "image/jpg": { mime: "image/jpeg", ext: "jpg" },
  "image/png": { mime: "image/png", ext: "png" },
  "image/webp": { mime: "image/webp", ext: "webp" },
};

/**
 * Returns the image MIME implied by a file's leading magic bytes, or null if the
 * bytes are not a recognized JPEG/PNG/WebP. The multipart `Content-Type` is
 * client-controlled, so this is used to reject content-type spoofing before a
 * file is stored in the publicly-served bucket.
 */
function sniffImageMime(head: Uint8Array): string | null {
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * GET /api/mobile/v1/reviews/{reviewId}/images
 *
 * Lists a review's images. Visibility is enforced by RLS: anon/regular users
 * see images only for APPROVED reviews; staff (lister/admin) see all. Returns
 * `{ id, image_url }` - `review_images` has no alt/order columns.
 */
export const GET = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const reviewId = parsePathId((await params).reviewId, "reviewId");
  const { supabase } = await getOptionalMobileUser(request);

  const { data, error } = await supabase
    .from("review_images")
    .select(REVIEW_IMAGE_COLUMNS)
    .eq("review_id", reviewId)
    .order("created_at", { ascending: true })
    .returns<ReviewImageRow[]>();
  if (error) {
    console.error("[mobile-api] review images query failed:", error.message);
    throw new MobileApiError("internal_error", "Failed to load images.", 500);
  }

  return ok((data ?? []).map(toReviewImage));
});

/**
 * POST /api/mobile/v1/reviews/{reviewId}/images
 *
 * Owner-only multipart upload (field `file`). The caller is authenticated and
 * the review ownership is enforced here; the file is then written to the
 * publicly-served `reviews/<reviewId>/...` storage prefix via a service-role
 * client. This mirrors the website's real review-image flow (`move-temp-images`,
 * which moves the file into `reviews/...` with service_role) - regular users may
 * only write to their own `temp/...` prefix, never directly to `reviews/...`.
 */
export const POST = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const reviewId = parsePathId((await params).reviewId, "reviewId");
  const { user, supabase } = await requireMobileUser(request);
  // Upload is the most expensive write path; throttle per-user in addition to
  // per-IP so a single token can't fan out binary uploads across rotating IPs.
  await enforceMobileRateLimit(request, user.id);

  // Ownership check via the caller's RLS client (reviews are publicly readable).
  // Images may be attached while the review is still `pending`: this matches the
  // website flow, where images are moved in right after review creation and
  // before moderation. So there is no status gate here - ownership only.
  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select("id, user_id")
    .eq("id", reviewId)
    .maybeSingle();
  if (reviewError) {
    console.error("[mobile-api] review lookup failed:", reviewError.message);
    throw new MobileApiError("internal_error", "Failed to add image.", 500);
  }
  if (!review) {
    throw new MobileApiError("not_found", "Review not found.", 404);
  }
  if (review.user_id !== user.id) {
    throw new MobileApiError(
      "forbidden",
      "You can only add images to your own review.",
      403,
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw new MobileApiError(
      "validation_error",
      "Expected multipart/form-data.",
      400,
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new MobileApiError(
      "validation_error",
      "No file uploaded.",
      400,
      "file",
    );
  }

  const upload = ALLOWED_UPLOADS[file.type];
  if (!upload) {
    throw new MobileApiError(
      "validation_error",
      "Invalid file type. Only JPEG, PNG, and WebP are allowed.",
      400,
      "file",
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new MobileApiError(
      "validation_error",
      "File too large. Maximum size is 2MB.",
      400,
      "file",
    );
  }

  // The declared Content-Type is client-controlled; verify the actual leading
  // bytes match before storing the object in a public bucket.
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (sniffImageMime(head) !== upload.mime) {
    throw new MobileApiError(
      "validation_error",
      "File content does not match its declared type.",
      400,
      "file",
    );
  }

  // Privileged operations (count across all statuses, write to reviews/, insert)
  // run as service_role AFTER the ownership check above.
  const service = createMobileServiceClient();

  const { count, error: countError } = await service
    .from("review_images")
    .select("id", { count: "exact", head: true })
    .eq("review_id", reviewId);
  if (countError) {
    console.error("[mobile-api] image count failed:", countError.message);
    throw new MobileApiError("internal_error", "Failed to add image.", 500);
  }
  // Best-effort cap: the count->insert is not atomic, so a burst of concurrent
  // uploads by the same owner could marginally exceed it. The per-user rate limit
  // bounds the blast radius; a hard guarantee would need a DB-level constraint.
  if ((count ?? 0) >= MAX_IMAGES_PER_REVIEW) {
    throw new MobileApiError(
      "too_many_images",
      `A review may have at most ${MAX_IMAGES_PER_REVIEW} images.`,
      400,
    );
  }

  const objectKey = `reviews/${reviewId}/${Date.now()}-${randomUUID()}.${upload.ext}`;
  const { error: uploadError } = await service.storage
    .from("review-images")
    .upload(objectKey, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: upload.mime,
    });
  if (uploadError) {
    console.error("[mobile-api] image upload failed:", uploadError.message);
    throw new MobileApiError("internal_error", "Failed to upload image.", 500);
  }

  const {
    data: { publicUrl },
  } = service.storage.from("review-images").getPublicUrl(objectKey);

  const { data: created, error: insertError } = await service
    .from("review_images")
    .insert({
      review_id: reviewId,
      image_url: publicUrl,
      uploaded_by: user.id,
    })
    .select(REVIEW_IMAGE_COLUMNS)
    .returns<ReviewImageRow[]>()
    .single();
  if (insertError || !created) {
    console.error("[mobile-api] image insert failed:", insertError?.message);
    // Best-effort cleanup of the orphaned object; log if it can't be removed so
    // the leftover is at least observable.
    const { error: cleanupError } = await service.storage
      .from("review-images")
      .remove([objectKey]);
    if (cleanupError) {
      console.error(
        "[mobile-api] orphaned image cleanup failed:",
        cleanupError.message,
        objectKey,
      );
    }
    throw new MobileApiError("internal_error", "Failed to save image.", 500);
  }

  return ok(toReviewImage(created), undefined, { status: 201 });
});
