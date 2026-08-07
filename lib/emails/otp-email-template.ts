/**
 * Signup OTP Email Template
 * Matches the Inside Karachi brand: Dark theme with gradient accents
 */

interface OtpEmailParams {
  recipientName: string;
  code: string;
  expiryMinutes?: number;
}

export function generateOtpEmailTemplate({
  recipientName,
  code,
  expiryMinutes = 10,
}: OtpEmailParams): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
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
            <td align="center" style="padding: 40px 20px; background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%);">
              <h1 style="margin:0; font-size:28px; font-weight:800; color:#ffffff; letter-spacing:-0.5px;">
                Verify Your Email
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px 35px; font-size:16px; line-height:1.7; color:#e5e5e5;">
              <p style="margin:0 0 18px;">Hi ${recipientName} 👋,</p>

              <p style="margin:0 0 22px;">Thank you for creating your Inside Karachi account! Enter the code below to verify your email and complete your signup.</p>

              <!-- Code Box -->
              <div style="text-align:center; margin:30px 0;">
                <p style="display:inline-block; margin:0; padding:20px 36px; background:#111; border:1px solid #2a2a2a; border-radius:12px; font-size:36px; font-weight:800; letter-spacing:10px; color:#10b981;">
                  ${code}
                </p>
              </div>

              <!-- Expiry Notice -->
              <p style="margin:20px 0; font-size:13px; color:#9ca3af; text-align:center;">
                <strong>Note:</strong> This code will expire in ${expiryMinutes} minutes.
              </p>

              <!-- Signature -->
              <div style="margin:40px 0 0; padding-top:24px; border-top:1px solid #2a2a2a;">
                <p style="margin:0 0 8px; font-size:16px; font-weight:600; color:#fff;">Welcome to Inside Karachi!,</p>
                <p style="margin:0 0 4px; font-size:16px; font-weight:600; background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                  The Inside Karachi Team
                </p>
                <p style="margin:0; font-size:14px; color:#9ca3af;">
                  Your Guide to Karachi's Best
                </p>
              </div>

              <p style="margin:30px 0 0; font-size:13px; color:#666; text-align:center; line-height:1.6;">
                If you didn't create this account, please <a href="https://insidekarachi.com/support" style="color:#10b981; text-decoration:none;">contact our support team</a> immediately.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px; background:#111; font-size:13px; color:#777; line-height:1.6;">
              <p style="margin:0 0 8px;">
                © ${new Date().getFullYear()} <a href="https://insidekarachi.com" style="color:#10b981; text-decoration:none; font-weight:600;">Inside Karachi</a> — All rights reserved.
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

export function generateOtpPlainText({
  recipientName,
  code,
  expiryMinutes = 10,
}: OtpEmailParams): string {
  return `Hi ${recipientName},

Thank you for creating your Inside Karachi account! Enter the code below to verify your email and complete your signup.

VERIFICATION CODE: ${code}

This code will expire in ${expiryMinutes} minutes.

If you didn't create this account, please contact our support team immediately at https://insidekarachi.com/support

Welcome to Inside Karachi!
The Inside Karachi Team
Your Guide to Karachi's Best

© ${new Date().getFullYear()} Inside Karachi — All rights reserved.
Privacy Policy: https://insidekarachi.com/privacy-policy`;
}
