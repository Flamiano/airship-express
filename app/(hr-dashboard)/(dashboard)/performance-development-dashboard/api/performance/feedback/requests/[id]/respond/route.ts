import { NextRequest, NextResponse } from "next/server";
import {
  respondFeedbackRequest,
  type RespondFeedbackRequestValues,
} from "@/performance-development-dashboard/lib/performance/feedback";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isRecord(rawBody)) {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  try {
    const { id } = await params;

    const updated = await respondFeedbackRequest(
      id,
      rawBody as RespondFeedbackRequestValues
    );
    if (updated instanceof NextResponse) return updated;

    return NextResponse.json(updated);
  } catch (error) {
    console.error(
      "POST /api/performance/feedback/requests/[id]/respond error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
