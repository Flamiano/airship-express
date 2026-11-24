import { NextResponse } from "next/server";
import { reverseGeocode } from "../../../lib/server/ftmGeocode";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = params.get("lat");
  const lon = params.get("lon");
  if (!lat || !lon) return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
  try {
    return NextResponse.json(await reverseGeocode(lat, lon));
  } catch (error) {
    console.error("Reverse geocode proxy error:", error);
    return NextResponse.json({ error: "Reverse geocode proxy failed" }, { status: 502 });
  }
}