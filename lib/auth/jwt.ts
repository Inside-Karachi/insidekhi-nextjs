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

/**
 * Verifies a JWT and returns the payload if valid.
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as JWTPayload;
  } catch (error) {
    // Expiry is routine, not a fault: tokens last 7d with no refresh flow, so
    // every client eventually presents a stale one and callers handle the null
    // by re-authing. Only malformed or tampered tokens are worth surfacing.
    if (!(error instanceof errors.JWTExpired)) {
      console.error("JWT verification failed:", error);
    }
    return null;
  }
}
