/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import sharp from 'sharp';
import { signReceipt } from '@/lib/utils/receipt';
import { verifyRecaptcha } from '@/lib/utils/recaptcha';

export const runtime = 'nodejs';

/*
  Atomic submit endpoint:
  - Accepts multipart/form-data with fields matching the get-listed form
  - Files should be sent as `files` (multiple)
  - Inserts a row into form_submissions, uploads optimized image variants to
    get-listed-images, inserts metadata into form_submission_images.
  - If any step fails after creating the submission row, it will delete the
    submission row and cleanup uploaded files to avoid orphaned data.
*/
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase({ useServiceRole: true });

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
      try {
        await (supabase as any).from('upload_audit').insert([{
          event: 'recaptcha_failed',
          status: 'blocked',
          details: { reason: captcha.reason, errorCodes: captcha.errorCodes ?? [], score: captcha.score ?? null },
          ip,
        }]);
      } catch (err) { console.error('audit insert failed', err); }
      return NextResponse.json({ success: false, error: captcha.message }, { status: captcha.status });
    }

  // rate limit: count recent submissions from this IP in last hour
    if (ip) {
      const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await (supabase as any).from('form_submissions').select('id', { count: 'exact', head: false }).gt('submitted_at', cutoff).eq('additional_data->>ip', ip);
      const attempts = Number(count || 0);
      if (attempts >= 10) {
        try { await (supabase as any).from('upload_audit').insert([{ event: 'rate_limit', status: 'blocked', details: { attempts, window_mins: 60 }, ip }]); } catch (err) { console.error('audit insert failed', err); }
        return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
      }
    }

  // attach uploaded_by if user session available
  const supabaseAuthed = await createServerSupabase();
  const { data: userSession } = await (supabaseAuthed as any).auth.getUser();
  const uploaded_by = userSession?.user?.id ?? null;

  const { data: created, error: createErr } = await supabase.from('form_submissions').insert([{ ...submissionRow, additional_data: { ...submissionRow.additional_data, ip }, uploaded_by }]).select('id').single();
    if (createErr || !created?.id) {
      console.error('Failed to create submission', createErr);
      captureRouteError(createErr ?? new Error("Submission row missing after insert"), { route: "/api/get-listed/submit", method: "POST" });
      return NextResponse.json({ success: false, error: 'Failed to create submission' }, { status: 500 });
    }

    const submissionId = created.id;

    // Handle files (if any)
  const fileEntries = formData.getAll('files');
  const fileList = fileEntries.filter(Boolean).slice(0,8) as File[];
    const bucket = 'get-listed-images';
    const uploadedPaths: string[] = [];
  const inserts: any[] = [];

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
        const origPath = `${basePath}/original.webp`;
        const medPath = `${basePath}/medium.webp`;
        const thumbPath = `${basePath}/thumb.webp`;

        await supabase.storage.from(bucket).upload(origPath, original, { contentType: 'image/webp', upsert: false });
        await supabase.storage.from(bucket).upload(medPath, medium, { contentType: 'image/webp', upsert: false });
        await supabase.storage.from(bucket).upload(thumbPath, thumb, { contentType: 'image/webp', upsert: false });

        uploadedPaths.push(origPath, medPath, thumbPath);

        const { data: d1 } = await supabase.storage.from(bucket).createSignedUrl(origPath, 60 * 60 * 24 * 7);
        const { data: d2 } = await supabase.storage.from(bucket).createSignedUrl(medPath, 60 * 60 * 24 * 7);
        const { data: d3 } = await supabase.storage.from(bucket).createSignedUrl(thumbPath, 60 * 60 * 24 * 7);

        inserts.push({ submission_id: submissionId, storage_bucket: bucket, storage_path: origPath, public_url: d1?.signedUrl ?? null, is_public: false, content_type: 'image/webp', file_size_bytes: original.length, width: origMeta.width ?? null, height: origMeta.height ?? null, variant: 'original', uploaded_by });
        inserts.push({ submission_id: submissionId, storage_bucket: bucket, storage_path: medPath, public_url: d2?.signedUrl ?? null, is_public: false, content_type: 'image/webp', file_size_bytes: medium.length, width: medMeta.width ?? null, height: medMeta.height ?? null, variant: 'medium', uploaded_by });
        inserts.push({ submission_id: submissionId, storage_bucket: bucket, storage_path: thumbPath, public_url: d3?.signedUrl ?? null, is_public: false, content_type: 'image/webp', file_size_bytes: thumb.length, width: thumbMeta.width ?? null, height: thumbMeta.height ?? null, variant: 'thumb', uploaded_by });
      }

      if (inserts.length > 0) {
        const { error: insErr } = await supabase.from('form_submission_images').insert(inserts);
        if (insErr) throw insErr;
      }

      // audit: images uploaded
      try {
        await (supabase as any).from('upload_audit').insert([{ submission_id: submissionId, event: 'images_uploaded', status: 'success', details: { files: uploadedPaths.length }, ip }]);
      } catch (e) { console.error('audit insert failed', e); }

  const signed = signReceipt(submissionId);
  const res = NextResponse.json({ success: true, id: submissionId, receipt: String(submissionId), signedReceipt: signed });
  // set httpOnly cookie for easier refresh checks (expires in 7 days)
  res.cookies.set('get_listed_receipt', signed, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7, secure: process.env.NODE_ENV === 'production' });
  return res;

    } catch (upErr) {
  // cleanup uploaded files and remove submission row
  try { await supabase.storage.from(bucket).remove(uploadedPaths); } catch (e) { console.error('cleanup error', e); }
  try { await supabase.from('form_submissions').delete().eq('id', submissionId); } catch (e) { console.error('rollback submission failed', e); }
  try { await (supabase as any).from('upload_audit').insert([{ submission_id: submissionId, event: 'submission_failed', status: 'error', details: { message: String(upErr) }, ip }]); } catch (e) { console.error('audit failed', e); }
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
