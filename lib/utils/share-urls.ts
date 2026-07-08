// Generates platform-specific social share URLs.

import type { SocialPlatform } from "@/types/invite-share.types";

export interface ShareUrlParams {
  title: string;
  url: string;
  description?: string;
  hashtags?: string[];
}

/**
 * Generates a shareable URL for a specific social media platform
 */
export function generateShareUrl(
  platform: SocialPlatform,
  params: ShareUrlParams,
): string {
  const { title, url, description, hashtags = [] } = params;
  const encodedUrl = encodeURIComponent(url);
  const _encodedTitle = encodeURIComponent(title);
  const _encodedDescription = encodeURIComponent(description || title);

  switch (platform) {
    case "whatsapp":
      // WhatsApp share format: text + url
      const whatsappText = `${title}\n\n${url}`;
      return `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

    case "facebook":
      // Modern Facebook Share Dialog
      // Using facebook.com/share format which works without app ID
      // The sharer.php is deprecated but still works for basic sharing
      // For better results with pre-filled content, users should use FB app on mobile
      return `https://www.facebook.com/sharer.php?u=${encodedUrl}`;

    case "twitter":
      // Twitter (X) share intent with better text formatting
      const twitterText = description ? `${title} - ${description}` : title;
      const encodedTwitterText = encodeURIComponent(twitterText);
      const twitterHashtags =
        hashtags.length > 0 ? `&hashtags=${hashtags.join(",")}` : "";
      return `https://twitter.com/intent/tweet?text=${encodedTwitterText}&url=${encodedUrl}${twitterHashtags}`;

    case "linkedin":
      // LinkedIn share with title and summary
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;

    case "instagram":
      // Instagram mobile app deep link (if available)
      // Falls back to showing instructions
      return "instagram-not-supported";

    case "copy_link":
      // Handled separately in component (clipboard API)
      return url;

    case "other":
      // Generic Web Share API fallback
      return url;

    default:
      return url;
  }
}

/**
 * Opens share URL in a new window/tab
 * Handles special cases like Instagram
 */
export function openShareDialog(
  platform: SocialPlatform,
  params: ShareUrlParams,
): boolean {
  const shareUrl = generateShareUrl(platform, params);

  // Special handling for Instagram
  if (platform === "instagram") {
    // Check if on mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      // Try Instagram app deep link on mobile
      // This will open Instagram app if installed
      const instagramUrl = `instagram://story-camera`;
      window.location.href = instagramUrl;

      // Fallback: if app doesn't open in 2 seconds, return false to show instructions
      setTimeout(() => {
        return false;
      }, 2000);
    }

    // Desktop or if app link failed - return false to show instructions
    return false;
  }

  // Special handling for "other" - try native Web Share API
  if (platform === "other" && navigator.share) {
    navigator
      .share({
        title: params.title,
        text: params.description || params.title,
        url: params.url,
      })
      .catch((err) => {
        console.error("Web Share API failed:", err);
      });
    return true;
  }

  // Open share dialog in popup window
  const width = 600;
  const height = 600;
  const left = window.innerWidth / 2 - width / 2;
  const top = window.innerHeight / 2 - height / 2;

  window.open(
    shareUrl,
    "share-dialog",
    `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no`,
  );

  return true;
}

/**
 * Check if a platform supports direct URL sharing
 */
export function supportsDirectShareUrl(platform: SocialPlatform): boolean {
  return !["instagram", "copy_link", "other"].includes(platform);
}
