import crypto from "crypto";

/**
 * HMAC-SHA256 signature verification for ticket fraud prevention. Shared by
 * the web check-in route (`app/api/tickets/verify/route.ts`) and the mobile
 * equivalent (`app/api/mobile/v1/organizer/tickets/verify/route.ts`) so the
 * signing scheme can never drift between the two surfaces.
 */
export function verifyTicketSignature(
  code: string,
  eventId: number,
  bookingId: number,
  storedSignature: string,
): boolean {
  const SIGNING_SECRET = process.env.TICKET_SIGNING_SECRET;
  if (!SIGNING_SECRET) {
    throw new Error(
      "TICKET_SIGNING_SECRET environment variable is not configured",
    );
  }
  const payload = `${code}:${eventId}:${bookingId}`;
  const expectedSignature = crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(payload)
    .digest("hex")
    .substring(0, 16); // First 16 chars for brevity

  return storedSignature === expectedSignature;
}
