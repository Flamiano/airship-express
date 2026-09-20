import { NextRequest, NextResponse } from "next/server";
import { acknowledgeCheckIn } from "@/performance-development-dashboard/lib/performance/checkins";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const acknowledgment = await acknowledgeCheckIn(id);
    if (acknowledgment instanceof NextResponse) return acknowledgment;

    return NextResponse.json(acknowledgment);
  } catch (error) {
    console.error(
      "POST /api/performance/checkins/[id]/acknowledge error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}