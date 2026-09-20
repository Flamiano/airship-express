import { NextRequest, NextResponse } from "next/server";
import {
  listSuccessionCandidates,
  type ListSuccessionCandidatesQuery,
} from "@/performance-development-dashboard/lib/performance/succession";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const query: ListSuccessionCandidatesQuery = {};
    const criticalPositionId = searchParams.get("critical_position_id");
    if (criticalPositionId) query.critical_position_id = criticalPositionId;

    const candidates = await listSuccessionCandidates(query);
    if (candidates instanceof NextResponse) return candidates;

    return NextResponse.json(candidates);
  } catch (error) {
    console.error(
      "GET /api/performance/succession/candidates error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}