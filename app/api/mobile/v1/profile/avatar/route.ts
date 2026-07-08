import { type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";

export const runtime = "nodejs"; // sharp needs the Node runtime
export const dynamic = "force-dynamic";

const BUCKET = "profiles_avatar";
const MAX_FILE_BYTES = 5 * 1024 * 1024; // matches the bucket's 5MB limit
const MAX_INPUT_PIXELS = 24_000_000; // ~24MP - decompression-bomb guard
const ALLOWED_DECODED = new Set(["jpeg", "png", "webp", "avif"]);
const AVATAR_DIM = 512;

sharp.cache(false);
sharp.concurrency(1);

// Replaces the caller's avatar (multipart field `avatar`). Decodes the image to validate it,
// resizes to a square webp, uploads under the caller's `<uid>/` prefix (storage RLS scopes writes),
// and writes the public URL to profiles.avatar_url; a failed DB write rolls the object back.
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user, supabase } = await requireMobileUser(request);
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
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, webp, { contentType: "image/webp", upsert: false });
  if (upErr) {
    console.error("[mobile-api] avatar upload failed:", upErr.message);
    throw new MobileApiError("internal_error", "Failed to upload avatar.", 500);
  }

  const avatarUrl = supabase.storage.from(BUCKET).getPublicUrl(path)
    .data.publicUrl;

  const { error: updErr } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);
  if (updErr) {
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove([path]);
    if (rmErr) {
      console.error("[mobile-api] avatar cleanup failed:", rmErr.message, path);
    }
    console.error("[mobile-api] avatar profile update failed:", updErr.message);
    throw new MobileApiError("internal_error", "Failed to save avatar.", 500);
  }

  return ok({ avatar_url: avatarUrl });
});
