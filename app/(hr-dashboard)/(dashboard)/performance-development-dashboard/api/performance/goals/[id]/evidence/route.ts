import { NextRequest, NextResponse } from "next/server";
import {
  createGoalEvidence,
  listGoalEvidence,
  type CreateGoalEvidenceInput,
} from "@/performance-development-dashboard/lib/performance/goalEvidence";

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

    const evidence = await listGoalEvidence(id);
    if (evidence instanceof NextResponse) return evidence;

    return NextResponse.json(evidence);
  } catch (error) {
    console.error("GET /api/performance/goals/[id]/evidence error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
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

    const created = await createGoalEvidence(
      id,
      rawBody as CreateGoalEvidenceInput
    );
    if (created instanceof NextResponse) return created;

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/performance/goals/[id]/evidence error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}