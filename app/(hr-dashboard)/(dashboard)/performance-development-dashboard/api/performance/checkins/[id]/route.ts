import { NextRequest, NextResponse } from "next/server";
import { listCheckInThread } from "@/performance-development-dashboard/lib/performance/checkins";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const thread = await listCheckInThread(id);
    if (thread instanceof NextResponse) return thread;

    return NextResponse.json(thread);
  } catch (error) {
    console.error("GET /api/performance/checkins/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}