import { NextRequest, NextResponse } from "next/server";

const EDMUNDS_API_KEY = process.env.EDMUNDS_API_KEY;
const EDMUNDS_API_BASE = "https://api.edmunds.com/api/vehicle/v2";

export async function GET(req: NextRequest) {
  const vin = req.nextUrl.searchParams.get("vin")?.trim();
  if (!vin) {
    return NextResponse.json({ error: "VIN is required" }, { status: 400 });
  }

  if (!EDMUNDS_API_KEY) {
    return NextResponse.json(
      { error: "EDMUNDS_API_KEY is not configured on the server" },
      { status: 500 }
    );
  }

  const url = `${EDMUNDS_API_BASE}/vins/${encodeURIComponent(vin)}?fmt=json&api_key=${encodeURIComponent(
    EDMUNDS_API_KEY
  )}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text();
      return NextResponse.json(
        { error: `Edmunds API error: ${response.status} ${body}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json({ vin: vin.toUpperCase(), data });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch vehicle analytics from Edmunds." },
      { status: 502 }
    );
  }
}
