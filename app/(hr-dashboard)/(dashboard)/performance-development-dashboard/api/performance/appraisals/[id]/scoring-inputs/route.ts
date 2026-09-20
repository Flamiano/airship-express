import { NextRequest, NextResponse } from "next/server";
import { getAppraisalScoringInputs } from "@/performance-development-dashboard/lib/performance/appraisals";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Returns the scoring inventory for a given appraisal: the applicable goals
 * (with weights) and applicable competencies the reviewer must rate, plus any
 * ratings already persisted. Reviewer-only.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const payload = await getAppraisalScoringInputs(id);
    if (payload instanceof NextResponse) return payload;

    return NextResponse.json(payload);
  } catch (error) {
    console.error(
      "GET /api/performance/appraisals/[id]/scoring-inputs error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}