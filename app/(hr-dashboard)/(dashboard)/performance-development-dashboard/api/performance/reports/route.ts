import { NextRequest, NextResponse } from "next/server";
import { getPerformanceReports } from "@/performance-development-dashboard/lib/performance/reports";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const department = request.nextUrl.searchParams.get("department");
    const positionId = request.nextUrl.searchParams.get("position_id");
    const cycleId = request.nextUrl.searchParams.get("cycle_id");

    const snapshot = await getPerformanceReports({
      department,
      position_id: positionId,
      cycle_id: cycleId,
    });

    if (snapshot instanceof NextResponse) return snapshot;
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("GET /api/performance/reports error:", error);
    return NextResponse.json(
      { error: "Failed to load the reports snapshot." },
      { status: 500 },
    );
  }
}