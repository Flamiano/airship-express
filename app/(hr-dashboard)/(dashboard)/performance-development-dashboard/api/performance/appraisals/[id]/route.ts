import { NextRequest, NextResponse } from "next/server";
import { getAppraisal } from "@/performance-development-dashboard/lib/performance/appraisals";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const appraisal = await getAppraisal(id);
    if (appraisal instanceof NextResponse) return appraisal;

    return NextResponse.json(appraisal);
  } catch (error) {
    console.error("GET /api/performance/appraisals/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}