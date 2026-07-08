/**
 * Invitation email template
 * Matches Inside Karachi brand: Dark theme with gradient accents
 */

interface InvitationEmailParams {
  inviteeName: string;
  inviterName: string;
  inviterEmail: string;
  inviteCode: string;
  inviteUrl: string;
  expiresAt: string;
}

export function generateInvitationEmailTemplate({
  inviteeName,
  inviterName,
  inviterEmail,
  inviteCode,
  inviteUrl,
  expiresAt,
}: InvitationEmailParams): string {
  // Format expiry date
  const expiryDate = new Date(expiresAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to Inside Karachi!</title>
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
                   alt="Inside Karachi" width="180" style="display:block; margin:0 auto; max-width:180px;">
            </td>
          </tr>

          <!-- Hero Gradient Header with Icon -->
          <tr>
            <td align="center" style="padding: 50px 20px; background: linear-gradient(135deg, #ff1a44 0%, #e11d48 50%, #be185d 100%);">
              <div style="font-size:48px; margin-bottom:16px;">🎉</div>
              <h1 style="margin:0; font-size:32px; font-weight:800; color:#ffffff; letter-spacing:-0.5px;">
                You're Invited!
              </h1>
              <p style="margin:12px 0 0; font-size:16px; color:rgba(255,255,255,0.9); font-weight:500;">
                Join Pakistan's Premier City Guide
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 45px 40px; font-size:16px; line-height:1.7; color:#e5e5e5;">
              <p style="margin:0 0 24px; font-size:18px; line-height:1.6;">
                Hi <span style="font-weight:600; color:#fff;">${inviteeName}</span> 👋,
              </p>
              
              <p style="margin:0 0 24px; line-height:1.7;">
                <strong style="color:#fff;">${inviterName}</strong> 
                <span style="color:#9ca3af;">(${inviterEmail})</span> has invited you to join 
                <strong style="background: linear-gradient(135deg, #ff1a44 0%, #e11d48 50%, #be185d 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Inside Karachi</strong> 
                — your ultimate guide to discovering the best of Karachi!
              </p>

              <!-- Benefits Box -->
              <div style="background:#111; border:1px solid #2a2a2a; padding:28px; border-radius:16px; margin:32px 0;">
                <h3 style="margin:0 0 20px; font-size:18px; font-weight:700; color:#fff;">
                  ✨ What You'll Get:
                </h3>
                <ul style="margin:0; padding:0; list-style:none;">
                  <li style="padding:10px 0; border-bottom:1px solid #2a2a2a;">
                    <span style="color:#ff1a44; font-weight:700; margin-right:8px;">🎁</span>
                    <strong style="color:#fff;">25 XP Bonus</strong> for you and ${inviterName}
                  </li>
                  <li style="padding:10px 0; border-bottom:1px solid #2a2a2a;">
                    <span style="color:#ff1a44; font-weight:700; margin-right:8px;">🏆</span>
                    <strong style="color:#fff;">Exclusive Access</strong> to curated listings & events
                  </li>
                  <li style="padding:10px 0;">
                    <span style="color:#ff1a44; font-weight:700; margin-right:8px;">💎</span>
                    <strong style="color:#fff;">Discover Hidden Gems</strong> — authentic reviews & guides
                  </li>
                </ul>
              </div>

              <!-- Invitation Code Box -->
              <div style="background: linear-gradient(135deg, rgba(255,26,68,0.1) 0%, rgba(190,24,93,0.1) 100%); border:2px dashed #ff1a44; padding:24px; border-radius:16px; margin:32px 0; text-align:center;">
                <p style="margin:0 0 8px; font-size:13px; text-transform:uppercase; letter-spacing:1.5px; color:#9ca3af; font-weight:600;">
                  Your Invitation Code
                </p>
                <div style="font-size:32px; font-weight:800; letter-spacing:4px; color:#fff; font-family:monospace; margin:8px 0;">
                  ${inviteCode}
                </div>
                <p style="margin:8px 0 0; font-size:13px; color:#9ca3af;">
                  Use this code during signup
                </p>
              </div>

              <!-- CTA Button -->
              <p style="text-align:center; margin: 40px 0;">
                <a href="${inviteUrl}" 
                   style="background: linear-gradient(135deg, #ff1a44 0%, #e11d48 50%, #be185d 100%); 
                          color:#ffffff; text-decoration:none; 
                          padding:16px 48px; border-radius:14px; 
                          font-size:17px; font-weight:700; 
                          display:inline-block; box-shadow:0 6px 20px rgba(255,26,68,0.5); 
                          letter-spacing:0.5px; text-transform:uppercase;">
                   Accept Invitation →
                </a>
              </p>

              <!-- Expiry Notice -->
              <div style="background:#1a1a1a; border-left:3px solid #fbbf24; padding:16px 20px; border-radius:10px; margin:32px 0;">
                <p style="margin:0; font-size:14px; color:#fbbf24; display:flex; align-items:center;">
                  <span style="font-size:20px; margin-right:8px;">⏰</span>
                  <strong>Expires on ${expiryDate}</strong>
                </p>
                <p style="margin:8px 0 0; font-size:13px; color:#9ca3af;">
                  This invitation is valid for 30 days. Don't miss out!
                </p>
              </div>

              <!-- Signature -->
              <div style="margin:50px 0 0; padding-top:28px; border-top:1px solid #2a2a2a;">
                <p style="margin:0 0 8px; font-size:16px; font-weight:600; color:#fff;">
                  Welcome to the community! 🚀
                </p>
                <p style="margin:0 0 4px; font-size:16px; font-weight:600; background: linear-gradient(135deg, #ff1a44 0%, #e11d48 50%, #be185d 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                  Inside Karachi Team
                </p>
                <p style="margin:0; font-size:14px; color:#9ca3af;">
                  Your Guide to Karachi's Best
                </p>
              </div>

              <p style="margin:32px 0 0; font-size:13px; color:#666; text-align:center; line-height:1.6;">
                This invitation was sent by ${inviterName}. If you don't know this person, 
                you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 28px; background:#111; font-size:13px; color:#777; line-height:1.6;">
              <p style="margin:0 0 8px;">
                © ${new Date().getFullYear()} <a href="https://insidekarachi.com" style="color:#ff1a44; text-decoration:none; font-weight:600;">Inside Karachi</a> — All rights reserved.
              </p>
              <p style="margin:0; font-size:12px; color:#666;">
                Pakistan's Premier City Guide | 
                <a href="https://insidekarachi.com/privacy-policy" style="color:#999; text-decoration:none;">Privacy Policy</a> | 
                <a href="https://insidekarachi.com/terms-and-conditions" style="color:#999; text-decoration:none;">Terms</a>
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

// Plain text version for email clients that don't support HTML
export function generateInvitationEmailText({
  inviteeName,
  inviterName,
  inviterEmail,
  inviteCode,
  inviteUrl,
  expiresAt,
}: InvitationEmailParams): string {
  const expiryDate = new Date(expiresAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return `You're Invited to Inside Karachi!

Hi ${inviteeName},

${inviterName} (${inviterEmail}) has invited you to join Inside Karachi — your ultimate guide to discovering the best of Karachi!

What You'll Get:
• 25 XP Bonus for you and ${inviterName}
• Exclusive Access to curated listings & events
• Discover Hidden Gems — authentic reviews & guides

Your Invitation Code: ${inviteCode}
Use this code during signup.

Accept your invitation here:
${inviteUrl}

⏰ This invitation expires on ${expiryDate}

Welcome to the community!

— Inside Karachi Team
Your Guide to Karachi's Best

---
This invitation was sent by ${inviterName}. If you don't know this person, you can safely ignore this email.

© ${new Date().getFullYear()} Inside Karachi — All rights reserved.
Pakistan's Premier City Guide
`;
}

export default generateInvitationEmailTemplate;
