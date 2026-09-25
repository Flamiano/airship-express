import { NextRequest, NextResponse } from "next/server";
import {
  createOwnGoalProposal,
  type CreateOwnGoalProposalInput,
} from "@/performance-development-dashboard/lib/performance/goals";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    const goal = await createOwnGoalProposal(
      rawBody as CreateOwnGoalProposalInput
    );
    if (goal instanceof NextResponse) return goal;

    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    console.error("POST /api/performance/goals/proposals error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
