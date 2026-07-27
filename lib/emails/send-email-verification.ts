/**
 * Email Verification Sending Service
 * Handles sending email verification emails via Brevo API
 */

import {
  generateEmailVerificationTemplate,
  generateEmailVerificationPlainText,
} from "./email-verification-template";

interface SendEmailVerificationParams {
  email: string;
  fullName?: string;
  verificationLink: string;
  expiryHours?: number;
}

interface SendEmailVerificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const BREVO_BASE_URL = "https://api.brevo.com/v3/smtp/email";

export async function sendEmailVerification(
  params: SendEmailVerificationParams
): Promise<SendEmailVerificationResult> {
  try {
    // Get configuration at runtime to support .env file loading in scripts
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const BREVO_SENDER_EMAIL =
      process.env.BREVO_SENDER_EMAIL ?? "notifications@insidekarachi.com";
    const BREVO_SENDER_NAME =
      process.env.BREVO_SENDER_NAME ?? "Inside Karachi";

    // Validate configuration
    if (!BREVO_API_KEY) {
      console.error("BREVO_API_KEY is not configured");
      return {
        success: false,
        error: "Email service is not configured",
      };
    }

    // Validate required fields
    if (!params.email) {
      return {
        success: false,
        error: "Recipient email is required",
      };
    }

    if (!params.verificationLink) {
      return {
        success: false,
        error: "Verification link is required",
      };
    }

    // Extract recipient name from email or use provided fullName
    const recipientName = params.fullName || params.email.split("@")[0];

    // Generate email content
    const htmlContent = generateEmailVerificationTemplate({
      recipientName,
      verificationLink: params.verificationLink,
      expiryHours: params.expiryHours,
    });

    const textContent = generateEmailVerificationPlainText({
      recipientName,
      verificationLink: params.verificationLink,
      expiryHours: params.expiryHours,
    });

    // Send email via Brevo
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
            email: params.email,
            name: recipientName,
          },
        ],
        subject: "Verify Your Inside Karachi Email",
        htmlContent,
        textContent,
        headers: {
          "X-IK-Email-Type": "email-verification",
          "X-IK-Recipient-Email": params.email,
        },
        tags: ["email-verification", "onboarding", "authentication"],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      console.error("Brevo API error:", {
        status: response.status,
        error: errorBody,
      });

      return {
        success: false,
        error: `Failed to send email: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.messageId,
    };
  } catch (error) {
    console.error("Email verification sending error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
