import { NextRequest, NextResponse } from "next/server";
import { getAppraisalAnalyticsForIntegration } from "@/performance-development-dashboard/lib/performance/analyticsIntegration";

export const dynamic = "force-dynamic";

/**
 * PerDev-owned appraisal analytics for downstream HR Analytics
 * (Phase 6 Part 3). READ-only, aggregate-only.
 *
 * Restricted to the existing PerDev HR-admin scope — no new roles or
 * service accounts are invented. A narrower downstream read permission
 * remains a future design dependency.
 *
 * `cycleId` is REQUIRED (no default cycle, no date/year inference, no
 * all-history mode). Only finalized/acknowledged appraisals contribute;
 * zero eligible rows yields a valid zero aggregate (never fabricated
 * scores). Unknown query parameters have no effect.
 */
export async function GET(request: NextRequest) {
  try {
    const cycleId = request.nextUrl.searchParams.get("cycleId");

    const payload = await getAppraisalAnalyticsForIntegration(cycleId);
    if (payload instanceof NextResponse) return payload;

    return NextResponse.json(payload);
  } catch (error) {
    console.error(
      "GET /api/performance/integrations/analytics/appraisals error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
