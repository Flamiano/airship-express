import { NextRequest, NextResponse } from "next/server";
import { getFeedbackRequest } from "@/performance-development-dashboard/lib/performance/feedback";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const request = await getFeedbackRequest(id);
    if (request instanceof NextResponse) return request;

    return NextResponse.json(request);
  } catch (error) {
    console.error(
      "GET /api/performance/feedback/requests/[id] error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
