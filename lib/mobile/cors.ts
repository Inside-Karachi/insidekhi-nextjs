const ALLOWED_ORIGINS = [
  "https://insidekarachi.com",
  "https://sandbox.insidekarachi.com",
];

/**
 * Metro web (Expo) dev server. The port varies (8081, 8082, ...) and Expo may
 * serve the page on localhost, 127.0.0.1, or the machine's LAN IP depending on
 * how it was opened — all are the same dev server, so accept any of them.
 */
const DEV_ORIGIN =
  /^http:\/\/(localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}):\d+$/;

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin) || DEV_ORIGIN.test(origin);
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
