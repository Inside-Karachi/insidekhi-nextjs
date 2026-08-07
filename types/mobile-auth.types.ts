// Shared response shape for every mobile auth route that issues a session
// (login, signup). Kept identical across both so the RN client has one
// contract to parse regardless of which route produced it.

export type MobileAuthUser = {
  id: string;
  email: string;
  role: string;
  username: string | null;
  full_name: string | null;
};

export type MobileAuthResponse = {
  token: string;
  expiresAt: string;
  user: MobileAuthUser;
};

/** Must match the `7d` expiry `lib/auth/jwt.ts`'s `signToken` sets on the JWT itself. */
export const MOBILE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Returned by POST /auth/signup instead of a token — the account isn't
 * usable until the emailed OTP is confirmed via POST /auth/verify-otp. */
export type MobileSignupResponse = {
  requiresVerification: true;
  email: string;
};

export type MobileVerifyOtpRequest = {
  email: string;
  code: string;
};

export type MobileResendOtpRequest = {
  email: string;
};

