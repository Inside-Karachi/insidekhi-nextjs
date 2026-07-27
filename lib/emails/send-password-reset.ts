/**
 * Password Reset Email Sending Service
 * Handles sending password reset emails via Brevo API
 */

import {
  generatePasswordResetEmailTemplate,
  generatePasswordResetPlainText,
} from "./password-reset-template";

interface SendPasswordResetEmailParams {
  email: string;
  fullName?: string;
  resetLink: string;
  expiryHours?: number;
}

interface SendPasswordResetEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const BREVO_BASE_URL = "https://api.brevo.com/v3/smtp/email";

export async function sendPasswordResetEmail(
  params: SendPasswordResetEmailParams
): Promise<SendPasswordResetEmailResult> {
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

    if (!params.resetLink) {
      return {
        success: false,
        error: "Reset link is required",
      };
    }

    // Extract recipient name from email or use provided fullName
    const recipientName = params.fullName || params.email.split("@")[0];

    // Generate email content
    const htmlContent = generatePasswordResetEmailTemplate({
      recipientName,
      resetLink: params.resetLink,
      expiryHours: params.expiryHours,
    });

    const textContent = generatePasswordResetPlainText({
      recipientName,
      resetLink: params.resetLink,
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
        subject: "Reset Your Inside Karachi Password",
        htmlContent,
        textContent,
        headers: {
          "X-IK-Email-Type": "password-reset",
          "X-IK-Recipient-Email": params.email,
        },
        tags: ["password-reset", "security", "authentication"],
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
    console.error("Password reset email error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
