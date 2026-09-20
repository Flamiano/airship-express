import { NextRequest, NextResponse } from "next/server";
import { finalizeAppraisal } from "@/performance-development-dashboard/lib/performance/appraisals";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Finalize an appraisal.
 *
 * Reads existing Manager-persisted goal and competency ratings from the
 * appraisal result tables and computes the official final score.
 * No scoring input is required in the request body.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const appraisal = await finalizeAppraisal(id);
    if (appraisal instanceof NextResponse) return appraisal;

    return NextResponse.json(appraisal);
  } catch (error) {
    console.error(
      "POST /api/performance/appraisals/[id]/finalize error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}