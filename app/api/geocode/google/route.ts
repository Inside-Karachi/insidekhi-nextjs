import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const key = process.env.GOOGLE_MAPS_API_KEY;

  if (!lat || !lng) {
    return NextResponse.json(
      { error: "Latitude and longitude are required" },
      { status: 400 }
    );
  }

  if (!key) {
    return NextResponse.json(
      { error: "GOOGLE_MAPS_API_KEY not configured" },
      { status: 400 }
    );
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${lat},${lng}`);
    url.searchParams.set("key", key);
    url.searchParams.set("language", "en"); // force English results
    url.searchParams.set("region", "pk"); // bias for Pakistan

    const res = await fetch(url.toString());
    if (!res.ok) {
      return NextResponse.json(
        { error: `Google Geocoding failed with status ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    if (
      data.status !== "OK" ||
      !Array.isArray(data.results) ||
      data.results.length === 0
    ) {
      return NextResponse.json(
        { error: `Geocoding no results (${data.status})` },
        { status: 404 }
      );
    }

    const top = data.results[0];
    const formattedAddress: string = top.formatted_address;
    const placeId: string = top.place_id;
    const components = top.address_components ?? [];

    return NextResponse.json({
      provider: "google",
      formattedAddress,
      placeId,
      components,
    });
  } catch (error) {
    console.error("Google geocoding error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
