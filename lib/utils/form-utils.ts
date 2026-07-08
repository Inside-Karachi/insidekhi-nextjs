import disposableDomains from 'disposable-email-domains';

// Simple helpers for server-side form handling

export function getGlobalRateMap(): Map<string, number[]> {
  const g = globalThis as unknown as Record<string, unknown>;
  let map = g.__ik_rate_limiter as Map<string, number[]> | undefined;
  if (!map) {
    map = new Map<string, number[]>();
    g.__ik_rate_limiter = map;
  }
  return map;
}

/**
 * In-memory rate limiter. Returns true when the key has exceeded the limit
 * within the provided windowMs. This is intentionally simple and ephemeral.
 */
export function isLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const map = getGlobalRateMap();
  const arr = map.get(key) || [];
  const fresh = arr.filter((t) => t > now - windowMs);
  fresh.push(now);
  map.set(key, fresh);
  return fresh.length > limit;
}

/**
 * More detailed rate check returning retryAfter seconds when limited.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): { limited: boolean; retryAfter: number } {
  const now = Date.now();
  const map = getGlobalRateMap();
  const arr = map.get(key) || [];
  const fresh = arr.filter((t) => t > now - windowMs);
  fresh.push(now);
  map.set(key, fresh);
  if (fresh.length > limit) {
    // earliest timestamp in fresh is the oldest request inside window
    const oldest = fresh[0];
    const retryAfterMs = windowMs - (now - oldest);
    return { limited: true, retryAfter: Math.ceil(retryAfterMs / 1000) };
  }
  return { limited: false, retryAfter: 0 };
}

export function normalizeEmail(raw?: unknown): string {
  return (raw || '').toString().trim().toLowerCase();
}

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1] || '';
  return disposableDomains.includes(domain);
}

export function sanitizeString(raw?: unknown, max = 255): string | null {
  if (!raw) return null;
  return raw.toString().trim().slice(0, max);
}

export function normalizePakPhone(raw?: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).replace(/[^0-9+]/g, '');
  const digits = s.replace(/^\+/, '');
  if (/^03\d{9}$/.test(digits)) return '+92' + digits.slice(1);
  if (/^3\d{9}$/.test(digits)) return '+92' + digits;
  if (/^92?3\d{9}$/.test(digits)) return '+' + digits.replace(/^0+/, '');
  return null;
}

