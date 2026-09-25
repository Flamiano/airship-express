import { NextRequest, NextResponse } from "next/server";
import { listFinalizedAppraisalsForCompensation } from "@/performance-development-dashboard/lib/performance/compensationIntegration";

export const dynamic = "force-dynamic";

/**
 * PerDev-owned authoritative finalized-appraisal feed for downstream
 * integrations (Phase 5 Part 3B). READ-only.
 *
 * Restricted to the existing PerDev HR-admin scope — no new roles or
 * service accounts are invented. A narrower downstream integration read
 * permission remains a future design dependency.
 *
 * Optional filters (employeeId, appraisalId, cycleId) only narrow
 * server-side PerDev data; result facts are never accepted from the
 * caller. Only finalized/acknowledged appraisals with valid persisted
 * results are returned; zero eligible rows yields `{ appraisals: [] }`.
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const payload = await listFinalizedAppraisalsForCompensation({
      employeeId: params.get("employeeId"),
      appraisalId: params.get("appraisalId"),
      cycleId: params.get("cycleId"),
    });
    if (payload instanceof NextResponse) return payload;

    return NextResponse.json(payload);
  } catch (error) {
    console.error(
      "GET /api/performance/integrations/compensation/finalized-appraisals error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
