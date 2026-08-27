import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signToken, JWTPayload } from "./jwt";

const SESSION_COOKIE_NAME = "insidekhi_session";

/**
 * Retrieves the session payload from the HTTP-only cookie in a request.
 */
export async function getSession(request: NextRequest): Promise<JWTPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Retrieves the session payload from the HTTP-only cookie using next/headers cookies() (for Server Components).
 */
export async function getSessionFromCookies(): Promise<JWTPayload | null> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  // Tokens have no server-side revocation list, so a self-deleted account's
  // still-valid JWT is rejected here on every request instead of only once
  // it naturally expires (up to 7 days later). Dynamic import (like the
  // `cookies()` import above): account-status.ts pulls in `lib/db` (`pg`,
  // needs Node's `crypto`), and this file is also imported by the Edge
  // middleware via `getSession()` - a static top-level import here would
  // get bundled into the Edge build even though `getSession()` never calls
  // it, and Edge doesn't support `pg`.
  const { isAccountDeleted } = await import("./account-status");
  if (await isAccountDeleted(payload.userId)) return null;

  return payload;
}

/**
 * Sets the signed JWT session inside an HTTP-only, secure cookie.
 */
export async function setSession(
  response: NextResponse,
  payload: JWTPayload
): Promise<void> {
  const token = await signToken(payload);
  
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

/**
 * Clears the session cookie from the response.
 */
export function clearSession(response: NextResponse): void {
  response.cookies.delete(SESSION_COOKIE_NAME);
}
