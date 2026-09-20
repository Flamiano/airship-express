import { NextRequest, NextResponse } from "next/server";
import {
  createTrainingSession,
  listTrainingSessions,
  type ListTrainingSessionsQuery,
  type TrainingSessionInput,
} from "@/performance-development-dashboard/lib/performance/learning";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const query: ListTrainingSessionsQuery = {};
    const search = searchParams.get("search");
    if (search) query.search = search;

    const sessions = await listTrainingSessions(query);
    if (sessions instanceof NextResponse) return sessions;

    return NextResponse.json(sessions);
  } catch (error) {
    console.error(
      "GET /api/performance/learning/training-sessions error:",
      error
    );
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
    const session = await createTrainingSession(rawBody as TrainingSessionInput);
    if (session instanceof NextResponse) return session;

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error(
      "POST /api/performance/learning/training-sessions error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}