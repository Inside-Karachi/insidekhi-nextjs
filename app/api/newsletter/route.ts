import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  normalizeEmail,
  validateEmail,
  isDisposableEmail,
} from "@/lib/utils/form-utils";
import { verifyRecaptcha } from "@/lib/utils/recaptcha";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase({ useServiceRole: true });
    const formData = await request.json();

    // Honeypot: if present and non-empty, silently accept to confuse bots
    if (
      typeof formData.website_confirm === "string" &&
      formData.website_confirm.trim().length > 0
    ) {
      return NextResponse.json({
        success: true,
        message: "You are already subscribed to our newsletter!",
      });
    }

    const email = normalizeEmail(formData.email);
    if (!email || !validateEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // reCAPTCHA v3 verification (required in production; soft in development)
    const captcha = await verifyRecaptcha({
      token: formData.recaptcha_token as string | undefined,
      action: "newsletter_subscribe",
    });
    if (!captcha.ok) {
      return NextResponse.json(
        { error: captcha.message },
        { status: captcha.status }
      );
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    // DB-backed rate check (count recent submissions from this IP)
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countErr } = await supabase
      .from("form_submissions")
      .select("id", { count: "exact" })
      .eq("form_type", "newsletter")
      .gt("submitted_at", cutoff)
      .eq("additional_data->>ip", ip);
    if (countErr) console.error("Rate count error (newsletter):", countErr);
    const total = typeof count === "number" ? count : 0;
    if (total > 50) {
      // Compute earliest timestamp in window to estimate Retry-After
      const { data: earliest, error: eErr } = await supabase
        .from("form_submissions")
        .select("submitted_at")
        .eq("form_type", "newsletter")
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
        `Rate limited newsletter - ip=${ip} retryAfter=${retryAfter}s`
      );
      return NextResponse.json(
        { error: "Too many requests from this IP, try later" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    if (isDisposableEmail(email)) {
      return NextResponse.json(
        { error: "Disposable email addresses are not allowed" },
        { status: 400 }
      );
    }

    // Check if email already subscribed
    const { data: existing } = await supabase
      .from("form_submissions")
      .select("id")
      .eq("form_type", "newsletter")
      .eq("email", email)
      .single();

    if (existing) {
      return NextResponse.json({
        success: true,
        message: "You are already subscribed to our newsletter!",
      });
    }

    const submissionData = {
      form_type: "newsletter",
      email,
      status: "n/a", // Newsletter subscriptions don't need admin action
      additional_data: {
        interests: formData.interests || [],
        source: formData.source || "website",
        ip,
        formVersion: "1.0",
        subscribedAt: new Date().toISOString(),
      },
    };

    const { data, error } = await supabase
      .from("form_submissions")
      .insert([submissionData])
      .select("id")
      .single();

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to subscribe to newsletter" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id: data.id,
      message: "Successfully subscribed to our newsletter!",
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    // Remove newsletter subscription
    const { error } = await supabase
      .from("form_submissions")
      .delete()
      .eq("form_type", "newsletter")
      .eq("email", email);

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to unsubscribe" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Successfully unsubscribed from newsletter",
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

    // Check subscription status
    const { data, error } = await supabase
      .from("form_submissions")
      .select("*")
      .eq("form_type", "newsletter")
      .eq("email", email)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found"
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to check subscription status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      subscribed: !!data,
      subscription: data || null,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
