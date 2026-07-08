/**
 * Timezone cache utility - timezones are static, so they're cached in memory.
 */

// In-memory cache
let cachedTimezones: string[] | null = null;

/**
 * Get the list of timezone names, cached in memory.
 */
export async function getTimezones(): Promise<string[]> {
  if (cachedTimezones) {
    return cachedTimezones;
  }

  cachedTimezones = getCommonTimezones();
  return cachedTimezones;
}

/**
 * Common timezones.
 */
export function getCommonTimezones(): string[] {
  return [
    "Asia/Karachi",
    "America/New_York",
    "America/Los_Angeles",
    "America/Chicago",
    "Europe/London",
    "Europe/Paris",
    "Asia/Tokyo",
    "Asia/Dubai",
    "Asia/Singapore",
    "Australia/Sydney",
    "UTC",
  ];
}

/**
 * Clear cache (useful for testing or manual refresh)
 */
export function clearTimezoneCache(): void {
  cachedTimezones = null;
}
