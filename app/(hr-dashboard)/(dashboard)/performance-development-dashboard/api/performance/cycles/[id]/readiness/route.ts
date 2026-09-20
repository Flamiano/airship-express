import { NextRequest, NextResponse } from "next/server";
import { getCycleReadiness } from "@/performance-development-dashboard/lib/performance/cycles";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const readiness = await getCycleReadiness(id);
    if (readiness instanceof NextResponse) return readiness;

    return NextResponse.json(readiness);
  } catch (error) {
    console.error("GET /api/performance/cycles/[id]/readiness error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
