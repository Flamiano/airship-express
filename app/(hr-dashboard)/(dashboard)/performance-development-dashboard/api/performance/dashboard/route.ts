import { NextResponse } from "next/server";
import { getPerformanceDashboard } from "@/performance-development-dashboard/lib/performance/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getPerformanceDashboard();
    if (snapshot instanceof NextResponse) return snapshot;

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("GET /api/performance/dashboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}