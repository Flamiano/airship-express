import { NextRequest, NextResponse } from "next/server";
import { submitGoalProposal } from "@/performance-development-dashboard/lib/performance/goals";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const goal = await submitGoalProposal(id);
    if (goal instanceof NextResponse) return goal;

    return NextResponse.json(goal);
  } catch (error) {
    console.error(
      "POST /api/performance/goals/[id]/submit-proposal error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
