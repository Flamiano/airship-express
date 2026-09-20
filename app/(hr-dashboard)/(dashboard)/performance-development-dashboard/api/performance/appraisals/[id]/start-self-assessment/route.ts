import { NextRequest, NextResponse } from "next/server";
import { startSelfAssessmentByHrAdmin } from "@/performance-development-dashboard/lib/performance/appraisals";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Start self-assessment for a legacy draft appraisal (HR Admin only).
 *
 * Transitions an appraisal from "draft" to "self_assessment". This exists
 * because some older appraisals were created with "draft" status and never
 * advanced through the normal lifecycle.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const appraisal = await startSelfAssessmentByHrAdmin(id);
    if (appraisal instanceof NextResponse) return appraisal;

    return NextResponse.json(appraisal);
  } catch (error) {
    console.error(
      "POST /api/performance/appraisals/[id]/start-self-assessment error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
