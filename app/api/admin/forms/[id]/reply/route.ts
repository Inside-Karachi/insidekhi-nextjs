import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireStaff, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import type { SendReplyPayload } from "@/types/form.types";
import generatePremiumEmailTemplate from "@/lib/emails/premium-template";

const BREVO_API_KEY = process.env.BREVO_API_KEY;
// IMPORTANT: This email MUST be verified in your Brevo account
// Go to Brevo Dashboard > Senders & IP > Add a sender
const BREVO_SENDER_EMAIL =
  process.env.BREVO_SENDER_EMAIL ?? "noreply@insidekarachi.com";
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME ?? "Inside Karachi";
const BREVO_BASE_URL = "https://api.brevo.com/v3/smtp/email";

async function sendReplyEmail(params: {
  to: string;
  toName?: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  if (!BREVO_API_KEY) {
    const error = "BREVO_API_KEY not configured - email not sent";
    console.warn(error);
    return { success: false, error };
  }

  try {
    const response = await fetch(BREVO_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          email: BREVO_SENDER_EMAIL,
          name: BREVO_SENDER_NAME,
        },
        to: [
          {
            email: params.to,
            name: params.toName || params.to,
          },
        ],
        subject: params.subject,
        htmlContent: params.html,
        textContent: params.text,
        tags: ["form-reply", "inside-karachi"],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage =
        errorData?.message || errorData?.code || (await response.text());
      console.error("Brevo API error:", {
        status: response.status,
        error: errorMessage,
        sender: BREVO_SENDER_EMAIL,
      });
      return {
        success: false,
        error: `Brevo error (${response.status}): ${errorMessage}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      messageId: result?.messageId,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Email send error:", error);
    return { success: false, error: errorMessage };
  }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await props.params;
    const submissionId = parseInt(id);

    if (isNaN(submissionId)) {
      return NextResponse.json(
        { error: "Invalid submission ID" },
        { status: 400 },
      );
    }

    const { user } = await requireStaff(request);

    // Parse request body
    const body: SendReplyPayload = await request.json();
    const { replyText, emailSubject, newStatus, previousStatus } = body;

    if (!replyText?.trim() || !emailSubject?.trim()) {
      return NextResponse.json(
        { error: "Reply text and subject are required" },
        { status: 400 },
      );
    }

    // Get submission details
    const { rows: submissionRows } = await query(
      `SELECT * FROM form_submissions WHERE id = $1`,
      [submissionId],
    );
    const submission = submissionRows[0];

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
    }

    // Send email FIRST before saving reply
    // This way if email fails, we don't save a "sent" record

    // Generate HTML email
    const premiumHtml = generatePremiumEmailTemplate({
      recipientName: submission.name || submission.company_name || "there",
      subject: emailSubject.trim(),
      messageBody: replyText.trim(),
      formType: submission.form_type || "contact",
      submissionDate: submission.submitted_at
        ? new Date(submission.submitted_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : undefined,
    });

    const emailResult = await sendReplyEmail({
      to: submission.email,
      toName: submission.name || submission.company_name || undefined,
      subject: emailSubject.trim(),
      text: replyText.trim(),
      html: premiumHtml,
    });

    // Determine reply type and metadata based on email result
    const replyType = emailResult.success ? "email_sent" : "email_failed";
    const metadata: Record<string, unknown> = {
      attempted_at: new Date().toISOString(),
      email_success: emailResult.success,
      sender_email: BREVO_SENDER_EMAIL,
    };

    if (emailResult.success) {
      metadata.sent_at = new Date().toISOString();
      if (emailResult.messageId) {
        metadata.brevo_message_id = emailResult.messageId;
      }
    } else {
      metadata.error = emailResult.error;
      metadata.error_at = new Date().toISOString();
    }

    // Insert reply record with accurate status
    let reply;
    try {
      const { rows } = await query(
        `INSERT INTO form_submission_replies (
           submission_id, replied_by, reply_type, reply_text, email_subject,
           previous_status, new_status, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          submissionId,
          session.userId,
          replyType,
          replyText.trim(),
          emailSubject.trim(),
          previousStatus || submission.status,
          newStatus || submission.status,
          JSON.stringify(metadata),
        ],
      );
      reply = rows[0];
    } catch (replyError) {
      console.error("Error inserting reply:", replyError);
      return NextResponse.json(
        { error: "Failed to save reply" },
        { status: 500 },
      );
    }

    // Update submission status if changed
    // CRITICAL: Always update status when newStatus is provided, regardless of current status
    if (newStatus) {
      console.log(
        `Updating status from "${submission.status}" to "${newStatus}" for submission ${submissionId}`,
      );

      try {
        await query(
          `UPDATE form_submissions SET status = $1 WHERE id = $2`,
          [newStatus, submissionId],
        );
      } catch (updateError) {
        console.error("Error updating status:", updateError);
        return NextResponse.json(
          { error: "Failed to update submission status" },
          { status: 500 },
        );
      }

      console.log(`Status successfully updated to "${newStatus}"`);
    }

    // Fetch the reply with staff details
    let latestReply = reply;
    try {
      const { rows: replyWithStaff } = await query(
        `SELECT * FROM get_submission_replies_with_details(
           p_submission_id => $1::integer,
           p_include_deleted => $2::boolean
         )`,
        [submissionId, false],
      );
      latestReply =
        replyWithStaff.find((r) => r.id === reply.id) ?? reply;
    } catch (detailsError) {
      console.error("Failed to fetch reply with staff details:", detailsError);
    }

    return NextResponse.json({
      success: true,
      emailSent: emailResult.success,
      emailError: emailResult.error || null,
      reply: latestReply,
    });
  } catch (error) {
    const authStatus = getAdminAuthErrorStatus(error);
    if (authStatus) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: authStatus },
      );
    }
    console.error("Send reply API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
