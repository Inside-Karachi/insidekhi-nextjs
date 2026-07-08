/**
 * Business Owner Email Templates
 * Professional notifications for business listing owners
 */

// No imports needed - all content is inline HTML strings

// Base email layout for consistency
function createEmailWrapper(content: string, preheader: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>Inside Karachi - Business Portal</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#0f0f0f; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <!-- Preheader -->
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
    ${preheader}
  </div>

  <!-- Wrapper -->
  <table align="center" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0f0f0f" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Container -->
        <table width="600" cellpadding="0" cellspacing="0" bgcolor="#1a1a1a" style="border-radius:16px; overflow:hidden; box-shadow:0 8px 28px rgba(0,0,0,0.55); border:1px solid #2a2a2a;">
          
          <!-- Logo -->
          <tr>
            <td align="center" style="padding: 32px 20px 20px;">
              <img src="https://insidekarachi.com/logo-white.png" alt="Inside Karachi" width="140" style="display:block; margin:0 auto;">
            </td>
          </tr>

          ${content}

          <!-- Footer -->
          <tr>
            <td style="padding: 32px; background-color: #111; border-top: 1px solid #2a2a2a; text-align: center;">
              <p style="margin: 0 0 12px; font-size: 13px; color: #9ca3af;">
                <strong>Business Portal</strong> | Inside Karachi
              </p>
              <p style="margin: 0 0 12px; font-size: 12px; color: #6b7280; line-height: 1.6;">
                You received this email because you are a business owner on Inside Karachi.<br/>
                Manage your preferences in <a href="https://insidekarachi.com/dashboard/business/settings" style="color: #ff1a44; text-decoration: none;">Settings</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #4b5563;">
                © 2026 Inside Karachi. All rights reserved.
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

// 1. New Review Received
interface NewReviewParams {
  businessOwnerName: string;
  listingName: string;
  reviewerName: string;
  rating: number;
  reviewSnippet: string;
  reviewDate: string;
  viewReviewUrl: string;
  replyUrl: string;
}

export function generateNewReviewEmail({
  businessOwnerName,
  listingName,
  reviewerName,
  rating,
  reviewSnippet,
  reviewDate,
  viewReviewUrl,
  replyUrl,
}: NewReviewParams): string {
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);

  const content = `
    <!-- Header -->
    <tr>
      <td align="center" style="padding: 32px 32px 24px; background: linear-gradient(135deg, #ff1a44 0%, #be185d 100%);">
        <div style="font-size: 40px; margin-bottom: 12px;">⭐</div>
        <h1 style="margin:0; font-size:24px; font-weight:700; color:#ffffff;">
          New Review Received
        </h1>
        <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">
          Someone reviewed ${listingName}
        </p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px; font-size:15px; line-height:1.7; color:#e5e5e5;">
        <p style="margin:0 0 20px;">Hi ${businessOwnerName},</p>
        
        <p style="margin:0 0 24px;">You have a new review for <strong style="color:#f8fafc;">${listingName}</strong>.</p>

        <!-- Review Card -->
        <div style="background: #111; border-left: 4px solid #ff1a44; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <div style="margin-bottom: 16px;">
            <div style="font-size: 22px; color: #fbbf24; margin-bottom: 8px; letter-spacing: 2px;">
              ${stars}
            </div>
            <div style="font-size: 13px; color: #9ca3af;">
              by <strong style="color: #e5e5e5;">${reviewerName}</strong> on ${reviewDate}
            </div>
          </div>
          
          <div style="padding: 16px; background: #1a1a1a; border-radius: 8px; font-size: 14px; color: #d1d5db; line-height: 1.6; font-style: italic;">
            "${reviewSnippet}"
          </div>
        </div>

        <p style="margin: 24px 0 16px; font-size: 14px; color: #9ca3af;">
          <strong>Quick Actions:</strong>
        </p>

        <!-- Action Buttons -->
        <table width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 0 8px 0 0;">
              <a href="${viewReviewUrl}" style="display: block; padding: 14px 24px; background: #ff1a44; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; text-align: center; font-size: 14px;">
                View Review
              </a>
            </td>
            <td style="padding: 0 0 0 8px;">
              <a href="${replyUrl}" style="display: block; padding: 14px 24px; background: #374151; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; text-align: center; font-size: 14px;">
                Reply Now
              </a>
            </td>
          </tr>
        </table>

        <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
          💡 <strong>Pro Tip:</strong> Responding to reviews shows you care about customer feedback and can improve your reputation.
        </p>
      </td>
    </tr>
  `;

  return createEmailWrapper(
    content,
    `New ${rating}-star review for ${listingName} from ${reviewerName}`,
  );
}

// 2. Listing Approved
interface ListingApprovedParams {
  businessOwnerName: string;
  listingName: string;
  approvedAt: string;
  listingUrl: string;
  dashboardUrl: string;
}

export function generateListingApprovedEmail({
  businessOwnerName,
  listingName,
  approvedAt,
  listingUrl,
  dashboardUrl,
}: ListingApprovedParams): string {
  const content = `
    <!-- Header -->
    <tr>
      <td align="center" style="padding: 32px 32px 24px; background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
        <div style="font-size: 40px; margin-bottom: 12px;">✅</div>
        <h1 style="margin:0; font-size:24px; font-weight:700; color:#ffffff;">
          Listing Approved!
        </h1>
        <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">
          ${listingName} is now live
        </p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px; font-size:15px; line-height:1.7; color:#e5e5e5;">
        <p style="margin:0 0 20px;">Hi ${businessOwnerName},</p>
        
        <p style="margin:0 0 24px;">Great news! Your listing <strong style="color:#f8fafc;">${listingName}</strong> has been reviewed and approved.</p>

        <!-- Success Card -->
        <div style="background: linear-gradient(135deg, #14532d 0%, #166534 100%); border-left: 4px solid #10b981; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <h3 style="margin: 0 0 12px; font-size: 16px; color: #ffffff; font-weight: 700;">
            🎉 Your Listing is Live!
          </h3>
          <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.9); line-height: 1.6;">
            Your business is now visible to thousands of users on Inside Karachi. Approved on ${approvedAt}.
          </p>
        </div>

        <p style="margin: 24px 0 16px; font-size: 14px; color: #9ca3af;">
          <strong>What's Next?</strong>
        </p>

        <ul style="margin: 0 0 24px; padding-left: 20px; color: #d1d5db; font-size: 14px; line-height: 1.8;">
          <li>Monitor customer reviews and reply promptly</li>
          <li>Keep your business hours and contact details updated</li>
          <li>Add high-quality photos to attract more visitors</li>
          <li>Track your listing performance in the dashboard</li>
        </ul>

        <!-- Action Buttons -->
        <table width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 0 8px 0 0;">
              <a href="${listingUrl}" style="display: block; padding: 14px 24px; background: #10b981; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; text-align: center; font-size: 14px;">
                View Live Listing
              </a>
            </td>
            <td style="padding: 0 0 0 8px;">
              <a href="${dashboardUrl}" style="display: block; padding: 14px 24px; background: #374151; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; text-align: center; font-size: 14px;">
                Go to Dashboard
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return createEmailWrapper(
    content,
    `${listingName} is now live on Inside Karachi!`,
  );
}

// 3. Listing Rejected
interface ListingRejectedParams {
  businessOwnerName: string;
  listingName: string;
  rejectionReason: string;
  reviewNotes: string;
  editListingUrl: string;
  supportUrl: string;
}

export function generateListingRejectedEmail({
  businessOwnerName,
  listingName,
  rejectionReason,
  reviewNotes,
  editListingUrl,
  supportUrl,
}: ListingRejectedParams): string {
  const content = `
    <!-- Header -->
    <tr>
      <td align="center" style="padding: 32px 32px 24px; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);">
        <div style="font-size: 40px; margin-bottom: 12px;">⚠️</div>
        <h1 style="margin:0; font-size:24px; font-weight:700; color:#ffffff;">
          Listing Needs Updates
        </h1>
        <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">
          Action required for ${listingName}
        </p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px; font-size:15px; line-height:1.7; color:#e5e5e5;">
        <p style="margin:0 0 20px;">Hi ${businessOwnerName},</p>
        
        <p style="margin:0 0 24px;">Your listing <strong style="color:#f8fafc;">${listingName}</strong> requires some updates before it can be published.</p>

        <!-- Reason Card -->
        <div style="background: #450a0a; border-left: 4px solid #dc2626; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <h3 style="margin: 0 0 12px; font-size: 16px; color: #ffffff; font-weight: 700;">
            Reason for Review Request
          </h3>
          <p style="margin: 0 0 16px; font-size: 14px; color: #fca5a5; font-weight: 600;">
            ${rejectionReason}
          </p>
          <div style="padding: 16px; background: #1a1a1a; border-radius: 8px; font-size: 14px; color: #d1d5db; line-height: 1.6;">
            ${reviewNotes}
          </div>
        </div>

        <p style="margin: 24px 0 16px; font-size: 14px; color: #9ca3af;">
          <strong>What to Do Next:</strong>
        </p>

        <ol style="margin: 0 0 24px; padding-left: 20px; color: #d1d5db; font-size: 14px; line-height: 1.8;">
          <li>Review the feedback provided above</li>
          <li>Update your listing with the necessary changes</li>
          <li>Resubmit for review</li>
          <li>Our team will review it again within 24-48 hours</li>
        </ol>

        <!-- Action Buttons -->
        <table width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 0 8px 0 0;">
              <a href="${editListingUrl}" style="display: block; padding: 14px 24px; background: #ff1a44; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; text-align: center; font-size: 14px;">
                Edit Listing
              </a>
            </td>
            <td style="padding: 0 0 0 8px;">
              <a href="${supportUrl}" style="display: block; padding: 14px 24px; background: #374151; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; text-align: center; font-size: 14px;">
                Contact Support
              </a>
            </td>
          </tr>
        </table>

        <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
          Need help? Our support team is here to assist you with any questions.
        </p>
      </td>
    </tr>
  `;

  return createEmailWrapper(content, `Update required for ${listingName}`);
}

// 4. Reply Approved
interface ReplyApprovedParams {
  businessOwnerName: string;
  listingName: string;
  reviewerName: string;
  yourReply: string;
  approvedAt: string;
  viewReplyUrl: string;
}

export function generateReplyApprovedEmail({
  businessOwnerName,
  listingName,
  reviewerName,
  yourReply,
  approvedAt,
  viewReplyUrl,
}: ReplyApprovedParams): string {
  const content = `
    <!-- Header -->
    <tr>
      <td align="center" style="padding: 32px 32px 24px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);">
        <div style="font-size: 40px; margin-bottom: 12px;">💬</div>
        <h1 style="margin:0; font-size:24px; font-weight:700; color:#ffffff;">
          Reply Published
        </h1>
        <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">
          Your response is now live
        </p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px; font-size:15px; line-height:1.7; color:#e5e5e5;">
        <p style="margin:0 0 20px;">Hi ${businessOwnerName},</p>
        
        <p style="margin:0 0 24px;">Your reply to ${reviewerName}'s review on <strong style="color:#f8fafc;">${listingName}</strong> has been approved and published.</p>

        <!-- Reply Card -->
        <div style="background: #1e3a8a; border-left: 4px solid #3b82f6; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <h3 style="margin: 0 0 12px; font-size: 16px; color: #ffffff; font-weight: 700;">
            Your Reply
          </h3>
          <div style="padding: 16px; background: rgba(255,255,255,0.1); border-radius: 8px; font-size: 14px; color: #dbeafe; line-height: 1.6;">
            "${yourReply}"
          </div>
          <p style="margin: 16px 0 0; font-size: 13px; color: rgba(255,255,255,0.7);">
            Published on ${approvedAt}
          </p>
        </div>

        <p style="margin: 24px 0 16px; font-size: 14px; color: #d1d5db; line-height: 1.6;">
          Your reply is now visible to all customers viewing this review. Thank you for engaging with customer feedback!
        </p>

        <!-- Action Button -->
        <a href="${viewReplyUrl}" style="display: inline-block; padding: 14px 28px; background: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
          View Reply
        </a>
      </td>
    </tr>
  `;

  return createEmailWrapper(
    content,
    `Your reply to ${reviewerName} is now public`,
  );
}

// 5. Monthly Report Ready
interface MonthlyReportParams {
  businessOwnerName: string;
  reportMonth: string;
  totalViews: number;
  newReviews: number;
  averageRating: number;
  topPerformingListing: string;
  downloadReportUrl: string;
  dashboardUrl: string;
}

export function generateMonthlyReportEmail({
  businessOwnerName,
  reportMonth,
  totalViews,
  newReviews,
  averageRating,
  topPerformingListing,
  downloadReportUrl,
  dashboardUrl,
}: MonthlyReportParams): string {
  const content = `
    <!-- Header -->
    <tr>
      <td align="center" style="padding: 32px 32px 24px; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);">
        <div style="font-size: 40px; margin-bottom: 12px;">📊</div>
        <h1 style="margin:0; font-size:24px; font-weight:700; color:#ffffff;">
          Monthly Performance Report
        </h1>
        <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">
          ${reportMonth} Performance Summary
        </p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px; font-size:15px; line-height:1.7; color:#e5e5e5;">
        <p style="margin:0 0 20px;">Hi ${businessOwnerName},</p>
        
        <p style="margin:0 0 24px;">Your performance report for <strong style="color:#f8fafc;">${reportMonth}</strong> is ready! Here's how your listings performed.</p>

        <!-- Stats Grid -->
        <table width="100%" cellspacing="8" cellpadding="0" style="margin: 24px 0;">
          <tr>
            <td width="50%" style="padding: 0;">
              <div style="background: #111; border-left: 3px solid #8b5cf6; border-radius: 8px; padding: 20px;">
                <div style="font-size: 32px; font-weight: 700; color: #fff; margin-bottom: 4px;">
                  ${totalViews.toLocaleString()}
                </div>
                <div style="font-size: 13px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">
                  Total Views
                </div>
              </div>
            </td>
            <td width="50%" style="padding: 0;">
              <div style="background: #111; border-left: 3px solid #10b981; border-radius: 8px; padding: 20px;">
                <div style="font-size: 32px; font-weight: 700; color: #fff; margin-bottom: 4px;">
                  ${newReviews}
                </div>
                <div style="font-size: 13px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">
                  New Reviews
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding: 8px 0 0;">
              <div style="background: #111; border-left: 3px solid #fbbf24; border-radius: 8px; padding: 20px;">
                <div style="font-size: 32px; font-weight: 700; color: #fff; margin-bottom: 4px;">
                  ${averageRating.toFixed(1)} ⭐
                </div>
                <div style="font-size: 13px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">
                  Average Rating
                </div>
              </div>
            </td>
          </tr>
        </table>

        <!-- Top Performer -->
        <div style="background: linear-gradient(135deg, #312e81 0%, #1e1b4b 100%); border-left: 4px solid #8b5cf6; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <h3 style="margin: 0 0 8px; font-size: 16px; color: #ffffff; font-weight: 700;">
            🏆 Top Performer
          </h3>
          <p style="margin: 0; font-size: 18px; color: #c4b5fd; font-weight: 600;">
            ${topPerformingListing}
          </p>
        </div>

        <!-- Action Buttons -->
        <table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 24px;">
          <tr>
            <td style="padding: 0 8px 0 0;">
              <a href="${downloadReportUrl}" style="display: block; padding: 14px 24px; background: #8b5cf6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; text-align: center; font-size: 14px;">
                Download Report
              </a>
            </td>
            <td style="padding: 0 0 0 8px;">
              <a href="${dashboardUrl}" style="display: block; padding: 14px 24px; background: #374151; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; text-align: center; font-size: 14px;">
                View Dashboard
              </a>
            </td>
          </tr>
        </table>

        <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
          Keep up the great work! Your detailed analytics are available in your dashboard anytime.
        </p>
      </td>
    </tr>
  `;

  return createEmailWrapper(
    content,
    `Your ${reportMonth} performance report is ready`,
  );
}

// 6. Pending Replies Reminder
interface PendingRepliesParams {
  businessOwnerName: string;
  pendingCount: number;
  oldestReviewDate: string;
  reviews: Array<{
    listingName: string;
    reviewerName: string;
    rating: number;
    daysAgo: number;
  }>;
  repliesUrl: string;
}

export function generatePendingRepliesReminderEmail({
  businessOwnerName,
  pendingCount,
  oldestReviewDate,
  reviews,
  repliesUrl,
}: PendingRepliesParams): string {
  const reviewsList = reviews
    .slice(0, 3)
    .map(
      (review) => `
    <div style="padding: 16px; background: #1a1a1a; border-radius: 8px; margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
        <div>
          <div style="font-size: 14px; font-weight: 600; color: #fff; margin-bottom: 4px;">
            ${review.listingName}
          </div>
          <div style="font-size: 13px; color: #9ca3af;">
            ${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)} by ${review.reviewerName}
          </div>
        </div>
        <div style="font-size: 12px; color: #ff1a44; font-weight: 600;">
          ${review.daysAgo} days ago
        </div>
      </div>
    </div>
  `,
    )
    .join("");

  const content = `
    <!-- Header -->
    <tr>
      <td align="center" style="padding: 32px 32px 24px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
        <div style="font-size: 40px; margin-bottom: 12px;">🔔</div>
        <h1 style="margin:0; font-size:24px; font-weight:700; color:#ffffff;">
          Pending Review Replies
        </h1>
        <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">
          ${pendingCount} review${pendingCount > 1 ? "s" : ""} waiting for your response
        </p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px; font-size:15px; line-height:1.7; color:#e5e5e5;">
        <p style="margin:0 0 20px;">Hi ${businessOwnerName},</p>
        
        <p style="margin:0 0 24px;">You have <strong style="color:#f8fafc;">${pendingCount} unanswered review${pendingCount > 1 ? "s" : ""}</strong> waiting for your response. The oldest review is from ${oldestReviewDate}.</p>

        <!-- Alert Box -->
        <div style="background: #451a03; border-left: 4px solid #f59e0b; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0; font-size: 14px; color: #fed7aa; line-height: 1.6;">
            ⚡ <strong style="color: #fff;">Quick responses boost your reputation!</strong><br/>
            Customers value businesses that engage with feedback promptly.
          </p>
        </div>

        <!-- Reviews List -->
        <div style="margin: 24px 0;">
          <h3 style="margin: 0 0 16px; font-size: 16px; color: #fff; font-weight: 700;">
            Recent Unanswered Reviews:
          </h3>
          ${reviewsList}
          ${pendingCount > 3 ? `<p style="margin: 12px 0 0; font-size: 13px; color: #9ca3af;">+ ${pendingCount - 3} more waiting...</p>` : ""}
        </div>

        <!-- Action Button -->
        <a href="${repliesUrl}" style="display: inline-block; padding: 14px 28px; background: #f59e0b; color: #000; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; margin-top: 16px;">
          Reply to Reviews
        </a>

        <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
          Don't let reviews go unanswered! Each response is an opportunity to show you care about customer experience.
        </p>
      </td>
    </tr>
  `;

  return createEmailWrapper(
    content,
    `${pendingCount} reviews need your attention`,
  );
}
