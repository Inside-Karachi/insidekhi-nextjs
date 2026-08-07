/**
 * Signup OTP Email Sending Service
 * Handles sending 6-digit verification codes via Brevo API
 */

import {
  generateOtpEmailTemplate,
  generateOtpPlainText,
} from "./otp-email-template";

interface SendOtpEmailParams {
  email: string;
  fullName?: string;
  code: string;
  expiryMinutes?: number;
}

interface SendOtpEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const BREVO_BASE_URL = "https://api.brevo.com/v3/smtp/email";

export async function sendOtpEmail(
  params: SendOtpEmailParams
): Promise<SendOtpEmailResult> {
  try {
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const BREVO_SENDER_EMAIL =
      process.env.BREVO_SENDER_EMAIL ?? "notifications@insidekarachi.com";
    const BREVO_SENDER_NAME =
      process.env.BREVO_SENDER_NAME ?? "Inside Karachi";

    if (!BREVO_API_KEY) {
      console.error("BREVO_API_KEY is not configured");
      return {
        success: false,
        error: "Email service is not configured",
      };
    }

    if (!params.email) {
      return {
        success: false,
        error: "Recipient email is required",
      };
    }

    if (!params.code) {
      return {
        success: false,
        error: "Verification code is required",
      };
    }

    const recipientName = params.fullName || params.email.split("@")[0];

    const htmlContent = generateOtpEmailTemplate({
      recipientName,
      code: params.code,
      expiryMinutes: params.expiryMinutes,
    });

    const textContent = generateOtpPlainText({
      recipientName,
      code: params.code,
      expiryMinutes: params.expiryMinutes,
    });

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
        subject: "Your Inside Karachi Verification Code",
        htmlContent,
        textContent,
        headers: {
          "X-IK-Email-Type": "signup-otp",
          "X-IK-Recipient-Email": params.email,
        },
        tags: ["signup-otp", "security", "authentication"],
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
    console.error("OTP email error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
