import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { SendReplyPayload } from "@/types/form.types";
import generatePremiumEmailTemplate from "@/lib/emails/premium-template";
import type { Json } from "@/types/supabase";

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
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params;
    const submissionId = parseInt(id);

    if (isNaN(submissionId)) {
      return NextResponse.json(
        { error: "Invalid submission ID" },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabase();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service role to bypass RLS for admin operations
    const adminSupabase = await createServerSupabase({ useServiceRole: true });

    // Verify admin/staff role
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    if (
      !profile ||
      !["admin", "super_admin", "lister", "writer"].includes(profile.role)
    ) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

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
    const { data: submission, error: submissionError } = await adminSupabase
      .from("form_submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (submissionError || !submission) {
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
    const { data: reply, error: replyError } = await adminSupabase
      .from("form_submission_replies")
      .insert({
        submission_id: submissionId,
        replied_by: user.id,
        reply_type: replyType,
        reply_text: replyText.trim(),
        email_subject: emailSubject.trim(),
        previous_status: previousStatus || submission.status,
        new_status: newStatus || submission.status,
        metadata: metadata as Json,
      })
      .select()
      .single();

    if (replyError) {
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

      const { error: updateError } = await adminSupabase
        .from("form_submissions")
        .update({ status: newStatus })
        .eq("id", submissionId);

      if (updateError) {
        console.error("Error updating status:", updateError);
        return NextResponse.json(
          { error: "Failed to update submission status" },
          { status: 500 },
        );
      }

      console.log(`Status successfully updated to "${newStatus}"`);
    }

    // Fetch the reply with staff details
    const { data: replyWithStaff } = await adminSupabase.rpc(
      "get_submission_replies_with_details",
      {
        p_submission_id: submissionId,
        p_include_deleted: false,
      },
    );

    const latestReply = replyWithStaff?.find((r) => r.id === reply.id);

    return NextResponse.json({
      success: true,
      emailSent: emailResult.success,
      emailError: emailResult.error || null,
      reply: latestReply || reply,
    });
  } catch (error) {
    console.error("Send reply API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
