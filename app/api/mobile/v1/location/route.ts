import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";

export const dynamic = "force-dynamic";

// Approximate Karachi bounding box (mirrors app/api/location).
const KARACHI_BOUNDS = { north: 25.0, south: 24.7, east: 67.4, west: 66.9 };

type Confidence = "high" | "medium" | "low";
type Address = Record<string, string | null | undefined>;

function isPrecise(addr?: Address | null): boolean {
  if (!addr) return false;
  return Boolean(
    addr.house_number ||
    addr.house_name ||
    addr.building ||
    addr.road ||
    addr.street,
  );
}

function buildFormattedAddress(addr?: Address | null): string | null {
  if (!addr || typeof addr !== "object") return null;
  const parts: string[] = [];
  const push = (v?: string | null) => {
    if (v && typeof v === "string") parts.push(v);
  };
  push(addr.house_number);
  push(addr.road || addr.street || addr.pedestrian);
  push(addr.neighbourhood || addr.suburb || addr.quarter || addr.locality);
  push(addr.city_district || addr.district || addr.subdistrict);
  push(addr.town || addr.city || addr.village || addr.hamlet);
  push(addr.state);
  push(addr.postcode);
  push(addr.country);
  const formatted = parts.filter(Boolean).join(", ");
  return formatted || null;
}

/**
 * GET /api/mobile/v1/location?lat=&lng=&label=
 *
 * Reverse-geocodes coordinates to a Karachi area name. Normalized projection of
 * `app/api/location`: returns only `{ location, isInKarachi, formattedAddress,
 * confidence }` (contract section 6). External OSM/Nominatim proxy - no DB, no auth.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const { searchParams } = new URL(request.url);
  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");

  if (!latRaw || !lngRaw) {
    throw new MobileApiError(
      "validation_error",
      "Latitude and longitude are required.",
      400,
      !latRaw ? "lat" : "lng",
    );
  }

  const latitude = parseFloat(latRaw);
  const longitude = parseFloat(lngRaw);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    throw new MobileApiError(
      "validation_error",
      "Latitude and longitude must be valid numbers.",
      400,
    );
  }

  const isInKarachi =
    latitude >= KARACHI_BOUNDS.south &&
    latitude <= KARACHI_BOUNDS.north &&
    longitude >= KARACHI_BOUNDS.west &&
    longitude <= KARACHI_BOUNDS.east;

  if (!isInKarachi) {
    return ok({
      location: "Karachi, Pakistan",
      isInKarachi: false,
      formattedAddress: null,
      confidence: "low" as Confidence,
    });
  }

  const fallback = ok({
    location: "Karachi, Pakistan",
    isInKarachi: true,
    formattedAddress: null,
    confidence: "low" as Confidence,
  });

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("zoom", "18");

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Inside-Karachi-App/1.0 (contact@insidekarachi.com)",
        "Accept-Language": "en",
      },
    });
    if (!response.ok) return fallback;

    const data = (await response.json()) as {
      display_name?: string;
      address?: Address;
    };
    const address = data.address ?? null;
    const confidence: Confidence = isPrecise(address) ? "high" : "medium";
    const formattedAddress =
      buildFormattedAddress(address) ?? data.display_name ?? null;

    // Prefer the most specific non-administrative area token.
    const area =
      address?.suburb ||
      address?.neighbourhood ||
      address?.quarter ||
      address?.district ||
      address?.subdistrict ||
      address?.residential ||
      address?.town ||
      address?.locality ||
      address?.road ||
      address?.street;

    return ok({
      location: area ? `${area}, Karachi` : "Karachi, Pakistan",
      isInKarachi: true,
      formattedAddress,
      confidence,
    });
  } catch (err) {
    console.error("[mobile-api] location reverse-geocode failed:", err);
    return fallback;
  }
});
