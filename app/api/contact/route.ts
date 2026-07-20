import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import {
  createNotification,
  resolveCategorySlugForRole,
  dispatchEmailOutboxBatch,
} from "@/lib/notifications";
import type { NotificationUserRole } from "@/types/notifications.types";
import {
  normalizeEmail,
  validateEmail,
  isDisposableEmail,
  sanitizeString,
} from "@/lib/utils/form-utils";
import { verifyRecaptcha } from "@/lib/utils/recaptcha";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.json();

    // Get form type (default to "contact-us" for backward compatibility)
    const formType = formData.form_type || "contact-us";

    // Handle report forms (listing_report and event_report)
    if (formType === "listing_report" || formType === "event_report") {
      // Honeypot check - if filled, reject as bot
      if (formData.honeypot && formData.honeypot.trim()) {
        console.log("Bot detected via honeypot in report form");
        return NextResponse.json(
          { error: "Invalid submission" },
          { status: 400 }
        );
      }

      // Validate required fields for report forms
      if (!formData.email || !formData.message || !formData.metadata) {
        return NextResponse.json(
          {
            error: "Missing required fields for report submission",
          },
          { status: 400 }
        );
      }

      const email = normalizeEmail(formData.email);
      const message = sanitizeString(formData.message, 4000) as string;

      if (!validateEmail(email)) {
        return NextResponse.json(
          { error: "Invalid email address" },
          { status: 400 }
        );
      }

      const session = await getSession(request);

      const additionalData = {
        ...formData.metadata,
        formVersion: "1.0",
        submittedFrom: `${
          formType === "listing_report" ? "listing" : "event"
        }-details-page`,
        ip:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip") ||
          "unknown",
        user_id: session?.userId || null,
      };

      // Insert into form_submissions table
      let reportId: number;
      try {
        const { rows } = await query(
          `INSERT INTO form_submissions (form_type, name, email, phone, message, additional_data)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [formType, "Report Submission", email, null, message, additionalData]
        );
        reportId = rows[0].id;
      } catch (error) {
        console.error("Database error:", error);
        return NextResponse.json(
          { error: "Failed to submit report" },
          { status: 500 }
        );
      }

      // Notify admins
      const { rows: recipients } = await query(
        `SELECT id, role, full_name FROM profiles WHERE role::text = ANY($1::text[])`,
        [["super_admin", "admin"]]
      );

      if (recipients.length) {
        const categoryCache = new Map<NotificationUserRole, string>();
        const itemType = formType === "listing_report" ? "listing" : "event";
        const itemName =
          formData.metadata[`${itemType}_name`] || `Unknown ${itemType}`;

        await Promise.allSettled(
          recipients.map(async (recipient) => {
            try {
              const role = recipient.role as NotificationUserRole;
              if (!categoryCache.has(role)) {
                const slug = await resolveCategorySlugForRole(role);
                categoryCache.set(role, slug);
              }
              const categorySlug = categoryCache.get(role)!;
              await createNotification({
                recipientId: recipient.id,
                roleScope: role,
                categorySlug,
                title: `New ${itemType} report`,
                body: `Issue reported for ${itemName}: ${
                  formData.metadata.issue_type_label || "Unknown issue"
                }`,
                metadata: {
                  formSubmissionId: reportId,
                  formType,
                  itemType,
                  ...formData.metadata,
                },
                priority: "normal",
                ctaLabel: "Review report",
                ctaUrl: "/admin/forms",
                dedupeKey: `${formType}-${reportId}`,
              });
            } catch (notificationError) {
              console.error(
                "Failed to queue report notification",
                notificationError
              );
            }
          })
        );

        // Dispatch notifications immediately for faster delivery
        try {
          await dispatchEmailOutboxBatch({});
        } catch (dispatchError) {
          console.error("Failed to dispatch notifications", dispatchError);
          // Don't fail the report submission if dispatch fails
          // Notifications will be retried by the background job
        }
      }

      return NextResponse.json({
        success: true,
        id: reportId,
        message: "Your report has been submitted successfully!",
      });
    }

    // Handle regular contact form
    // Validate required fields for contact form
    if (!formData.name || !formData.email || !formData.message) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: name, email, and message are required",
        },
        { status: 400 }
      );
    }

    // Honeypot: simple bot trap - if present and non-empty, treat as spam
    if (formData.website_confirm) {
      console.warn("Honeypot triggered for contact form");
      return NextResponse.json(
        { success: true, message: "Your message has been received." },
        { status: 200 }
      );
    }

    // Normalize and validate
    const name = sanitizeString(formData.name, 255) as string;
    const email = normalizeEmail(formData.email);
    const message = sanitizeString(formData.message, 4000) as string;
    const subject = sanitizeString(
      formData.subject || "General Inquiry",
      255
    ) as string;

    if (!validateEmail(email))
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );

    const captcha = await verifyRecaptcha({
      token: formData.recaptcha_token as string | undefined,
      action: "contact",
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

    // Rate limiting: Check form submissions from this IP in last hour
    const cutoffIp = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { rows: countIpRows } = await query(
      `SELECT COUNT(*)::int AS count
       FROM form_submissions
       WHERE form_type = 'contact-us' AND submitted_at > $1 AND additional_data->>'ip' = $2`,
      [cutoffIp, ip]
    );
    const countIp = countIpRows[0]?.count ?? 0;

    if (countIp >= 20) {
      return NextResponse.json(
        { error: "Too many requests from this IP. Please try again later." },
        { status: 429 }
      );
    }

    // Rate limiting: Check email submissions in last 24 hours
    const cutoffEmail = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();
    const { rows: countEmailRows } = await query(
      `SELECT COUNT(*)::int AS count
       FROM form_submissions
       WHERE form_type = 'contact-us' AND submitted_at > $1 AND email = $2`,
      [cutoffEmail, email]
    );
    const countEmail = countEmailRows[0]?.count ?? 0;

    if (countEmail >= 5) {
      return NextResponse.json(
        {
          error:
            "Too many submissions from this email. Please try again later.",
        },
        { status: 429 }
      );
    }

    if (isDisposableEmail(email))
      return NextResponse.json(
        { error: "Disposable email addresses are not allowed" },
        { status: 400 }
      );

    const additionalData = {
      subject,
      formVersion: "1.0",
      submittedFrom: "contact-page",
      ip,
    };

    // Duplicate check: same email & subject in last 24 hours
    const { rows: recentRows } = await query(
      `SELECT id FROM form_submissions
       WHERE form_type = 'contact-us' AND email = $1 AND additional_data->>'subject' = $2
         AND submitted_at >= $3
       LIMIT 1`,
      [email, subject, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()]
    );

    if (recentRows.length > 0)
      return NextResponse.json(
        { success: true, message: "A similar message was recently submitted." },
        { status: 200 }
      );

    // Insert into form_submissions table
    let contactId: number;
    const phone = formData.phone || null;
    try {
      const { rows } = await query(
        `INSERT INTO form_submissions (form_type, name, email, phone, message, additional_data)
         VALUES ('contact-us', $1, $2, $3, $4, $5)
         RETURNING id`,
        [name, email, phone, message, additionalData]
      );
      contactId = rows[0].id;
    } catch (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to submit contact form" },
        { status: 500 }
      );
    }

    try {
      const { rows: recipients } = await query(
        `SELECT id, role, full_name FROM profiles WHERE role::text = ANY($1::text[])`,
        [["super_admin", "admin"]]
      );

      if (recipients.length) {
        const categoryCache = new Map<NotificationUserRole, string>();
        await Promise.allSettled(
          recipients.map(async (recipient) => {
            try {
              const role = recipient.role as NotificationUserRole;
              if (!categoryCache.has(role)) {
                const slug = await resolveCategorySlugForRole(role);
                categoryCache.set(role, slug);
              }
              const categorySlug = categoryCache.get(role)!;
              await createNotification({
                recipientId: recipient.id,
                roleScope: role,
                categorySlug,
                title: `New contact request from ${name}`,
                body: `${name} (${email}) sent a new contact message. Subject: ${subject}`,
                metadata: {
                  formSubmissionId: contactId,
                  email,
                  phone,
                  subject,
                  messagePreview: message.slice(0, 160),
                  formType: "contact-us",
                },
                priority: "normal",
                ctaLabel: "Review contact message",
                ctaUrl: "/admin/forms?form=contact-us",
                dedupeKey: `contact-us-${contactId}`,
              });
            } catch (notificationError) {
              console.error(
                "Failed to queue contact notification",
                notificationError
              );
            }
          })
        );

        // Dispatch notifications immediately for faster delivery
        try {
          await dispatchEmailOutboxBatch({});
        } catch (dispatchError) {
          console.error("Failed to dispatch notifications", dispatchError);
          // Don't fail the contact form submission if dispatch fails
          // Notifications will be retried by the background job
        }
      }
    } catch (recipientsError) {
      console.error(
        "Failed to load contact notification recipients",
        recipientsError
      );
    }

    return NextResponse.json({
      success: true,
      id: contactId,
      message: "Your message has been sent successfully!",
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

    // Get user's contact form submissions
    const { rows: submissions } = await query(
      `SELECT * FROM form_submissions
       WHERE form_type = 'contact-us' AND email = $1
       ORDER BY submitted_at DESC`,
      [email]
    );

    return NextResponse.json({
      success: true,
      submissions,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
