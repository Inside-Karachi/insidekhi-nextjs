import { SignJWT, jwtVerify, errors } from "jose";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not configured");
  }
  return new TextEncoder().encode(secret);
}

export interface JWTPayload {
  userId: string;
  email?: string;
  role: string;
}

/**
 * Signs a JWT with the user's ID, email, and role.
 */
export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export type TokenVerification =
  | { valid: true; payload: JWTPayload }
  | { valid: false; expired: boolean };

/**
 * Verifies a JWT and reports *why* verification failed. "Expired" is a
 * routine, time-based event every client eventually hits (7d tokens, no
 * refresh flow) - callers can treat it as an ordinary "log in again" case, or
 * even give it the benefit of the doubt as a transient backend blip. Anything
 * else (malformed, tampered, wrong signature) is structurally broken and can
 * never become valid no matter how many times it's retried - mobile's 401
 * handling needs this distinction so a permanently-invalid token gets the
 * local session cleared immediately instead of being retried forever.
 */
export async function verifyTokenDetailed(token: string): Promise<TokenVerification> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { valid: true, payload: payload as unknown as JWTPayload };
  } catch (error) {
    const expired = error instanceof errors.JWTExpired;
    if (!expired) {
      console.error("JWT verification failed:", error);
    }
    return { valid: false, expired };
  }
}

/**
 * Verifies a JWT and returns the payload if valid.
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  const result = await verifyTokenDetailed(token);
  return result.valid ? result.payload : null;
}
