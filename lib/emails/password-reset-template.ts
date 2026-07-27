/**
 * Password Reset Email Template
 * Matches the Inside Karachi brand: Dark theme with gradient accents
 */

interface PasswordResetEmailParams {
  recipientName: string;
  resetLink: string;
  expiryHours?: number;
}

export function generatePasswordResetEmailTemplate({
  recipientName,
  resetLink,
  expiryHours = 24,
}: PasswordResetEmailParams): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
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
                Reset Your Password
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px 35px; font-size:16px; line-height:1.7; color:#e5e5e5;">
              <p style="margin:0 0 18px;">Hi ${recipientName} 👋,</p>
              
              <p style="margin:0 0 22px;">We received a request to reset your password for your Inside Karachi account. If you didn't make this request, you can safely ignore this email.</p>

              <!-- Security Info Box -->
              <div style="background:#111; border-left:4px solid #fbbf24; padding:24px 28px; border-radius:12px; margin:30px 0;">
                <p style="margin:0 0 12px; font-weight:600; color:#fbbf24;">⚠️ Security Notice</p>
                <p style="margin:0; font-size:14px; color:#d1d5db;">This link will expire in <strong>${expiryHours} hours</strong>. If you don't reset your password within that time, you'll need to request a new reset link.</p>
              </div>

              <!-- CTA Button -->
              <p style="text-align:center; margin: 40px 0;">
                <a href="${resetLink}" 
                   style="background: linear-gradient(135deg, #ff1a44 0%, #e11d48 50%, #be185d 100%); 
                          color:#ffffff; text-decoration:none; 
                          padding:16px 40px; border-radius:12px; 
                          font-size:16px; font-weight:700; 
                          display:inline-block; box-shadow:0 6px 18px rgba(255,26,68,0.45); letter-spacing:0.5px;">
                   Reset Password
                </a>
              </p>

              <!-- Alt Text Link -->
              <p style="margin:20px 0; font-size:13px; color:#9ca3af; word-break:break-all;">
                Or copy this link in your browser:<br />
                <a href="${resetLink}" style="color:#ff1a44; text-decoration:none;">${resetLink}</a>
              </p>

              <!-- Tips Section -->
              <div style="margin:30px 0; padding:24px 28px; background:#111; border-radius:12px; border:1px solid #2a2a2a;">
                <p style="margin:0 0 12px; font-weight:600; color:#f8fafc;">Tips for a secure password:</p>
                <ul style="margin:0; padding-left:20px; color:#9ca3af; font-size:14px;">
                  <li style="margin:8px 0;">Use at least 8 characters</li>
                  <li style="margin:8px 0;">Mix uppercase, lowercase, and numbers</li>
                  <li style="margin:8px 0;">Avoid using personal information</li>
                  <li style="margin:8px 0;">Don't use the same password as other accounts</li>
                </ul>
              </div>

              <!-- Signature -->
              <div style="margin:40px 0 0; padding-top:24px; border-top:1px solid #2a2a2a;">
                <p style="margin:0 0 8px; font-size:16px; font-weight:600; color:#fff;">Best regards,</p>
                <p style="margin:0 0 4px; font-size:16px; font-weight:600; background: linear-gradient(135deg, #ff1a44 0%, #e11d48 50%, #be185d 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                  Inside Karachi Security Team
                </p>
                <p style="margin:0; font-size:14px; color:#9ca3af;">
                  Your Guide to Karachi's Best
                </p>
              </div>

              <p style="margin:30px 0 0; font-size:13px; color:#666; text-align:center; line-height:1.6;">
                If you didn't request this password reset, please <a href="https://insidekarachi.com/support" style="color:#ff1a44; text-decoration:none;">contact our support team</a> immediately.
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

export function generatePasswordResetPlainText({
  recipientName,
  resetLink,
  expiryHours = 24,
}: PasswordResetEmailParams): string {
  return `Hi ${recipientName},

We received a request to reset your password for your Inside Karachi account. If you didn't make this request, you can safely ignore this email.

SECURITY NOTICE:
This link will expire in ${expiryHours} hours. If you don't reset your password within that time, you'll need to request a new reset link.

Reset your password here:
${resetLink}

TIPS FOR A SECURE PASSWORD:
- Use at least 8 characters
- Mix uppercase, lowercase, and numbers
- Avoid using personal information
- Don't use the same password as other accounts

If you didn't request this password reset, please contact our support team immediately at https://insidekarachi.com/support

Best regards,
Inside Karachi Security Team
Your Guide to Karachi's Best

© ${new Date().getFullYear()} Inside Karachi — All rights reserved.
Privacy Policy: https://insidekarachi.com/privacy-policy`;
}
