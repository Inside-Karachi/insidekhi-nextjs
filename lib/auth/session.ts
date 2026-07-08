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
  return verifyToken(token);
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
