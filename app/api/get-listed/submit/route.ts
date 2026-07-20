import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import sharp from 'sharp';
import { signReceipt } from '@/lib/utils/receipt';
import { verifyRecaptcha } from '@/lib/utils/recaptcha';
import {
  GET_LISTED_IMAGES_PREFIX,
  toPrefixedObjectKey,
  uploadFile,
  deleteFile,
  getPublicUrl,
} from '@/lib/storage/spaces';

export const runtime = 'nodejs';

const SPACES_BUCKET = process.env.DO_SPACES_BUCKET || "insidekhi";

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

async function insertAuditEvent(
  submissionId: number | null,
  event: string,
  status: string,
  details: Record<string, unknown>,
  ip: string | null,
) {
  try {
    await query(
      `INSERT INTO upload_audit (submission_id, event, status, details, ip)
       VALUES ($1, $2, $3, $4, $5)`,
      [submissionId, event, status, details, ip],
    );
  } catch (err) {
    console.error('audit insert failed', err);
  }
}

/*
  Atomic submit endpoint:
  - Accepts multipart/form-data with fields matching the get-listed form
  - Files should be sent as `files` (multiple)
  - Inserts a row into form_submissions, uploads optimized image variants to
    DigitalOcean Spaces (get-listed-images prefix), inserts metadata into
    form_submission_images.
  - If any step fails after creating the submission row, it will delete the
    submission row and cleanup uploaded files to avoid orphaned data.
*/
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    // Map expected fields (same names as client form)
    const payload: Record<string, string> = {};
    const fields = ['businessName','businessType','yearsInBusiness','address','city','state','zipCode','website','contactName','email','phone','operatingHours','description','socialMedia'];
    for (const f of fields) {
      const v = formData.get(f);
      if (v !== null) payload[f] = String(v);
    }

    // honeypot: invisible field, should be empty
    const honeypot = String(formData.get('website_confirm') || '');
    if (honeypot.trim()) return NextResponse.json({ success: false, error: 'Spam detected' }, { status: 400 });

    const recaptchaToken = String(formData.get('recaptcha_token') || '');

    // Basic validation
    if (!payload.businessName || !payload.email || !payload.contactName || !payload.businessType) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Insert the submission row
    const submissionRow = {
      form_type: 'get-listed',
      name: payload.contactName.slice(0,255),
      email: payload.email,
      phone: payload.phone || null,
      company_name: payload.businessName.slice(0,255),
      business_type: payload.businessType.slice(0,100),
      address: payload.address?.slice(0,255) || null,
      city: payload.city?.slice(0,100) || null,
      state: payload.state?.slice(0,100) || null,
      zip_code: payload.zipCode || null,
      website: payload.website?.slice(0,255) || null,
      years_in_business: payload.yearsInBusiness || null,
      operating_hours: payload.operatingHours || null,
      message: payload.description?.slice(0,2000) || null,
      social_media: payload.socialMedia || null,
      additional_data: { formVersion: '1.0', submittedFrom: 'get-listed-page' }
    };

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;

    const captcha = await verifyRecaptcha({
      token: recaptchaToken,
      action: 'get_listed_submit',
    });
    if (!captcha.ok) {
      await insertAuditEvent(null, 'recaptcha_failed', 'blocked', { reason: captcha.reason, errorCodes: captcha.errorCodes ?? [], score: captcha.score ?? null }, ip);
      return NextResponse.json({ success: false, error: captcha.message }, { status: captcha.status });
    }

    // rate limit: count recent submissions from this IP in last hour
    if (ip) {
      const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { rows: countRows } = await query(
        `SELECT COUNT(*)::int AS count
         FROM form_submissions
         WHERE submitted_at > $1 AND additional_data->>'ip' = $2`,
        [cutoff, ip],
      );
      const attempts = countRows[0]?.count ?? 0;
      if (attempts >= 10) {
        await insertAuditEvent(null, 'rate_limit', 'blocked', { attempts, window_mins: 60 }, ip);
        return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
      }
    }

    // attach uploaded_by if user session available
    const session = await getSession(req);
    const uploaded_by = session?.userId ?? null;

    let submissionId: number;
    try {
      const { rows } = await query(
        `INSERT INTO form_submissions
           (form_type, name, email, phone, company_name, business_type, address, city, state,
            zip_code, website, years_in_business, operating_hours, message, social_media, additional_data, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING id`,
        [
          submissionRow.form_type,
          submissionRow.name,
          submissionRow.email,
          submissionRow.phone,
          submissionRow.company_name,
          submissionRow.business_type,
          submissionRow.address,
          submissionRow.city,
          submissionRow.state,
          submissionRow.zip_code,
          submissionRow.website,
          submissionRow.years_in_business,
          submissionRow.operating_hours,
          submissionRow.message,
          submissionRow.social_media,
          { ...submissionRow.additional_data, ip },
          uploaded_by,
        ],
      );
      submissionId = rows[0]?.id;
      if (!submissionId) throw new Error("Submission row missing after insert");
    } catch (createErr) {
      console.error('Failed to create submission', createErr);
      captureRouteError(createErr, { route: "/api/get-listed/submit", method: "POST" });
      return NextResponse.json({ success: false, error: 'Failed to create submission' }, { status: 500 });
    }

    // Handle files (if any)
    const fileEntries = formData.getAll('files');
    const fileList = fileEntries.filter(Boolean).slice(0,8) as File[];
    const uploadedKeys: string[] = [];
    const inserts: ImageInsert[] = [];

    try {
      for (const file of fileList) {
        const mime = file.type || '';
        if (!/^image\/(jpeg|jpg|png|webp|avif)$/.test(mime)) throw new Error('Invalid file type');

        const arrayBuf = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        const origSharp = sharp(buffer).resize({ width: 2000, withoutEnlargement: true }).toFormat('webp');
        const medSharp = sharp(buffer).resize({ width: 1200, withoutEnlargement: true }).toFormat('webp');
        const thumbSharp = sharp(buffer).resize({ width: 400, withoutEnlargement: true }).toFormat('webp');

        const [original, medium, thumb] = await Promise.all([origSharp.toBuffer(), medSharp.toBuffer(), thumbSharp.toBuffer()]);
        const origMeta = await sharp(original).metadata();
        const medMeta = await sharp(medium).metadata();
        const thumbMeta = await sharp(thumb).metadata();

        const uid = crypto.randomUUID();
        const basePath = `${submissionId}/${uid}`;
        const origKey = toPrefixedObjectKey(GET_LISTED_IMAGES_PREFIX, `${basePath}/original.webp`);
        const medKey = toPrefixedObjectKey(GET_LISTED_IMAGES_PREFIX, `${basePath}/medium.webp`);
        const thumbKey = toPrefixedObjectKey(GET_LISTED_IMAGES_PREFIX, `${basePath}/thumb.webp`);

        await uploadFile(origKey, original, { contentType: 'image/webp' });
        await uploadFile(medKey, medium, { contentType: 'image/webp' });
        await uploadFile(thumbKey, thumb, { contentType: 'image/webp' });

        uploadedKeys.push(origKey, medKey, thumbKey);

        inserts.push({ submission_id: submissionId, storage_bucket: SPACES_BUCKET, storage_path: origKey, public_url: getPublicUrl(origKey), is_public: true, content_type: 'image/webp', file_size_bytes: original.length, width: origMeta.width ?? null, height: origMeta.height ?? null, variant: 'original', uploaded_by });
        inserts.push({ submission_id: submissionId, storage_bucket: SPACES_BUCKET, storage_path: medKey, public_url: getPublicUrl(medKey), is_public: true, content_type: 'image/webp', file_size_bytes: medium.length, width: medMeta.width ?? null, height: medMeta.height ?? null, variant: 'medium', uploaded_by });
        inserts.push({ submission_id: submissionId, storage_bucket: SPACES_BUCKET, storage_path: thumbKey, public_url: getPublicUrl(thumbKey), is_public: true, content_type: 'image/webp', file_size_bytes: thumb.length, width: thumbMeta.width ?? null, height: thumbMeta.height ?? null, variant: 'thumb', uploaded_by });
      }

      if (inserts.length > 0) {
        const values: unknown[] = [];
        const placeholders = inserts
          .map((row, i) => {
            const base = i * 11;
            values.push(
              row.submission_id, row.storage_bucket, row.storage_path, row.public_url,
              row.is_public, row.content_type, row.file_size_bytes, row.width,
              row.height, row.variant, row.uploaded_by,
            );
            return `($${base+1}, $${base+2}, $${base+3}, $${base+4}, $${base+5}, $${base+6}, $${base+7}, $${base+8}, $${base+9}, $${base+10}, $${base+11})`;
          })
          .join(', ');

        await query(
          `INSERT INTO form_submission_images
             (submission_id, storage_bucket, storage_path, public_url, is_public, content_type, file_size_bytes, width, height, variant, uploaded_by)
           VALUES ${placeholders}`,
          values,
        );
      }

      // audit: images uploaded
      await insertAuditEvent(submissionId, 'images_uploaded', 'success', { files: uploadedKeys.length }, ip);

      const signed = signReceipt(submissionId);
      const res = NextResponse.json({ success: true, id: submissionId, receipt: String(submissionId), signedReceipt: signed });
      // set httpOnly cookie for easier refresh checks (expires in 7 days)
      res.cookies.set('get_listed_receipt', signed, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7, secure: process.env.NODE_ENV === 'production' });
      return res;

    } catch (upErr) {
      // cleanup uploaded files and remove submission row
      try {
        await Promise.all(uploadedKeys.map((key) => deleteFile(key)));
      } catch (e) { console.error('cleanup error', e); }
      try {
        await query(`DELETE FROM form_submissions WHERE id = $1`, [submissionId]);
      } catch (e) { console.error('rollback submission failed', e); }
      await insertAuditEvent(submissionId, 'submission_failed', 'error', { message: String(upErr) }, ip);
      console.error('Atomic submit failed', upErr);
      captureRouteError(upErr, { route: "/api/get-listed/submit", method: "POST" });
      return NextResponse.json({ success: false, error: 'Upload or save failed' }, { status: 500 });
    }

  } catch (err) {
    console.error('Submit route error', err);
    captureRouteError(err, { route: "/api/get-listed/submit", method: "POST" });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
