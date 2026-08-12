/**
 * Server-only CNIC hashing helpers. Kept out of lib/utils/cnic.ts because
 * that file is imported by client components - the crypto import here
 * would break the client bundle.
 */
import crypto from "crypto";

/**
 * Strips dashes/whitespace from a CNIC, leaving the raw 13-digit string.
 */
export function normalizeCnic(raw: string): string {
  return raw.replace(/[-\s]/g, "");
}

/**
 * One-way SHA-256 hash of a normalized CNIC, for fraud/duplicate detection.
 * Never store the raw CNIC itself - only this hash and cnicLast4().
 */
export function hashCnic(raw: string): string {
  return crypto.createHash("sha256").update(normalizeCnic(raw)).digest("hex");
}

/**
 * Last 4 digits of a normalized CNIC, for door-side ID matching.
 */
export function cnicLast4(raw: string): string {
  return normalizeCnic(raw).slice(-4);
}
