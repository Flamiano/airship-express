import { NextRequest, NextResponse } from "next/server";
import {
  createRecognition,
  listRecognitions,
  type RecognitionInput,
} from "@/performance-development-dashboard/lib/performance/rewards";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  try {
    const recognitions = await listRecognitions();
    if (recognitions instanceof NextResponse) return recognitions;

    return NextResponse.json(recognitions);
  } catch (error) {
    console.error("GET /api/performance/rewards/recognitions error:", error);
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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const recognition = await createRecognition(rawBody as RecognitionInput);
    if (recognition instanceof NextResponse) return recognition;

    return NextResponse.json(recognition, { status: 201 });
  } catch (error) {
    console.error("POST /api/performance/rewards/recognitions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}