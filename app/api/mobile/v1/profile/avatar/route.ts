import { type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { uploadPrefixedFile, deletePrefixedFile, PROFILES_AVATAR_PREFIX } from "@/lib/storage/spaces";
import { query } from "@/lib/db";

export const runtime = "nodejs"; // sharp needs the Node runtime
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // matches the bucket's 5MB limit
const MAX_INPUT_PIXELS = 24_000_000; // ~24MP - decompression-bomb guard
const ALLOWED_DECODED = new Set(["jpeg", "png", "webp", "avif"]);
const AVATAR_DIM = 512;

sharp.cache(false);
sharp.concurrency(1);

// Replaces the caller's avatar (multipart field `avatar`). Decodes the image to validate it,
// resizes to a square webp, uploads under the caller's `<uid>/` prefix (storage DO Spaces),
// and writes the public URL to profiles.avatar_url; a failed DB write rolls the object back.
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new MobileApiError(
      "validation_error",
      "Expected multipart/form-data.",
      400,
    );
  }

  const file = form.get("avatar");
  if (!(file instanceof File)) {
    throw new MobileApiError(
      "validation_error",
      "An avatar image is required.",
      400,
      "avatar",
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new MobileApiError(
      "validation_error",
      "Avatar must be 5MB or smaller.",
      400,
      "avatar",
    );
  }

  let webp: Buffer;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const meta = await sharp(buffer, {
      limitInputPixels: MAX_INPUT_PIXELS,
    }).metadata();
    if (!meta.format || !ALLOWED_DECODED.has(meta.format)) {
      throw new MobileApiError(
        "validation_error",
        "Unsupported or invalid image. Use JPEG, PNG, WebP, or AVIF.",
        400,
        "avatar",
      );
    }
    webp = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate() // honor EXIF orientation before stripping metadata
      .resize(AVATAR_DIM, AVATAR_DIM, { fit: "cover" })
      .toFormat("webp")
      .toBuffer();
  } catch (err) {
    if (err instanceof MobileApiError) throw err;
    throw new MobileApiError(
      "validation_error",
      "Could not process the image.",
      400,
      "avatar",
    );
  }

  const path = `${user.id}/avatar-${Date.now()}-${randomUUID()}.webp`;
  
  let avatarUrl;
  let uploadedPath: string | undefined;
  try {
    const uploadResult = await uploadPrefixedFile(
      PROFILES_AVATAR_PREFIX,
      path,
      webp,
      { contentType: "image/webp" },
    );
    avatarUrl = uploadResult.publicUrl;
    uploadedPath = uploadResult.path;
  } catch (upErr: unknown) {
    console.error("[mobile-api] avatar upload failed:", upErr instanceof Error ? upErr.message : upErr);
    throw new MobileApiError("internal_error", "Failed to upload avatar.", 500);
  }

  try {
    await query(
      "UPDATE public.profiles SET avatar_url = $1 WHERE id = $2",
      [avatarUrl, user.id]
    );
  } catch (updErr: unknown) {
    try {
      if (uploadedPath) {
        await deletePrefixedFile(PROFILES_AVATAR_PREFIX, uploadedPath);
      }
    } catch (rmErr: unknown) {
      console.error("[mobile-api] avatar cleanup failed:", rmErr instanceof Error ? rmErr.message : rmErr, path);
    }
    console.error("[mobile-api] avatar profile update failed:", updErr instanceof Error ? updErr.message : updErr);
    throw new MobileApiError("internal_error", "Failed to save avatar.", 500);
  }

  return ok({ avatar_url: avatarUrl });
});
