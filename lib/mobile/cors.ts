const ALLOWED_ORIGINS = [
  "https://insidekarachi.com",
  "https://sandbox.insidekarachi.com",
];

const LOCALHOST_ORIGIN = /^http:\/\/localhost:\d+$/;

/** Metro web (Expo) dev server — origin varies by port (8081, 8082, ...). */
function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin) || LOCALHOST_ORIGIN.test(origin);
}

/**
 * CORS headers for the mobile API, applied in `middleware.ts` to every
 * `/api/mobile/v1/*` request/response. Only Expo web (browser) needs this —
 * native fetch isn't subject to CORS — but it must cover both the OPTIONS
 * preflight and the real response, since the browser checks both.
 */
export function corsHeaders(originHeader: string | null): Record<string, string> {
  if (!originHeader || !isAllowedOrigin(originHeader)) return {};

  return {
    "Access-Control-Allow-Origin": originHeader,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Anon-Id",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
