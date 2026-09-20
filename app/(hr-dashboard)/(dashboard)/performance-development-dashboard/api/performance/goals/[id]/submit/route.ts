import { NextRequest, NextResponse } from "next/server";
import { submitGoalCompletion } from "@/performance-development-dashboard/lib/performance/goals";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const goal = await submitGoalCompletion(id);
    if (goal instanceof NextResponse) return goal;

    return NextResponse.json(goal);
  } catch (error) {
    console.error("POST /api/performance/goals/[id]/submit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}