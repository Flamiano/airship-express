import { NextRequest, NextResponse } from "next/server";
import {
  createCheckInMessage,
  type CreateCheckInMessageInput,
} from "@/performance-development-dashboard/lib/performance/checkins";

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

    const message = await createCheckInMessage(
      id,
      rawBody as CreateCheckInMessageInput
    );
    if (message instanceof NextResponse) return message;

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("POST /api/performance/checkins/[id]/messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}