import { NextRequest, NextResponse } from "next/server";
import {
  getPerformanceGoal,
  updatePerformanceGoal,
  type UpdatePerformanceGoalInput,
} from "@/performance-development-dashboard/lib/performance/goals";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const goal = await getPerformanceGoal(id);
    if (goal instanceof NextResponse) return goal;

    return NextResponse.json(goal);
  } catch (error) {
    console.error("GET /api/performance/goals/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;

    const goal = await updatePerformanceGoal(
      id,
      rawBody as UpdatePerformanceGoalInput
    );
    if (goal instanceof NextResponse) return goal;

    return NextResponse.json(goal);
  } catch (error) {
    console.error("PATCH /api/performance/goals/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}