import { type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import {
  GET_LISTED_IMAGES_PREFIX,
  toPrefixedObjectKey,
  uploadFile,
  deleteFile,
} from "@/lib/storage/spaces";
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

export const runtime = "nodejs"; // sharp needs the Node runtime
export const dynamic = "force-dynamic";

const MAX_FILES = 8;
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB per source image
const MAX_TOTAL_BYTES = 24 * 1024 * 1024; // 24MB across all images per request
const MAX_INPUT_PIXELS = 24_000_000; // ~24MP - guards against decompression bombs
const ALLOWED_DECODED = new Set(["jpeg", "png", "webp", "avif"]);
const ALLOWED_IMAGE = /^image\/(jpeg|jpg|png|webp|avif)$/;

// Memory hygiene under load: no process-wide buffer cache, and cap libvips
// threads so concurrent uploads can't fan out the CPU pool.
sharp.cache(false);
sharp.concurrency(1);

interface ImageInsert {
  submission_id: number;
  storage_bucket: string;
  storage_path: string;
  public_url: string | null;
  is_public: boolean;
  content_type: string;
  file_size_bytes: number;
  width: number | null;
  height: number | null;
  variant: string;
  uploaded_by: string | null;
}

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
 * three webp variants per image to the `get-listed-images/` prefix in
 * DigitalOcean Spaces and returns the `form_submission_images` rows to insert.
 * Throws on any failure (the caller rolls back). Tracks uploaded keys in
 * `uploadedKeys` for cleanup.
 */
async function processFiles(
  submissionId: number,
  uploadedBy: string | null,
  files: File[],
  uploadedKeys: string[],
): Promise<ImageInsert[]> {
  const inserts: ImageInsert[] = [];
  for (const file of files) {
    const variants = await buildVariants(file);
    const base = `${submissionId}/${randomUUID()}`;
    for (const v of variants) {
      const key = toPrefixedObjectKey(
        GET_LISTED_IMAGES_PREFIX,
        `${base}/${v.variant}.webp`,
      );
      const uploaded = await uploadFile(key, v.data, {
        contentType: "image/webp",
      });
      uploadedKeys.push(key);
      inserts.push({
        submission_id: submissionId,
        storage_bucket: process.env.DO_SPACES_BUCKET || "insidekhi",
        storage_path: key,
        public_url: uploaded.publicUrl,
        is_public: true,
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
 * original/medium/thumb webp variants under the `get-listed-images/` prefix in
 * DigitalOcean Spaces (public CDN URLs). Honeypot + per-IP rate limit; no
 * reCAPTCHA (per the mobile decision). Mirrors `app/api/get-listed/submit`.
 * Atomic: rolls back uploads + the row on any image failure.
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
  await enforceFormRateLimit("get-listed", ip, 10);
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

  let created: { id: number; status: string | null } | undefined;
  try {
    const { rows } = await query(
      `INSERT INTO form_submissions
         (form_type, name, email, phone, company_name, business_type, address, city, state,
          zip_code, website, years_in_business, operating_hours, message, social_media, uploaded_by, additional_data)
       VALUES ('get-listed', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING id, status`,
      [
        contactName,
        email,
        phone,
        companyName,
        businessType,
        sanitizeString(str("address"), 255),
        sanitizeString(str("city"), 100),
        sanitizeString(str("state"), 100),
        sanitizeString(str("zipCode"), 20),
        sanitizeString(str("website"), 255),
        sanitizeString(str("yearsInBusiness"), 50),
        sanitizeString(str("operatingHours"), 1000),
        sanitizeString(str("description"), 2000),
        sanitizeString(str("socialMedia"), 1000),
        uploadedBy,
        { formVersion: "1.0", submittedFrom: "mobile", ip },
      ],
    );
    created = rows[0];
  } catch (createErr) {
    console.error("[mobile-api] get-listed insert failed:", createErr);
  }
  if (!created) {
    throw new MobileApiError(
      "internal_error",
      "Failed to submit application.",
      500,
    );
  }

  const uploadedKeys: string[] = [];
  try {
    const inserts = await processFiles(
      created.id,
      uploadedBy,
      files,
      uploadedKeys,
    );
    if (inserts.length > 0) {
      const values: unknown[] = [];
      const placeholders = inserts
        .map((row, i) => {
          const base = i * 10;
          values.push(
            row.submission_id,
            row.storage_bucket,
            row.storage_path,
            row.public_url,
            row.is_public,
            row.content_type,
            row.file_size_bytes,
            row.width,
            row.height,
            row.variant,
          );
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`;
        })
        .join(", ");
      await query(
        `INSERT INTO form_submission_images
           (submission_id, storage_bucket, storage_path, public_url, is_public, content_type, file_size_bytes, width, height, variant)
         VALUES ${placeholders}`,
        values,
      );
    }
    return ok(
      { id: created.id, status: created.status, image_count: files.length },
      undefined,
      { status: 201 },
    );
  } catch (err) {
    // Roll back: remove any uploaded objects and the submission row. Log cleanup
    // failures so any orphaned objects/rows are at least observable.
    if (uploadedKeys.length > 0) {
      await Promise.allSettled(
        uploadedKeys.map((key) =>
          deleteFile(key).catch((rmErr) =>
            console.error(
              "[mobile-api] get-listed cleanup (storage) failed:",
              rmErr,
              key,
            ),
          ),
        ),
      );
    }
    try {
      await query(`DELETE FROM form_submissions WHERE id = $1`, [created.id]);
    } catch (delErr) {
      console.error(
        "[mobile-api] get-listed cleanup (row) failed:",
        delErr,
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
