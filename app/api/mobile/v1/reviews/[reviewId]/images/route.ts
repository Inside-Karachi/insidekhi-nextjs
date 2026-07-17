import { type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser, requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePathId } from "@/lib/mobile/params";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { deleteFile, uploadFile } from "@/lib/storage/spaces";
import {
  toReviewImage,
  type ReviewImageRow,
} from "@/lib/mobile/mappers";

export const dynamic = "force-dynamic";

const MAX_IMAGES_PER_REVIEW = 5;
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB

/**
 * Accepted upload content types -> the canonical MIME + extension used for the
 * stored object. The incoming type is normalized so the object's MIME always
 * matches the canonical type (`image/jpeg`, not the non-standard `image/jpg`).
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

function toNumericReviewImageRow(row: Record<string, unknown>): ReviewImageRow {
  return { ...row, id: Number(row.id) } as unknown as ReviewImageRow;
}

const STAFF_ROLES = ["lister", "admin", "super_admin"];

/**
 * GET /api/mobile/v1/reviews/{reviewId}/images
 *
 * Lists a review's images. Visibility matches the review itself: anon/regular
 * users see images only for APPROVED reviews; staff (lister/admin) see all.
 * Returns `{ id, image_url }` - `review_images` has no alt/order columns.
 */
export const GET = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const reviewId = parsePathId((await params).reviewId, "reviewId");
  const { user } = await getOptionalMobileUser(request);

  const { rows: reviewRows } = await query(
    `SELECT status FROM reviews WHERE id = $1`,
    [reviewId],
  );
  const review = reviewRows[0];
  if (!review) {
    throw new MobileApiError("not_found", "Review not found.", 404);
  }

  if (review.status !== "approved") {
    let isStaff = false;
    if (user) {
      const { rows: profileRows } = await query(
        `SELECT role FROM profiles WHERE id = $1`,
        [user.id],
      );
      const role = profileRows[0]?.role;
      isStaff = role != null && STAFF_ROLES.includes(role);
    }
    if (!isStaff) {
      throw new MobileApiError("not_found", "Review not found.", 404);
    }
  }

  let rows: Record<string, unknown>[];
  try {
    const res = await query(
      `SELECT id, image_url FROM review_images WHERE review_id = $1 ORDER BY created_at ASC`,
      [reviewId],
    );
    rows = res.rows;
  } catch (error) {
    console.error("[mobile-api] review images query failed:", error);
    throw new MobileApiError("internal_error", "Failed to load images.", 500);
  }

  return ok(rows.map(toNumericReviewImageRow).map(toReviewImage));
});

/**
 * POST /api/mobile/v1/reviews/{reviewId}/images
 *
 * Owner-only multipart upload (field `file`). The caller is authenticated and
 * the review ownership is enforced here; the file is then written to the
 * publicly-served `review-images/<reviewId>/...` prefix in DigitalOcean
 * Spaces.
 */
export const POST = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const reviewId = parsePathId((await params).reviewId, "reviewId");
  const { user } = await requireMobileUser(request);
  // Upload is the most expensive write path; throttle per-user in addition to
  // per-IP so a single token can't fan out binary uploads across rotating IPs.
  await enforceMobileRateLimit(request, user.id);

  // Ownership check. Images may be attached while the review is still
  // `pending`: this matches the website flow, where images are moved in right
  // after review creation and before moderation. So there is no status gate
  // here - ownership only.
  let review: { id: unknown; user_id: unknown } | undefined;
  try {
    const { rows } = await query(
      `SELECT id, user_id FROM reviews WHERE id = $1`,
      [reviewId],
    );
    review = rows[0];
  } catch (error) {
    console.error("[mobile-api] review lookup failed:", error);
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

  const { rows: countRows } = await query(
    `SELECT COUNT(*) FROM review_images WHERE review_id = $1`,
    [reviewId],
  );
  const existingCount = Number(countRows[0]?.count ?? 0);
  // Best-effort cap: the count->insert is not atomic, so a burst of concurrent
  // uploads by the same owner could marginally exceed it. The per-user rate limit
  // bounds the blast radius; a hard guarantee would need a DB-level constraint.
  if (existingCount >= MAX_IMAGES_PER_REVIEW) {
    throw new MobileApiError(
      "too_many_images",
      `A review may have at most ${MAX_IMAGES_PER_REVIEW} images.`,
      400,
    );
  }

  const objectKey = `review-images/${reviewId}/${Date.now()}-${randomUUID()}.${upload.ext}`;
  let publicUrl: string;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uploaded = await uploadFile(objectKey, Buffer.from(arrayBuffer), {
      contentType: upload.mime,
    });
    publicUrl = uploaded.publicUrl;
  } catch (uploadError) {
    console.error("[mobile-api] image upload failed:", uploadError);
    throw new MobileApiError("internal_error", "Failed to upload image.", 500);
  }

  let created: ReviewImageRow;
  try {
    const { rows } = await query(
      `INSERT INTO review_images (review_id, image_url, uploaded_by)
       VALUES ($1, $2, $3)
       RETURNING id, image_url`,
      [reviewId, publicUrl, user.id],
    );
    created = toNumericReviewImageRow(rows[0]);
  } catch (insertError) {
    console.error("[mobile-api] image insert failed:", insertError);
    // Best-effort cleanup of the orphaned object; log if it can't be removed so
    // the leftover is at least observable.
    try {
      await deleteFile(objectKey);
    } catch (cleanupError) {
      console.error(
        "[mobile-api] orphaned image cleanup failed:",
        cleanupError,
        objectKey,
      );
    }
    throw new MobileApiError("internal_error", "Failed to save image.", 500);
  }

  return ok(toReviewImage(created), undefined, { status: 201 });
});
