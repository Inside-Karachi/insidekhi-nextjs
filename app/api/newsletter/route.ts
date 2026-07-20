import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  normalizeEmail,
  validateEmail,
  isDisposableEmail,
} from "@/lib/utils/form-utils";
import { verifyRecaptcha } from "@/lib/utils/recaptcha";

export async function POST(request: NextRequest) {
  try {
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
    let total = 0;
    try {
      const { rows: countRows } = await query(
        `SELECT COUNT(*)::int AS count
         FROM form_submissions
         WHERE form_type = 'newsletter'
           AND submitted_at > $1
           AND additional_data->>'ip' = $2`,
        [cutoff, ip]
      );
      total = countRows[0]?.count ?? 0;
    } catch (countErr) {
      console.error("Rate count error (newsletter):", countErr);
    }
    if (total > 50) {
      // Compute earliest timestamp in window to estimate Retry-After
      let retryAfter = Math.ceil(60 * 60);
      try {
        const { rows: earliest } = await query(
          `SELECT submitted_at
           FROM form_submissions
           WHERE form_type = 'newsletter'
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
        console.error("Rate earliest lookup error (newsletter):", eErr);
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
    const { rows: existingRows } = await query(
      `SELECT id FROM form_submissions
       WHERE form_type = 'newsletter' AND email = $1
       LIMIT 1`,
      [email]
    );

    if (existingRows.length > 0) {
      return NextResponse.json({
        success: true,
        message: "You are already subscribed to our newsletter!",
      });
    }

    const additionalData = {
      interests: formData.interests || [],
      source: formData.source || "website",
      ip,
      formVersion: "1.0",
      subscribedAt: new Date().toISOString(),
    };

    let insertedId: number;
    try {
      const { rows } = await query(
        `INSERT INTO form_submissions (form_type, email, status, additional_data)
         VALUES ('newsletter', $1, 'n/a', $2)
         RETURNING id`,
        [email, additionalData]
      );
      insertedId = rows[0].id;
    } catch (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to subscribe to newsletter" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id: insertedId,
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
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter required" },
        { status: 400 }
      );
    }

    // Remove newsletter subscription
    try {
      await query(
        `DELETE FROM form_submissions WHERE form_type = 'newsletter' AND email = $1`,
        [email]
      );
    } catch (error) {
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
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter required" },
        { status: 400 }
      );
    }

    // Check subscription status
    let subscription = null;
    try {
      const { rows } = await query(
        `SELECT * FROM form_submissions
         WHERE form_type = 'newsletter' AND email = $1
         LIMIT 1`,
        [email]
      );
      subscription = rows[0] ?? null;
    } catch (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to check subscription status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      subscribed: !!subscription,
      subscription,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
