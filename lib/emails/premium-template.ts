/**
 * HTML email template for form replies
 * Matches the Inside Karachi brand: Dark theme with gradient accents
 */

interface EmailTemplateParams {
  recipientName: string;
  subject: string;
  messageBody: string;
  formType?: string; // "contact", "membership", "get-listed", etc.
  submissionDate?: string;
}

export function generatePremiumEmailTemplate({
  recipientName,
  subject,
  messageBody,
  formType = "contact",
  submissionDate,
}: EmailTemplateParams): string {
  // Format message body with proper line breaks
  const formattedMessage = messageBody
    .split("\n")
    .map((line) => `<p style="margin:0 0 16px; line-height:1.7;">${line}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#0f0f0f; font-family: 'Helvetica Neue', Arial, sans-serif; color:#e5e5e5;">

  <!-- Wrapper -->
  <table align="center" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0f0f0f" style="padding: 40px 20px;">
    <tr>
      <td align="center">

        <!-- Container -->
        <table width="600" cellpadding="0" cellspacing="0" bgcolor="#1a1a1a" style="border-radius:20px; overflow:hidden; box-shadow:0 8px 28px rgba(0,0,0,0.55); border:1px solid #2a2a2a;">
          
          <!-- Logo -->
          <tr>
            <td align="center" style="padding: 40px 20px 20px;">
              <img src="https://insidekarachi.com/logo-white.png" 
                   alt="Inside Karachi" width="160" style="display:block; margin:0 auto; max-width:160px;">
            </td>
          </tr>

          <!-- Hero Gradient Header -->
          <tr>
            <td align="center" style="padding: 40px 20px; background: linear-gradient(135deg, #ff1a44 0%, #e11d48 50%, #be185d 100%);">
              <h1 style="margin:0; font-size:28px; font-weight:800; color:#ffffff; letter-spacing:-0.5px;">
                ${subject}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px 35px; font-size:16px; line-height:1.7; color:#e5e5e5;">
              <p style="margin:0 0 18px;">Hi ${recipientName} 👋,</p>
              
              <p style="margin:0 0 22px;">Thank you for reaching out to Inside Karachi! We've received your ${formatFormType(
                formType,
              )} and wanted to get back to you.</p>

              <!-- Message Content Box -->
              <div style="background:#111; border-left:4px solid #ff1a44; padding:24px 28px; border-radius:12px; margin:30px 0;">
                ${formattedMessage}
              </div>

              ${
                submissionDate
                  ? `<p style="margin:24px 0 0; font-size:14px; color:#9ca3af;">
                <strong>Reference:</strong> Submitted on ${submissionDate}
              </p>`
                  : ""
              }

              <!-- Signature -->
              <div style="margin:40px 0 0; padding-top:24px; border-top:1px solid #2a2a2a;">
                <p style="margin:0 0 8px; font-size:16px; font-weight:600; color:#fff;">Best regards,</p>
                <p style="margin:0 0 4px; font-size:16px; font-weight:600; background: linear-gradient(135deg, #ff1a44 0%, #e11d48 50%, #be185d 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                  Inside Karachi Team
                </p>
                <p style="margin:0; font-size:14px; color:#9ca3af;">
                  Your Guide to Karachi's Best
                </p>
              </div>

              <!-- CTA Button (Optional) -->
              <p style="text-align:center; margin: 40px 0 0;">
                <a href="https://insidekarachi.com" 
                   style="background: linear-gradient(135deg, #ff1a44 0%, #e11d48 50%, #be185d 100%); 
                          color:#ffffff; text-decoration:none; 
                          padding:14px 36px; border-radius:12px; 
                          font-size:15px; font-weight:700; 
                          display:inline-block; box-shadow:0 6px 18px rgba(255,26,68,0.45); letter-spacing:0.5px;">
                   Visit Inside Karachi
                </a>
              </p>

              <p style="margin:30px 0 0; font-size:13px; color:#777; text-align:center; line-height:1.6;">
                This is an automated response to your inquiry. If you have any questions, simply reply to this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px; background:#111; font-size:13px; color:#777; line-height:1.6;">
              <p style="margin:0 0 8px;">
                © ${new Date().getFullYear()} <a href="https://insidekarachi.com" style="color:#ff1a44; text-decoration:none; font-weight:600;">Inside Karachi</a> — All rights reserved.
              </p>
              <p style="margin:0; font-size:12px; color:#666;">
                Pakistan's Premier City Guide | <a href="https://insidekarachi.com/privacy-policy" style="color:#999; text-decoration:none;">Privacy Policy</a>
              </p>
            </td>
          </tr>
        </table>
        <!-- End Container -->

      </td>
    </tr>
  </table>
  <!-- End Wrapper -->

</body>
</html>`;
}

function formatFormType(formType: string): string {
  const typeMap: Record<string, string> = {
    contact: "contact form submission",
    membership: "membership inquiry",
    "get-listed": "business listing request",
    general: "message",
  };

  return typeMap[formType] || "inquiry";
}

// Export for use in email service
export default generatePremiumEmailTemplate;
