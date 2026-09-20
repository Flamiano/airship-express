import { NextRequest, NextResponse } from "next/server";
import {
  createCriticalPosition,
  listCriticalPositions,
  type CriticalPositionInput,
  type ListCriticalPositionsQuery,
} from "@/performance-development-dashboard/lib/performance/succession";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const query: ListCriticalPositionsQuery = {};
    const jobPositionId = searchParams.get("job_position_id");
    if (jobPositionId) query.job_position_id = jobPositionId;

    const positions = await listCriticalPositions(query);
    if (positions instanceof NextResponse) return positions;

    return NextResponse.json(positions);
  } catch (error) {
    console.error(
      "GET /api/performance/succession/critical-positions error:",
      error
    );
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
    const position = await createCriticalPosition(
      rawBody as CriticalPositionInput
    );
    if (position instanceof NextResponse) return position;

    return NextResponse.json(position, { status: 201 });
  } catch (error) {
    console.error(
      "POST /api/performance/succession/critical-positions error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}