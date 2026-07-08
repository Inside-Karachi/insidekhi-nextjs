/**
 * Google Maps URL parsing utilities.
 * Handles common share URL formats and extracts latitude/longitude when present.
 * No network requests are made; parsing is done purely via string/regex.
 */

export interface ParsedGoogleMapsLink {
  lat?: number;
  lng?: number;
  label?: string;
  /** A canonical, safe-to-share link built from extracted data. */
  normalizedUrl?: string;
}

const DECIMAL = "-?\\d{1,3}(?:\\.\\d+)?"; // -180.0 pattern (loose)

/**
 * Try to extract coordinates from a Google Maps URL string.
 * Supported patterns:
 * - /@lat,lng,zoom
 * - !3dLAT!4dLNG in the `data` segment
 * - q=lat,lng or query=lat,lng
 * - ll=lat,lng or sll=lat,lng or center=lat,lng
 */
export function parseGoogleMapsLink(raw: string): ParsedGoogleMapsLink {
  const input = (raw || "").trim();
  if (!input) return {};

  let url: URL | null = null;
  try {
    url = new URL(input.startsWith("http") ? input : `https://${input}`);
  } catch {
    // Not a full URL; attempt to parse coordinates directly from the string
  }

  // 1) /@lat,lng,zoom pattern
  const atMatch = input.match(
    new RegExp(`/@\s*(${DECIMAL})\s*,\s*(${DECIMAL})\s*[,/]`)
  );
  if (atMatch) {
    const lat = Number(atMatch[1]);
    const lng = Number(atMatch[2]);
    return withNormalized({ lat, lng }, url);
  }

  // 2) !3dLAT!4dLNG token pattern
  const tokenMatch = input.match(
    new RegExp(`!3d\s*(${DECIMAL})\s*!4d\s*(${DECIMAL})`)
  );
  if (tokenMatch) {
    const lat = Number(tokenMatch[1]);
    const lng = Number(tokenMatch[2]);
    return withNormalized({ lat, lng }, url);
  }

  // 3) Query parameters containing coordinates
  const params = url ? url.searchParams : null;
  const paramCandidates = ["q", "query", "ll", "sll", "center"]; // many variants
  for (const key of paramCandidates) {
    const v = params?.get(key);
    if (!v) continue;
    const pair = v.match(new RegExp(`^\s*(${DECIMAL})\s*,\s*(${DECIMAL})\s*$`));
    if (pair) {
      const lat = Number(pair[1]);
      const lng = Number(pair[2]);
      return withNormalized({ lat, lng }, url);
    }
  }

  // 4) Extract label if present in /place/<label>/
  const placeLabel = input.match(/\/maps\/place\/([^/]+)/);
  const label = placeLabel
    ? decodeURIComponent(placeLabel[1].replace(/\+/g, " "))
    : undefined;

  // 5) If we have a query text (non-coordinate), we can use that as label
  const queryText = params?.get("q") || params?.get("query") || undefined;
  const queryLooksLikeCoords = queryText
    ? /\d\s*,\s*\d/.test(queryText)
    : false;
  const finalLabel = !queryLooksLikeCoords && queryText ? queryText : label;

  return withNormalized({ label: finalLabel }, url);
}

function withNormalized(
  data: { lat?: number; lng?: number; label?: string },
  url: URL | null
): ParsedGoogleMapsLink {
  const { lat, lng, label } = data;

  let normalizedUrl: string | undefined;
  if (typeof lat === "number" && typeof lng === "number") {
    normalizedUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  } else if (label) {
    normalizedUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      label
    )}`;
  } else if (url) {
    // Fallback to original host if nothing was extracted
    normalizedUrl = url.toString();
  }

  return { lat, lng, label, normalizedUrl };
}

/**
 * Basic host validation to determine if a URL looks like a Google Maps share link.
 * Accepts common Google hosts including short/app links.
 */
export function isLikelyGoogleMapsHost(hostname: string): boolean {
  const allowed = new Set([
    "www.google.com",
    "google.com",
    "maps.google.com",
    "www.google.com.pk",
    "google.com.pk",
    "maps.app.goo.gl",
    "goo.gl",
    "g.page",
    "g.co",
  ]);
  return allowed.has(hostname);
}
