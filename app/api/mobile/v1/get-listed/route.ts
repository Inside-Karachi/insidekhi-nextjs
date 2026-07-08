import { type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  createMobileServiceClient,
  type MobileSupabase,
} from "@/lib/mobile/supabase";
import {
  getClientIp,
  isHoneypotTripped,
  enforceFormRateLimit,
} from "@/lib/mobile/forms";
import {
  normalizeEmail,
  validateEmail,
  isDisposableEmail,
  sanitizeString,
  normalizePakPhone,
} from "@/lib/utils/form-utils";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs"; // sharp needs the Node runtime
export const dynamic = "force-dynamic";

const BUCKET = "get-listed-images";
const MAX_FILES = 8;
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB per source image
const MAX_TOTAL_BYTES = 24 * 1024 * 1024; // 24MB across all images per request
const MAX_INPUT_PIXELS = 24_000_000; // ~24MP - guards against decompression bombs
const ALLOWED_DECODED = new Set(["jpeg", "png", "webp", "avif"]);
const SEVEN_DAYS_S = 60 * 60 * 24 * 7;
const ALLOWED_IMAGE = /^image\/(jpeg|jpg|png|webp|avif)$/;

// Memory hygiene under load: no process-wide buffer cache, and cap libvips
// threads so concurrent uploads can't fan out the CPU pool.
sharp.cache(false);
sharp.concurrency(1);

type ImageInsert =
  Database["public"]["Tables"]["form_submission_images"]["Insert"];

/** Cheap, pre-insert validation: file count, per-file byte size, declared MIME. */
function validateFilesShallow(files: File[]): void {
  if (files.length > MAX_FILES) {
    throw new MobileApiError(
      "validation_error",
      `At most ${MAX_FILES} images are allowed.`,
      400,
      "files",
    );
  }
  let total = 0;
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      throw new MobileApiError(
        "validation_error",
        "Each image must be 8MB or smaller.",
        400,
        "files",
      );
    }
    if (!ALLOWED_IMAGE.test(file.type)) {
      throw new MobileApiError(
        "validation_error",
        "Invalid file type. Only JPEG, PNG, WebP, and AVIF are allowed.",
        400,
        "files",
      );
    }
    total += file.size;
  }
  if (total > MAX_TOTAL_BYTES) {
    throw new MobileApiError(
      "validation_error",
      "Total image size must be 24MB or smaller.",
      400,
      "files",
    );
  }
}

/**
 * Builds the original/medium/thumb webp variants for one source image. The input
 * pixel count is bounded (decompression-bomb guard) and the DECODED format is
 * validated - the client-supplied Content-Type is not trusted.
 */
async function buildVariants(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const meta0 = await sharp(buffer, {
    limitInputPixels: MAX_INPUT_PIXELS,
  }).metadata();
  if (!meta0.format || !ALLOWED_DECODED.has(meta0.format)) {
    throw new MobileApiError(
      "validation_error",
      "Unsupported or invalid image.",
      400,
      "files",
    );
  }
  const widths = { original: 2000, medium: 1200, thumb: 400 } as const;
  const out: {
    variant: keyof typeof widths;
    data: Buffer;
    width: number | null;
    height: number | null;
  }[] = [];
  for (const variant of ["original", "medium", "thumb"] as const) {
    const data = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
      .resize({ width: widths[variant], withoutEnlargement: true })
      .toFormat("webp")
      .toBuffer();
    const meta = await sharp(data).metadata();
    out.push({
      variant,
      data,
      width: meta.width ?? null,
      height: meta.height ?? null,
    });
  }
  return out;
}

/**
 * Processes up to {@link MAX_FILES} uploaded images for a submission: writes the
 * three webp variants per image to the private `get-listed-images` bucket and
 * returns the `form_submission_images` rows to insert. Throws on any failure
 * (the caller rolls back). Tracks uploaded paths in `uploadedPaths` for cleanup.
 */
async function processFiles(
  service: MobileSupabase,
  submissionId: number,
  uploadedBy: string | null,
  files: File[],
  uploadedPaths: string[],
): Promise<ImageInsert[]> {
  const inserts: ImageInsert[] = [];
  for (const file of files) {
    const variants = await buildVariants(file);
    const base = `${submissionId}/${randomUUID()}`;
    for (const v of variants) {
      const path = `${base}/${v.variant}.webp`;
      const { error: upErr } = await service.storage
        .from(BUCKET)
        .upload(path, v.data, { contentType: "image/webp", upsert: false });
      if (upErr) throw new Error(`upload failed: ${upErr.message}`);
      uploadedPaths.push(path);
      const { data: signed } = await service.storage
        .from(BUCKET)
        .createSignedUrl(path, SEVEN_DAYS_S);
      inserts.push({
        submission_id: submissionId,
        storage_bucket: BUCKET,
        storage_path: path,
        public_url: signed?.signedUrl ?? null,
        is_public: false,
        content_type: "image/webp",
        file_size_bytes: v.data.length,
        width: v.width,
        height: v.height,
        variant: v.variant,
        uploaded_by: uploadedBy,
      });
    }
  }
  return inserts;
}

/**
 * POST /api/mobile/v1/get-listed
 *
 * "Get listed" business application via `multipart/form-data`. Optional auth
 * (stamps `uploaded_by`). Accepts up to 8 images (field `files`), each stored as
 * original/medium/thumb webp variants in the private `get-listed-images` bucket
 * (7-day signed URLs). Honeypot + per-IP rate limit; no reCAPTCHA (per the
 * mobile decision) and no web receipt cookie (retrieval is via `uploaded_by`).
 * Mirrors `app/api/get-listed/submit`. Atomic: rolls back uploads + the row on
 * any image failure.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

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
  const str = (k: string) => {
    const v = formData.get(k);
    return v === null ? undefined : String(v);
  };

  // Honeypot tripped -> fake success without writing (consistent with the other
  // form endpoints; don't reveal the trap or hard-fail a stray autofill).
  if (isHoneypotTripped(str("website_confirm"))) {
    return ok({ id: null, status: null, image_count: 0 }, undefined, {
      status: 201,
    });
  }

  const companyName = sanitizeString(str("businessName"), 255);
  const contactName = sanitizeString(str("contactName"), 255);
  const email = normalizeEmail(str("email"));
  const businessType = sanitizeString(str("businessType"), 100);
  if (!companyName)
    throw new MobileApiError(
      "validation_error",
      "Business name is required.",
      400,
      "businessName",
    );
  if (!contactName)
    throw new MobileApiError(
      "validation_error",
      "Contact name is required.",
      400,
      "contactName",
    );
  if (!validateEmail(email))
    throw new MobileApiError(
      "validation_error",
      "A valid email is required.",
      400,
      "email",
    );
  if (!businessType)
    throw new MobileApiError(
      "validation_error",
      "Business type is required.",
      400,
      "businessType",
    );

  const phone = normalizePakPhone(str("phone"));
  if (str("phone") && !phone) {
    throw new MobileApiError(
      "validation_error",
      "Invalid Pakistan phone number format.",
      400,
      "phone",
    );
  }

  const ip = getClientIp(request);
  const service = createMobileServiceClient();
  await enforceFormRateLimit(service, "get-listed", ip, 10);
  if (isDisposableEmail(email)) {
    throw new MobileApiError(
      "validation_error",
      "Disposable email addresses are not allowed.",
      400,
      "email",
    );
  }

  const { user } = await getOptionalMobileUser(request);
  const uploadedBy = user?.id ?? null;

  // Validate files (count / size / declared type) BEFORE creating the row, so a
  // bad upload is a clean 400 without an insert+rollback round-trip.
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File);
  validateFilesShallow(files);

  const { data: created, error: createErr } = await service
    .from("form_submissions")
    .insert({
      form_type: "get-listed",
      name: contactName,
      email,
      phone,
      company_name: companyName,
      business_type: businessType,
      address: sanitizeString(str("address"), 255),
      city: sanitizeString(str("city"), 100),
      state: sanitizeString(str("state"), 100),
      zip_code: sanitizeString(str("zipCode"), 20),
      website: sanitizeString(str("website"), 255),
      years_in_business: sanitizeString(str("yearsInBusiness"), 50),
      operating_hours: sanitizeString(str("operatingHours"), 1000),
      message: sanitizeString(str("description"), 2000),
      social_media: sanitizeString(str("socialMedia"), 1000),
      uploaded_by: uploadedBy,
      additional_data: { formVersion: "1.0", submittedFrom: "mobile", ip },
    })
    .select("id, status")
    .single();
  if (createErr || !created) {
    console.error("[mobile-api] get-listed insert failed:", createErr?.message);
    throw new MobileApiError(
      "internal_error",
      "Failed to submit application.",
      500,
    );
  }

  const uploadedPaths: string[] = [];
  try {
    const inserts = await processFiles(
      service,
      created.id,
      uploadedBy,
      files,
      uploadedPaths,
    );
    if (inserts.length > 0) {
      const { error: imgErr } = await service
        .from("form_submission_images")
        .insert(inserts);
      if (imgErr)
        throw new Error(`image rows insert failed: ${imgErr.message}`);
    }
    return ok(
      { id: created.id, status: created.status, image_count: files.length },
      undefined,
      { status: 201 },
    );
  } catch (err) {
    // Roll back: remove any uploaded objects and the submission row. Log cleanup
    // failures so any orphaned objects/rows are at least observable.
    if (uploadedPaths.length > 0) {
      const { error: rmErr } = await service.storage
        .from(BUCKET)
        .remove(uploadedPaths);
      if (rmErr) {
        console.error(
          "[mobile-api] get-listed cleanup (storage) failed:",
          rmErr.message,
          uploadedPaths,
        );
      }
    }
    const { error: delErr } = await service
      .from("form_submissions")
      .delete()
      .eq("id", created.id);
    if (delErr) {
      console.error(
        "[mobile-api] get-listed cleanup (row) failed:",
        delErr.message,
        created.id,
      );
    }
    if (err instanceof MobileApiError) throw err; // e.g. invalid image -> 400
    console.error("[mobile-api] get-listed image processing failed:", err);
    throw new MobileApiError(
      "internal_error",
      "Failed to process images.",
      500,
    );
  }
});
