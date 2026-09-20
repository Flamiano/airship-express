import { NextRequest, NextResponse } from "next/server";
import { getRecognition } from "@/performance-development-dashboard/lib/performance/rewards";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const recognition = await getRecognition(id);
    if (recognition instanceof NextResponse) return recognition;

    return NextResponse.json(recognition);
  } catch (error) {
    console.error(
      "GET /api/performance/rewards/recognitions/[id] error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}