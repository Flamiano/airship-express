import { NextRequest, NextResponse } from "next/server";
import {
  createTrainingEvaluation,
  listTrainingEvaluations,
  type ListTrainingEvaluationsQuery,
  type TrainingEvaluationInput,
} from "@/performance-development-dashboard/lib/performance/learning";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const query: ListTrainingEvaluationsQuery = {};
    const sessionId = searchParams.get("session_id");
    if (sessionId) query.session_id = sessionId;

    const employeeId = searchParams.get("employee_id");
    if (employeeId) query.employee_id = employeeId;

    const evaluations = await listTrainingEvaluations(query);
    if (evaluations instanceof NextResponse) return evaluations;

    return NextResponse.json(evaluations);
  } catch (error) {
    console.error(
      "GET /api/performance/learning/training-evaluations error:",
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
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  try {
    const evaluation = await createTrainingEvaluation(
      rawBody as TrainingEvaluationInput
    );
    if (evaluation instanceof NextResponse) return evaluation;

    return NextResponse.json(evaluation, { status: 201 });
  } catch (error) {
    console.error(
      "POST /api/performance/learning/training-evaluations error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}