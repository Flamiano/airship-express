import { NextRequest, NextResponse } from "next/server";
import { reassignAppraisalEvaluator } from "@/performance-development-dashboard/lib/performance/appraisals";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Reassign the evaluator on an active appraisal (HR Admin only).
 *
 * Updates evaluator_id for an appraisal in "self_assessment" or
 * "manager_assessment" status. This exists because the originally assigned
 * manager may have left the organisation or become inactive before completing
 * their assessment.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isRecord(rawBody) || typeof rawBody.evaluator_id !== "string") {
    return NextResponse.json(
      { error: "evaluator_id is required and must be a string" },
      { status: 400 }
    );
  }

  try {
    const { id } = await context.params;

    const appraisal = await reassignAppraisalEvaluator(
      id,
      rawBody.evaluator_id
    );
    if (appraisal instanceof NextResponse) return appraisal;

    return NextResponse.json(appraisal);
  } catch (error) {
    console.error(
      "POST /api/performance/appraisals/[id]/reassign-evaluator error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
