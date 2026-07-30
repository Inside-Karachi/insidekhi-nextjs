import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireStaff, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import type { Json } from "@/types/database";

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL =
  process.env.BREVO_SENDER_EMAIL ?? "support@insidekarachi.com";
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
    const error = "BREVO_API_KEY not configured";
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
        tags: ["form-reply-retry", "inside-karachi"],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage =
        errorData?.message || errorData?.code || (await response.text());
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
    return { success: false, error: errorMessage };
  }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ replyId: string }> }
) {
  const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { replyId } = await props.params;

    const { user } = await requireStaff(request);

    // Call RPC to update retry counter
    try {
      await query(
        `SELECT retry_failed_reply_email(
           p_reply_id => $1::uuid,
           p_retried_by => $2::uuid
         )`,
        [replyId, session.userId],
      );
    } catch (rpcError) {
      console.error("RPC error:", rpcError);
      return NextResponse.json(
        {
          error:
            rpcError instanceof Error
              ? rpcError.message
              : "Failed to mark for retry",
        },
        { status: 500 }
      );
    }

    // Get the reply details to resend email
    const { rows: replyRows } = await query(
      `SELECT r.*, s.email AS submission_email, s.name AS submission_name,
              s.company_name AS submission_company_name
       FROM form_submission_replies r
       JOIN form_submissions s ON s.id = r.submission_id
       WHERE r.id = $1`,
      [replyId],
    );
    const reply = replyRows[0];

    if (!reply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 });
    }

    if (!reply.reply_text) {
      return NextResponse.json(
        { error: "Invalid reply data" },
        { status: 400 }
      );
    }

    // Attempt to resend email
    const emailResult = await sendReplyEmail({
      to: reply.submission_email,
      toName: reply.submission_name || reply.submission_company_name || undefined,
      subject: reply.email_subject || "Reply from Inside Karachi",
      text: reply.reply_text,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ff184d;">Inside Karachi</h2>
          <div style="margin: 20px 0;">
            ${reply.reply_text.replace(/\n/g, "<br>")}
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            This is an automated message from Inside Karachi. Please do not reply directly to this email.
          </p>
        </div>
      `,
    });

    // Update reply with new status
    if (emailResult.success) {
      const updatedMetadata: Json = {
        ...(reply.metadata as object),
        retry_successful: true,
        retry_succeeded_at: new Date().toISOString(),
        brevo_message_id: emailResult.messageId,
      } as Json;

      try {
        await query(
          `UPDATE form_submission_replies SET reply_type = $1, metadata = $2 WHERE id = $3`,
          ["email_sent", JSON.stringify(updatedMetadata), replyId],
        );
      } catch (updateError) {
        console.error("Failed to update reply status:", updateError);
      }

      return NextResponse.json({
        success: true,
        emailSent: true,
        message: "Email sent successfully on retry",
      });
    } else {
      const updatedMetadata: Json = {
        ...(reply.metadata as object),
        last_retry_error: emailResult.error,
        last_retry_failed_at: new Date().toISOString(),
      } as Json;

      try {
        await query(
          `UPDATE form_submission_replies SET metadata = $1 WHERE id = $2`,
          [JSON.stringify(updatedMetadata), replyId],
        );
      } catch (updateError) {
        console.error("Failed to update retry metadata:", updateError);
      }

      return NextResponse.json({
        success: false,
        emailSent: false,
        error: emailResult.error,
        message: "Retry attempt failed",
      });
    }
  } catch (error) {
    const authStatus = getAdminAuthErrorStatus(error);
    if (authStatus) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: authStatus }
      );
    }
    console.error("Retry reply API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
