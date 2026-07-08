import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/types/supabase";

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
  request: Request,
  props: { params: Promise<{ replyId: string }> }
) {
  try {
    const { replyId } = await props.params;

    const supabase = await createServerSupabase();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service role for admin operations
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Verify admin role
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      !profile ||
      !["admin", "super_admin", "lister"].includes(profile.role)
    ) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Call RPC to update retry counter (function will be created in migration)
    const { error: rpcError } = await adminSupabase.rpc(
      "retry_failed_reply_email" as unknown as never,
      {
        p_reply_id: replyId,
        p_retried_by: user.id,
      } as never
    );

    if (rpcError) {
      console.error("RPC error:", rpcError);
      return NextResponse.json(
        { error: rpcError.message || "Failed to mark for retry" },
        { status: 500 }
      );
    }

    // Get the reply details to resend email
    const { data: reply, error: replyError } = await adminSupabase
      .from("form_submission_replies")
      .select("*, form_submissions(*)")
      .eq("id", replyId)
      .single();

    if (replyError || !reply || !reply.form_submissions) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 });
    }

    const submission = Array.isArray(reply.form_submissions)
      ? reply.form_submissions[0]
      : reply.form_submissions;

    if (!submission || !reply.reply_text) {
      return NextResponse.json(
        { error: "Invalid reply data" },
        { status: 400 }
      );
    }

    // Attempt to resend email
    const emailResult = await sendReplyEmail({
      to: submission.email,
      toName: submission.name || submission.company_name || undefined,
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
      // Update to email_sent
      const { error: updateError } = await adminSupabase
        .from("form_submission_replies")
        .update({
          reply_type: "email_sent",
          metadata: {
            ...(reply.metadata as object),
            retry_successful: true,
            retry_succeeded_at: new Date().toISOString(),
            brevo_message_id: emailResult.messageId,
          } as Json,
        })
        .eq("id", replyId);

      if (updateError) {
        console.error("Failed to update reply status:", updateError);
      }

      return NextResponse.json({
        success: true,
        emailSent: true,
        message: "Email sent successfully on retry",
      });
    } else {
      // Still failed, update metadata
      const { error: updateError } = await adminSupabase
        .from("form_submission_replies")
        .update({
          metadata: {
            ...(reply.metadata as object),
            last_retry_error: emailResult.error,
            last_retry_failed_at: new Date().toISOString(),
          } as Json,
        })
        .eq("id", replyId);

      if (updateError) {
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
    console.error("Retry reply API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
