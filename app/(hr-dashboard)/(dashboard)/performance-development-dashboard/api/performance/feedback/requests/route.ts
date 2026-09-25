import { NextRequest, NextResponse } from "next/server";
import {
  createFeedbackRequest,
  listFeedbackRequests,
  type CreateFeedbackRequestValues,
} from "@/performance-development-dashboard/lib/performance/feedback";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  try {
    const requests = await listFeedbackRequests();
    if (requests instanceof NextResponse) return requests;

    return NextResponse.json(requests);
  } catch (error) {
    console.error("GET /api/performance/feedback/requests error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
    const created = await createFeedbackRequest(
      rawBody as CreateFeedbackRequestValues
    );
    if (created instanceof NextResponse) return created;

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/performance/feedback/requests error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
