import { NextRequest, NextResponse } from "next/server";
import { getAppraisalLeaveContext } from "@/performance-development-dashboard/lib/performance/leaveContext";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Returns currently-Approved Leave request ranges overlapping the subject
 * and cycle period of an authorized appraisal. Read-only and supplemental:
 * appraisal scope is enforced server-side first (no appraisal access = no
 * context), and HR2 outages degrade to an "unavailable" context without
 * blocking the appraisal workflow. Never affects scoring.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const payload = await getAppraisalLeaveContext(id);
    if (payload instanceof NextResponse) return payload;

    return NextResponse.json(payload);
  } catch (error) {
    console.error(
      "GET /api/performance/appraisals/[id]/leave-context error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
