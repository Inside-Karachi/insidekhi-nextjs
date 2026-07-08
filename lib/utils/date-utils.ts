/**
 * Server-safe date formatting utilities
 * These functions ensure consistent date formatting between server and client
 * to prevent hydration mismatches in React components.
 */

/**
 * Format a date string into a consistent format for display
 * This function is designed to be hydration-safe by using consistent locale and timezone
 */
export function formatEventDate(dateString: string): {
  date: string;
  time: string;
  full: string;
} {
  try {
    const date = new Date(dateString);

    // Use UTC to ensure consistency between server and client
    // This prevents timezone-related hydration mismatches
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    });

    const fullStr = date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });

    return {
      date: dateStr,
      time: timeStr,
      full: fullStr,
    };
  } catch (error) {
    console.error("Error formatting date:", error);
    return {
      date: "Invalid Date",
      time: "",
      full: "Invalid Date",
    };
  }
}

/**
 * Check if an event is upcoming (starts in the future)
 */
export function isEventUpcoming(startTime: string): boolean {
  try {
    const eventDate = new Date(startTime);
    const now = new Date();
    return eventDate > now;
  } catch (error) {
    console.error("Error checking if event is upcoming:", error);
    return false;
  }
}

/**
 * Get relative time description for an event
 */
export function getEventRelativeTime(startTime: string): string {
  try {
    const eventDate = new Date(startTime);
    const now = new Date();
    const diffMs = eventDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return "Past Event";
    } else if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Tomorrow";
    } else if (diffDays < 7) {
      return `In ${diffDays} days`;
    } else if (diffDays < 30) {
      const weeks = Math.ceil(diffDays / 7);
      return `In ${weeks} week${weeks > 1 ? "s" : ""}`;
    } else {
      const months = Math.ceil(diffDays / 30);
      return `In ${months} month${months > 1 ? "s" : ""}`;
    }
  } catch (error) {
    console.error("Error calculating relative time:", error);
    return "Unknown";
  }
}
