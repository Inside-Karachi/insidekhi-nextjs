import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";
import {
  normalizeEmail,
  validateEmail,
  isDisposableEmail,
  normalizePakPhone,
  sanitizeString,
} from "@/lib/utils/form-utils";
import { signReceipt } from "@/lib/utils/receipt";
import { verifyRecaptcha } from "@/lib/utils/recaptcha";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.json();

    // Honeypot: simple bot trap - if present and non-empty, treat as spam and respond success
    if (
      typeof formData.website_confirm === "string" &&
      formData.website_confirm.trim().length > 0
    ) {
      return NextResponse.json(
        { success: true, message: "Your application has been received." },
        { status: 200 }
      );
    }

    const captcha = await verifyRecaptcha({
      token: formData.recaptcha_token as string | undefined,
      action: "membership_submit",
    });
    if (!captcha.ok) {
      return NextResponse.json(
        { error: captcha.message },
        { status: captcha.status }
      );
    }

    // Use query() for duplication checks and the insert (server-only operation)

    // Basic required-field validation
    const required = ["companyName", "email", "contactName", "businessType"];
    for (const field of required) {
      if (
        !formData[field] ||
        typeof formData[field] !== "string" ||
        !formData[field].trim()
      ) {
        return NextResponse.json(
          { error: `Missing or invalid required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Normalize / sanitize inputs
    const trim = sanitizeString;
    const email = normalizeEmail(formData.email);

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS cnt FROM public.form_submissions
       WHERE form_type = 'membership' AND submitted_at > $1 AND additional_data->>'ip' = $2`,
      [cutoff, ip]
    );
    const total = (countRows[0] as { cnt: number })?.cnt ?? 0;
    if (total > 10) {
      const { rows: earliest } = await query(
        `SELECT submitted_at FROM public.form_submissions
         WHERE form_type = 'membership' AND submitted_at > $1 AND additional_data->>'ip' = $2
         ORDER BY submitted_at ASC LIMIT 1`,
        [cutoff, ip]
      );
      let retryAfter = Math.ceil(60 * 60);
      if (earliest.length && (earliest[0] as { submitted_at: string }).submitted_at) {
        const oldestTs = Date.parse(String((earliest[0] as { submitted_at: string }).submitted_at));
        const now = Date.now();
        const retryAfterMs = Math.max(0, 60 * 60 * 1000 - (now - oldestTs));
        retryAfter = Math.ceil(retryAfterMs / 1000);
      }
      console.warn(
        `Rate limited membership - ip=${ip} retryAfter=${retryAfter}s`
      );
      return NextResponse.json(
        { error: "Too many submissions from this IP, try later" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
    if (isDisposableEmail(email))
      return NextResponse.json(
        { error: "Disposable email addresses are not allowed" },
        { status: 400 }
      );
    if (!validateEmail(email))
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );

    // Business types whitelist (keep in sync with client)
    const allowedBusinessTypes = [
      "Restaurant & Food",
      "Hotel & Accommodation",
      "Event Management",
      "Entertainment & Leisure",
      "Shopping & Retail",
      "Fitness & Healthcare",
      "Education & Training",
      "Professional Services",
      "Other",
    ];
    const businessType = trim(formData.businessType, 100) as string;
    if (!allowedBusinessTypes.includes(businessType)) {
      return NextResponse.json(
        { error: "Invalid business type" },
        { status: 400 }
      );
    }

    const phoneNormalized = normalizePakPhone(formData.phone);
    if (formData.phone && !phoneNormalized)
      return NextResponse.json(
        { error: "Invalid Pakistan phone number format" },
        { status: 400 }
      );

    // Optional website validation
    const website = trim(formData.website, 255);
    if (website) {
      try {
        const u = new URL(
          website.startsWith("http") ? website : `https://${website}`
        );
        // basic check: must have hostname
        if (!u.hostname) throw new Error("invalid");
      } catch {
        return NextResponse.json(
          { error: "Invalid website URL" },
          { status: 400 }
        );
      }
    }

    // Prepare submission payload
    const submissionData = {
      form_type: "membership",
      name: trim(formData.contactName, 255),
      email,
      phone: phoneNormalized,
      company_name: trim(formData.companyName, 255),
      business_type: businessType,
      address: trim(formData.address, 1000),
      city: trim(formData.city, 100),
      state: trim(formData.state, 100),
      zip_code: trim(formData.zipCode, 20),
      website: website || null,
      years_in_business: trim(formData.yearsInBusiness, 50),
      message: trim(formData.interests, 2000),
      additional_data: {
        formVersion: "1.0",
        submittedFrom: "membership-page",
        ip,
      },
    };

    // Duplicate check using query()
    const { rows: existingRows } = await query(
      `SELECT id FROM public.form_submissions WHERE form_type = 'membership' AND email = $1 LIMIT 1`,
      [email]
    );
    const existing = existingRows[0] ?? null;

    if (existing) {
      return NextResponse.json(
        {
          success: true,
          message: "You have already submitted an application.",
        },
        { status: 200 }
      );
    }

    // Perform insert using service role (server-only) so we can return the new id reliably
    // Attach uploaded_by when user session available
    try {
      const session = await getSessionFromCookies();
      const uploaded_by = session?.userId ?? null;
      const toInsert = { ...submissionData, uploaded_by };

      const { rows: insertedRows } = await query(
        `INSERT INTO public.form_submissions
         (form_type, name, email, phone, company_name, business_type, address, city, state,
          zip_code, website, years_in_business, message, additional_data, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING id`,
        [
          toInsert.form_type, toInsert.name, toInsert.email, toInsert.phone,
          toInsert.company_name, toInsert.business_type, toInsert.address,
          toInsert.city, toInsert.state, toInsert.zip_code, toInsert.website,
          toInsert.years_in_business, toInsert.message,
          JSON.stringify(toInsert.additional_data), toInsert.uploaded_by
        ]
      );
      const insertedId = (insertedRows[0] as { id: string })?.id;

      const signed = signReceipt(insertedId);
      const res = NextResponse.json({
        success: true,
        id: insertedId,
        signedReceipt: signed,
        message: "Membership application submitted successfully!",
      });
      res.cookies.set("membership_receipt", signed, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
        secure: process.env.NODE_ENV === "production",
      });
      return res;
    } catch (err) {
      console.error("Insert error:", err);
      return NextResponse.json(
        { error: "Failed to submit application" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    // If no email query param, detect logged-in user and query by uploaded_by
    if (!email) {
      try {
        const session = await getSessionFromCookies();
        if (!session) return NextResponse.json({ success: true, applications: [] });
        const { rows } = await query(
          `SELECT * FROM public.form_submissions
           WHERE form_type = 'membership' AND uploaded_by = $1
           ORDER BY submitted_at DESC`,
          [session.userId]
        );
        return NextResponse.json({ success: true, applications: rows });
      } catch (err) {
        console.error("Auth read failed", err);
        return NextResponse.json({ success: true, applications: [] });
      }
    }

    // Email-based lookup requires authentication and restricts to own email
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the user's actual email from auth.users
    const { rows: userRows } = await query(
      "SELECT email FROM auth.users WHERE id = $1 LIMIT 1",
      [session.userId]
    );
    const userEmail = (userRows[0] as { email: string } | undefined)?.email;
    if (!userEmail || userEmail.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: "You can only view your own applications" },
        { status: 403 }
      );
    }

    // Get user's membership applications by email (fallback)
    const { rows } = await query(
      `SELECT * FROM public.form_submissions
       WHERE form_type = 'membership' AND email = $1
       ORDER BY submitted_at DESC`,
      [email]
    );

    return NextResponse.json({
      success: true,
      applications: rows,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
