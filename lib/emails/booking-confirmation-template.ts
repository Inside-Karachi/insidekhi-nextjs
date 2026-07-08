/**
 * Booking confirmation email template
 * Sent when payment is confirmed and tickets are issued
 */

interface BookingConfirmationParams {
  customerName: string;
  bookingReference: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  eventVenue: string;
  ticketCount: number;
  totalAmount: number;
  passes: Array<{
    code: string;
    guestName: string | null;
    ticketTypeName: string;
    cnicLast4?: string | null;
  }>;
  viewTicketsUrl: string;
}

export function generateBookingConfirmationEmail({
  customerName,
  bookingReference,
  eventName,
  eventDate,
  eventTime,
  eventVenue,
  ticketCount,
  totalAmount,
  passes,
  viewTicketsUrl,
}: BookingConfirmationParams): string {
  const ticketPassesHtml = passes
    .map((pass, index) => {
      // Format guest info: Name + NIC last 4 if available
      let guestInfo = pass.guestName || "Guest";
      if (pass.cnicLast4) {
        guestInfo += ` (NIC: ****${pass.cnicLast4})`;
      }

      return `
      <tr style="border-bottom: 1px solid #2a2a2a;">
        <td style="padding: 16px 12px; font-size: 14px; color: #fff;">
          <strong>Ticket ${index + 1}</strong><br/>
          <span style="font-size: 12px; color: #9ca3af;">${
            pass.ticketTypeName
          }</span>
        </td>
        <td style="padding: 16px 12px; font-size: 13px; color: #e5e5e5;">
          ${guestInfo}
        </td>
        <td style="padding: 16px 12px; font-family: monospace; font-size: 12px; color: #fff;">
          ${pass.code}
        </td>
      </tr>
    `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmed - Inside Karachi</title>
</head>
<body style="margin:0; padding:0; background-color:#0f0f0f; font-family:'Helvetica Neue', Arial, sans-serif; color:#e5e5e5;">

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

          <!-- Success Header with Gradient -->
          <tr>
            <td align="center" style="padding: 40px 32px; background: linear-gradient(135deg, #ff1a44 0%, #e11d48 50%, #be185d 100%);">
              <div style="font-size: 48px; margin-bottom: 12px;">🎉</div>
              <h1 style="margin:0; font-size:28px; font-weight:800; color:#ffffff; letter-spacing:-0.5px;">
                Booking Confirmed!
              </h1>
              <p style="margin: 8px 0 0; font-size: 15px; color: rgba(255,255,255,0.9);">
                Your tickets are ready
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 40px 32px; font-size:16px; line-height:1.7; color:#e5e5e5;">
              
              <p style="margin:0 0 24px;">Hi ${customerName} 👋,</p>
              
              <p style="margin:0 0 24px;">Great news! Your payment has been confirmed and your tickets for <strong style="color:#f8fafc;">${eventName}</strong> are now ready.</p>

              <!-- Event Details Card -->
              <div style="background: #111; border-left: 4px solid #ff1a44; border-radius: 12px; padding: 24px 28px; margin: 32px 0;">
                <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 700; color: #fff;">Event Details</h2>
                
                <table width="100%" cellpadding="8" cellspacing="0">
                  <tr>
                    <td style="font-size: 14px; color: #94a3b8; width: 100px;">Event</td>
                    <td style="font-size: 14px; color: #f8fafc; font-weight: 600;">${eventName}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 14px; color: #94a3b8;">Date</td>
                    <td style="font-size: 14px; color: #f8fafc;">${eventDate}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 14px; color: #94a3b8;">Time</td>
                    <td style="font-size: 14px; color: #f8fafc;">${eventTime}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 14px; color: #94a3b8;">Venue</td>
                    <td style="font-size: 14px; color: #f8fafc;">${eventVenue}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 14px; color: #94a3b8;">Booking Ref</td>
                    <td style="font-family: monospace; font-size: 13px; color: #f8fafc; font-weight: 600;">${bookingReference}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 14px; color: #94a3b8;">Total Paid</td>
                    <td style="font-size: 16px; color: #10b981; font-weight: 700;">Rs. ${totalAmount.toLocaleString()}</td>
                  </tr>
                </table>
              </div>

              <!-- Ticket Passes Table -->
              <div style="background: #111; border-left: 4px solid #ff1a44; border-radius: 12px; padding: 24px 28px; margin: 32px 0;">
                <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 700; color: #fff;">Your Tickets (${ticketCount})</h2>
                
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                  <thead>
                    <tr style="border-bottom: 2px solid rgba(148,163,184,0.2);">
                      <th style="padding: 12px 12px; text-align: left; font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Ticket</th>
                      <th style="padding: 12px 12px; text-align: left; font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Guest</th>
                      <th style="padding: 12px 12px; text-align: left; font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${ticketPassesHtml}
                  </tbody>
                </table>
                
                <p style="margin: 20px 0 0; font-size: 13px; color: #94a3b8; line-height: 1.6;">
                  💡 <strong>Tip:</strong> Show your QR codes at the venue entrance. You can access them anytime from your dashboard.
                </p>
              </div>

              <!-- Important Notice -->
              <div style="background: rgba(255, 26, 68, 0.1); border-left: 4px solid #ff1a44; padding: 16px 20px; border-radius: 8px; margin: 24px 0;">
                <p style="margin: 0; font-size: 14px; color: #e5e5e5; line-height: 1.6;">
                  <strong style="color: #ff1a44;">✓ Payment Confirmed</strong><br/>
                  Your booking is fully confirmed and your tickets are ready to use!
                </p>
              </div>

              <!-- CTA Button -->
              <p style="text-align:center; margin: 40px 0 0;">
                <a href="${viewTicketsUrl}" 
                   style="display:inline-block; background: linear-gradient(135deg, #ff1a44 0%, #e11d48 50%, #be185d 100%); 
                          color:#ffffff; text-decoration:none; 
                          padding:16px 40px; border-radius:12px; 
                          font-size:16px; font-weight:700; 
                          box-shadow:0 8px 20px rgba(255,26,68,0.4); 
                          letter-spacing:0.3px;">
                  View My Tickets
                </a>
              </p>

              <!-- What's Next -->
              <div style="margin-top: 40px; padding-top: 32px; border-top: 1px solid #2a2a2a;">
                <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #fff;">What happens next?</h3>
                <ul style="margin: 0; padding-left: 20px; color: #9ca3af; font-size: 14px; line-height: 1.8;">
                  <li>Your tickets are saved in your dashboard</li>
                  <li>Download or screenshot your QR codes before the event</li>
                  <li>Show your QR code at the venue entrance</li>
                </ul>
              </div>

              <!-- Signature -->
              <div style="margin:40px 0 0; padding-top:24px; border-top:1px solid #2a2a2a;">
                <p style="margin:0 0 8px; font-size:16px; font-weight:600; color:#fff;">Have an amazing time!</p>
                <p style="margin:0 0 4px; font-size:16px; font-weight:600; background: linear-gradient(135deg, #ff1a44 0%, #e11d48 50%, #be185d 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                  Inside Karachi Team
                </p>
                <p style="margin:0; font-size:14px; color:#9ca3af;">
                  Your Guide to Karachi's Best Events
                </p>
              </div>

              <!-- Support -->
              <div style="margin-top: 32px; padding: 20px; background: #111; border-radius: 12px; text-align: center;">
                <p style="margin: 0 0 8px; font-size: 13px; color: #9ca3af;">
                  Need help? We're here for you!
                </p>
                <p style="margin: 0; font-size: 14px;">
                  <a href="mailto:support@insidekarachi.com" style="color: #ff1a44; text-decoration: none; font-weight: 600;">
                    support@insidekarachi.com
                  </a>
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 32px; background: #111; border-top: 1px solid #2a2a2a;">
              <p style="margin: 0 0 12px; font-size: 12px; color: #666; text-align: center; line-height: 1.6;">
                This email was sent to confirm your booking.<br/>
                Booking Reference: <strong style="color: #9ca3af;">${bookingReference}</strong>
              </p>
              <p style="margin: 0; font-size: 11px; color: #666; text-align: center;">
                © ${new Date().getFullYear()} Inside Karachi. All rights reserved.<br/>
                <a href="https://insidekarachi.com" style="color: #9ca3af; text-decoration: none;">insidekarachi.com</a>
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}
