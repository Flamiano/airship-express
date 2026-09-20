import { NextRequest, NextResponse } from "next/server";
import {
  listEmployeePoints,
  setEmployeePoints,
  type SetPointsInput,
} from "@/performance-development-dashboard/lib/performance/rewards";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  try {
    const points = await listEmployeePoints();
    if (points instanceof NextResponse) return points;

    return NextResponse.json(points);
  } catch (error) {
    console.error("GET /api/performance/rewards/points error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isRecord(rawBody)) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await setEmployeePoints(rawBody as SetPointsInput);
    if (result instanceof NextResponse) return result;

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/performance/rewards/points error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}