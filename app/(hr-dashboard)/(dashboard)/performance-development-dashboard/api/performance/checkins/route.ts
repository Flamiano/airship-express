import { NextRequest, NextResponse } from "next/server";
import {
  createCheckIn,
  listCheckIns,
  type CreatePerformanceCheckInInput,
  type ListCheckInsQuery,
} from "@/performance-development-dashboard/lib/performance/checkins";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const query: ListCheckInsQuery = {};
    const employeeId = searchParams.get("employee_id");
    if (employeeId) query.employee_id = employeeId;

    const checkIns = await listCheckIns(query);
    if (checkIns instanceof NextResponse) return checkIns;

    return NextResponse.json(checkIns);
  } catch (error) {
    console.error("GET /api/performance/checkins error:", error);
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
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  try {
    const checkIn = await createCheckIn(
      rawBody as CreatePerformanceCheckInInput
    );
    if (checkIn instanceof NextResponse) return checkIn;

    return NextResponse.json(checkIn, { status: 201 });
  } catch (error) {
    console.error("POST /api/performance/checkins error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}