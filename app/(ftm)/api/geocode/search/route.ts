import { NextResponse } from "next/server";
import { canSearch, cacheSearch, getSearchCache, searchGeocode } from "../../../lib/server/ftmGeocode";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q");
  if (!query) return NextResponse.json({ error: "q is required" }, { status: 400 });
  const key = query.trim().toLowerCase();
  const cached = getSearchCache(key);
  if (cached) return NextResponse.json(cached);
  if (!canSearch()) return NextResponse.json([]);
  try {
    const results = await searchGeocode(query);
    cacheSearch(key, results);
    return NextResponse.json(results);
  } catch (error) {
    console.error("Geocode search proxy error:", error);
    return NextResponse.json([]);
  }
}