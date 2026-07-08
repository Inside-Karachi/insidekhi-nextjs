/** CNIC helpers */

/**
 * Validates a raw CNIC (13 digits, no dashes)
 */
export function isValidCnic(raw: string): boolean {
  return /^\d{13}$/.test(raw);
}

/**
 * Formats CNIC to standard format: XXXXX-XXXXXXX-X
 * Input: 13 digit string (e.g., "4220112345671")
 * Output: "42201-1234567-1"
 */
export function formatCnic(raw: string): string {
  // Remove any existing dashes
  const digits = raw.replace(/-/g, "");

  // If not 13 digits, return as-is
  if (!/^\d{13}$/.test(digits)) {
    return raw;
  }

  // Format: XXXXX-XXXXXXX-X
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

/**
 * Formats last 4 digits of CNIC for display
 * Input: "7177"
 * Output: "***-*******-7177" or just "****7177"
 */
export function formatCnicLast4(last4: string): string {
  if (!last4 || last4.length !== 4) {
    return last4 || "";
  }
  return `*****-*******-${last4.slice(0, 1)}`;
}

/**
 * Masks CNIC for display, showing only last 4 digits
 * Input: "42201-1234567-1" or "4220112345671"
 * Output: "*****-*******-1"
 */
export function maskCnic(cnic: string): string {
  const digits = cnic.replace(/-/g, "");
  if (digits.length < 4) return cnic;

  const last1 = digits.slice(-1);
  return `*****-*******-${last1}`;
}
