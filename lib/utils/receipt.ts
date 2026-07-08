import crypto from 'crypto';

const SECRET = process.env.RECEIPT_SIGNING_SECRET as string;
if (!SECRET) {
  // Fail fast: secret must be provided in environment for production readiness
  throw new Error('RECEIPT_SIGNING_SECRET is not set. Please set this env var to a secure random value.');
}

/**
 * Create a signed receipt token with expiry.
 * Token format: "<id>:<exp>.<hex-hmac>"
 * - id: stringified id
 * - exp: unix seconds expiry timestamp
 */
export function signReceipt(id: number | string, ttlSeconds = 60 * 60 * 24 * 7) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + Math.floor(ttlSeconds);
  const payload = `${String(id)}:${exp}`;
  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(payload);
  const sig = hmac.digest('hex');
  return `${payload}.${sig}`;
}

/**
 * Verify a signed receipt token and check expiry.
 * Returns true only when signature matches and current time <= exp.
 */
export function verifyReceipt(token: string) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  try {
    const ok = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
    if (!ok) return false;
  } catch {
    return false;
  }
  // payload is id:exp
  const idx = payload.lastIndexOf(':');
  if (idx === -1) return false;
  const expStr = payload.slice(idx + 1);
  const exp = Number(expStr || 0);
  if (!Number.isFinite(exp) || exp <= 0) return false;
  const now = Math.floor(Date.now() / 1000);
  return now <= exp;
}
