import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
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
    // Use service role for safe server-side inserts and duplicate checks
    const supabase = await createServerSupabase({ useServiceRole: true });
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
    const { count, error: countErr } = await supabase
      .from("form_submissions")
      .select("id", { count: "exact" })
      .eq("form_type", "get-listed")
      .gt("submitted_at", cutoff)
      .eq("additional_data->>ip", ip);
    if (countErr) console.error("Rate count error (get-listed):", countErr);
    const total = typeof count === "number" ? count : 0;
    if (total > 20) {
      const { data: earliest, error: eErr } = await supabase
        .from("form_submissions")
        .select("submitted_at")
        .eq("form_type", "get-listed")
        .gt("submitted_at", cutoff)
        .eq("additional_data->>ip", ip)
        .order("submitted_at", { ascending: true })
        .limit(1);
      let retryAfter = Math.ceil(60 * 60);
      if (!eErr && earliest && earliest.length && earliest[0].submitted_at) {
        const oldestTs = Date.parse(String(earliest[0].submitted_at));
        const now = Date.now();
        const retryAfterMs = Math.max(0, 60 * 60 * 1000 - (now - oldestTs));
        retryAfter = Math.ceil(retryAfterMs / 1000);
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
        user_id: (await createServerSupabase().then(c => c.auth.getUser())).data.user?.id || null,
      },
    };

    // Duplicate check
    const { data: dup } = await supabase
      .from("form_submissions")
      .select("id")
      .eq("form_type", "get-listed")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    if (dup) {
      return NextResponse.json(
        { success: true, message: "You already submitted a listing" },
        { status: 200 }
      );
    }

    // Insert into form_submissions table
    const { data, error } = await supabase
      .from("form_submissions")
      .insert([submissionData])
      .select("id")
      .single();

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to submit listing application" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id: data.id,
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
    const supabase = await createServerSupabase();
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter required" },
        { status: 400 }
      );
    }

    // Get user's listing applications
    const { data, error } = await supabase
      .from("form_submissions")
      .select("*")
      .eq("form_type", "get-listed")
      .eq("email", email)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch applications" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      applications: data,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
