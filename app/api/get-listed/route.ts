import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import {
  normalizeEmail,
  validateEmail,
  isDisposableEmail,
  normalizePakPhone,
  sanitizeString,
} from "@/lib/utils/form-utils";
import { verifyRecaptcha } from "@/lib/utils/recaptcha";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.json();

    // Honeypot: if present and non-empty, silently accept
    if (
      typeof formData.website_confirm === "string" &&
      formData.website_confirm.trim().length > 0
    ) {
      return NextResponse.json({
        success: true,
        message: "Business listing submitted successfully!",
      });
    }

    const captcha = await verifyRecaptcha({
      token: formData.recaptcha_token as string | undefined,
      action: "get_listed_submit",
    });
    if (!captcha.ok) {
      return NextResponse.json(
        { error: captcha.message },
        { status: captcha.status }
      );
    }

    // Validate required fields for get-listed form
    if (
      !formData.businessName ||
      !formData.email ||
      !formData.contactName ||
      !formData.businessType
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Sanitize and validate important fields
    const trim = sanitizeString;
    const email = normalizeEmail(formData.email);
    if (!validateEmail(email))
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );

    // Rate limiting (in-memory, ephemeral)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    let total = 0;
    try {
      const { rows: countRows } = await query(
        `SELECT COUNT(*)::int AS count
         FROM form_submissions
         WHERE form_type = 'get-listed'
           AND submitted_at > $1
           AND additional_data->>'ip' = $2`,
        [cutoff, ip]
      );
      total = countRows[0]?.count ?? 0;
    } catch (countErr) {
      console.error("Rate count error (get-listed):", countErr);
    }
    if (total > 20) {
      let retryAfter = Math.ceil(60 * 60);
      try {
        const { rows: earliest } = await query(
          `SELECT submitted_at
           FROM form_submissions
           WHERE form_type = 'get-listed'
             AND submitted_at > $1
             AND additional_data->>'ip' = $2
           ORDER BY submitted_at ASC
           LIMIT 1`,
          [cutoff, ip]
        );
        if (earliest.length && earliest[0].submitted_at) {
          const oldestTs = Date.parse(String(earliest[0].submitted_at));
          const now = Date.now();
          const retryAfterMs = Math.max(0, 60 * 60 * 1000 - (now - oldestTs));
          retryAfter = Math.ceil(retryAfterMs / 1000);
        }
      } catch (eErr) {
        console.error("Rate earliest lookup error (get-listed):", eErr);
      }
      console.warn(
        `Rate limited get-listed - ip=${ip} retryAfter=${retryAfter}s`
      );
      return NextResponse.json(
        { error: "Too many requests from this IP, try again later" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
    if (isDisposableEmail(email))
      return NextResponse.json(
        { error: "Disposable email addresses are not allowed" },
        { status: 400 }
      );

    // normalize phone if present
    const normalizedPhone = normalizePakPhone(formData.phone);
    if (formData.phone && !normalizedPhone)
      return NextResponse.json(
        { error: "Invalid phone format" },
        { status: 400 }
      );

    // zip validation: allow 5-digit Pakistani postal codes
    const zip = (formData.zipCode || "").toString().replace(/\D/g, "");
    if (zip && !/^\d{5}$/.test(zip)) {
      return NextResponse.json(
        { error: "Invalid postal code" },
        { status: 400 }
      );
    }

    const session = await getSession(request);

    // Map form data to our simple table structure
    const submissionData = {
      form_type: "get-listed",
      name: trim(formData.contactName, 255),
      email,
      phone: normalizedPhone,
      company_name: trim(formData.businessName, 255),
      business_type: trim(formData.businessType, 100),
      address: trim(formData.address, 255),
      city: trim(formData.city, 100),
      state: trim(formData.state, 100),
      zip_code: zip || null,
      website: trim(formData.website, 255),
      years_in_business: trim(formData.yearsInBusiness, 10),
      operating_hours: trim(formData.operatingHours, 255),
      message: trim(formData.description, 2000), // Using message field for business description
      social_media: trim(formData.socialMedia, 1024) || null,
      additional_data: {
        formVersion: "1.0",
        submittedFrom: "get-listed-page",
        ip,
        user_id: session?.userId || null,
      },
    };

    // Duplicate check
    const { rows: dupRows } = await query(
      `SELECT id FROM form_submissions
       WHERE form_type = 'get-listed' AND email = $1
       LIMIT 1`,
      [email]
    );
    if (dupRows.length > 0) {
      return NextResponse.json(
        { success: true, message: "You already submitted a listing" },
        { status: 200 }
      );
    }

    // Insert into form_submissions table
    let insertedId: number;
    try {
      const { rows } = await query(
        `INSERT INTO form_submissions
           (form_type, name, email, phone, company_name, business_type, address, city, state,
            zip_code, website, years_in_business, operating_hours, message, social_media, additional_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING id`,
        [
          submissionData.form_type,
          submissionData.name,
          submissionData.email,
          submissionData.phone,
          submissionData.company_name,
          submissionData.business_type,
          submissionData.address,
          submissionData.city,
          submissionData.state,
          submissionData.zip_code,
          submissionData.website,
          submissionData.years_in_business,
          submissionData.operating_hours,
          submissionData.message,
          submissionData.social_media,
          submissionData.additional_data,
        ]
      );
      insertedId = rows[0].id;
    } catch (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to submit listing application" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id: insertedId,
      message: "Business listing submitted successfully!",
    });
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

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter required" },
        { status: 400 }
      );
    }

    // Get user's listing applications
    const { rows: applications } = await query(
      `SELECT * FROM form_submissions
       WHERE form_type = 'get-listed' AND email = $1
       ORDER BY submitted_at DESC`,
      [email]
    );

    return NextResponse.json({
      success: true,
      applications,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
