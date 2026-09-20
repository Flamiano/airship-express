import { NextRequest, NextResponse } from "next/server";
import { openPerformanceCycle } from "@/performance-development-dashboard/lib/performance/cycles";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const cycle = await openPerformanceCycle(id);
    if (cycle instanceof NextResponse) return cycle;

    return NextResponse.json(cycle);
  } catch (error) {
    console.error("POST /api/performance/cycles/[id]/open error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}