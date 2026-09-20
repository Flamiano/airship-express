import { NextRequest, NextResponse } from "next/server";
import {
  createPerformanceCycle,
  listPerformanceCycles,
} from "@/performance-development-dashboard/lib/performance/cycles";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  try {
    const cycles = await listPerformanceCycles();
    if (cycles instanceof NextResponse) return cycles;

    return NextResponse.json(cycles);
  } catch (error) {
    console.error("GET /api/performance/cycles error:", error);
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
    const cycle = await createPerformanceCycle(rawBody);
    if (cycle instanceof NextResponse) return cycle;

    return NextResponse.json(cycle, { status: 201 });
  } catch (error) {
    console.error("POST /api/performance/cycles error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}