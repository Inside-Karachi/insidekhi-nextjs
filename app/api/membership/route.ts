import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
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

    // Use admin client for duplication checks and the insert (server-only operation)
    const supabaseAdmin = await createServerSupabase({ useServiceRole: true });

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
    const { count, error: countErr } = await supabaseAdmin
      .from("form_submissions")
      .select("id", { count: "exact" })
      .eq("form_type", "membership")
      .gt("submitted_at", cutoff)
      .eq("additional_data->>ip", ip);
    if (countErr) console.error("Rate count error (membership):", countErr);
    const total = typeof count === "number" ? count : 0;
    if (total > 10) {
      const { data: earliest, error: eErr } = await supabaseAdmin
        .from("form_submissions")
        .select("submitted_at")
        .eq("form_type", "membership")
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

    // Duplicate check: safe server-side SELECT using service role
    const { data: existing, error: dupErr } = await supabaseAdmin
      .from("form_submissions")
      .select("id")
      .eq("form_type", "membership")
      .eq("email", email)
      .limit(1)
      .maybeSingle();

    if (dupErr) {
      console.error("Duplication check error:", dupErr);
      return NextResponse.json(
        { error: "Failed to verify existing submissions" },
        { status: 500 }
      );
    }

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
      const supabaseAuth = await createServerSupabase();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userSession = (await supabaseAuth.auth.getUser()) as any;
      const uploaded_by = userSession?.data?.user?.id ?? null;
      const toInsert = { ...submissionData, uploaded_by };

      const { data, error } = await supabaseAdmin
        .from("form_submissions")
        .insert([toInsert])
        .select("id")
        .single();

      if (error) {
        console.error("Database error:", error);
        return NextResponse.json(
          { error: "Failed to submit application" },
          { status: 500 }
        );
      }

      const signed = signReceipt(data.id);
      const res = NextResponse.json({
        success: true,
        id: data.id,
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
    // For GET requests, we use the default (anon or user) role
    const supabase = await createServerSupabase();
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    // If no email query param, try to detect logged-in user and query by uploaded_by
    if (!email) {
      try {
        const userRes = await supabase.auth.getUser();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userId = (userRes as any)?.data?.user?.id ?? null;
        if (!userId)
          return NextResponse.json({ success: true, applications: [] });
        const { data, error } = await supabase
          .from("form_submissions")
          .select("*")
          .eq("form_type", "membership")
          .eq("uploaded_by", userId)
          .order("submitted_at", { ascending: false });
        if (error) {
          console.error("Database error:", error);
          return NextResponse.json(
            { error: "Failed to fetch applications" },
            { status: 500 }
          );
        }
        return NextResponse.json({ success: true, applications: data });
      } catch (err) {
        console.error("Auth read failed", err);
        return NextResponse.json({ success: true, applications: [] });
      }
    }

    // Email-based lookup requires authentication and restricts to own email
    const authCheck = await supabase.auth.getUser();
    if (!authCheck.data?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (authCheck.data.user.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: "You can only view your own applications" },
        { status: 403 }
      );
    }

    // Get user's membership applications by email (fallback)
    const { data, error } = await supabase
      .from("form_submissions")
      .select("*")
      .eq("form_type", "membership")
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
