import { NextRequest, NextResponse } from "next/server";

const SKETCHFAB_TOKEN = process.env.SKETCHFAB_TOKEN;
const SKETCHFAB_API_BASE = "https://api.sketchfab.com/v3";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query")?.trim();
  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  if (!SKETCHFAB_TOKEN) {
    return NextResponse.json(
      { error: "SKETCHFAB_TOKEN is not configured on the server" },
      { status: 500 }
    );
  }

  const url = `${SKETCHFAB_API_BASE}/search?type=models&q=${encodeURIComponent(
    query
  )}&sort_by=-likeCount&downloadable=false&archives=false&staffpicked=false&private=false`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${SKETCHFAB_TOKEN}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      return NextResponse.json(
        { error: `Sketchfab search failed: ${response.status} ${body}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const firstModel = Array.isArray(data.results) ? data.results[0] : null;

    if (!firstModel) {
      return NextResponse.json(
        { error: "No Sketchfab model found for query", results: data.results ?? [] },
        { status: 404 }
      );
    }

    return NextResponse.json({
      uid: firstModel.uid,
      name: firstModel.name,
      viewerUrl: `https://sketchfab.com/models/${firstModel.uid}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch Sketchfab model" },
      { status: 502 }
    );
  }
}
