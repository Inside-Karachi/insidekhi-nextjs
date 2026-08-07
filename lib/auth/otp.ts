import crypto from "crypto";
import { query } from "@/lib/db";
import { sendOtpEmail } from "@/lib/emails/send-otp-email";

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Generates a fresh signup OTP, stores its hash (replacing any prior
 * outstanding code for the user), and emails it. Swallows/logs send
 * failures the same way the password-reset flow does, so signup itself
 * still succeeds and the user can request a resend.
 */
export async function createAndSendSignupOtp(params: {
  userId: string;
  email: string;
  fullName?: string | null;
}): Promise<{ emailSent: boolean }> {
  const { userId, email, fullName } = params;
  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(
    Date.now() + OTP_TTL_MINUTES * 60 * 1000
  ).toISOString();

  await query("DELETE FROM public.email_otps WHERE user_id = $1", [userId]);
  await query(
    `INSERT INTO public.email_otps (user_id, code_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, codeHash, expiresAt]
  );

  const result = await sendOtpEmail({
    email,
    fullName: fullName || undefined,
    code,
    expiryMinutes: OTP_TTL_MINUTES,
  });

  if (result.success) {
    console.log(`[SIGNUP OTP SENT]: ${email}`, { messageId: result.messageId });
  } else {
    console.error(`[SIGNUP OTP SEND FAILED]: ${email}`, {
      error: result.error,
    });
  }

  return { emailSent: result.success };
}

export type VerifySignupOtpResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "expired" | "too_many_attempts" | "incorrect" };

/**
 * Verifies a submitted code against the stored hash for the user. Consumes
 * the OTP row on success; increments attempts and locks after
 * OTP_MAX_ATTEMPTS on failure to resist brute-forcing a 6-digit space.
 */
export async function verifySignupOtp(
  userId: string,
  submittedCode: string
): Promise<VerifySignupOtpResult> {
  const { rows } = await query(
    `SELECT id, code_hash, attempts, expires_at
     FROM public.email_otps
     WHERE user_id = $1 AND purpose = 'signup'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  const otp = rows[0];

  if (!otp) {
    return { ok: false, reason: "not_found" };
  }

  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, reason: "too_many_attempts" };
  }

  if (new Date(otp.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  if (hashCode(submittedCode) !== otp.code_hash) {
    await query(
      "UPDATE public.email_otps SET attempts = attempts + 1 WHERE id = $1",
      [otp.id]
    );
    return { ok: false, reason: "incorrect" };
  }

  await query("DELETE FROM public.email_otps WHERE id = $1", [otp.id]);
  return { ok: true };
}
