import { NextRequest, NextResponse } from "next/server";
import { acknowledgeAppraisal } from "@/performance-development-dashboard/lib/performance/appraisals";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const appraisal = await acknowledgeAppraisal(id);
    if (appraisal instanceof NextResponse) return appraisal;

    return NextResponse.json(appraisal);
  } catch (error) {
    console.error(
      "POST /api/performance/appraisals/[id]/acknowledge error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}