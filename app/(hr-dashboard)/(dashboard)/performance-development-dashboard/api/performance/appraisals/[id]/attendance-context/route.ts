import { NextRequest, NextResponse } from "next/server";
import { getAppraisalAttendanceContext } from "@/performance-development-dashboard/lib/performance/attendanceContext";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Returns raw Time & Attendance activity context for the subject and cycle
 * period of an authorized appraisal. Read-only and supplemental: appraisal
 * scope is enforced server-side first (no appraisal access = no context),
 * and HR2 outages degrade to an "unavailable" context without blocking the
 * appraisal workflow. Never affects scoring.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const payload = await getAppraisalAttendanceContext(id);
    if (payload instanceof NextResponse) return payload;

    return NextResponse.json(payload);
  } catch (error) {
    console.error(
      "GET /api/performance/appraisals/[id]/attendance-context error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
