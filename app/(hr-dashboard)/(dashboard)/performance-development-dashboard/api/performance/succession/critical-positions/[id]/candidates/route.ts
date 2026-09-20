import { NextRequest, NextResponse } from "next/server";
import {
  createSuccessionCandidate,
  listSuccessionCandidates,
  type ListSuccessionCandidatesQuery,
  type SuccessionCandidateInput,
} from "@/performance-development-dashboard/lib/performance/succession";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const query: ListSuccessionCandidatesQuery = {
      critical_position_id: id,
    };

    const candidates = await listSuccessionCandidates(query);
    if (candidates instanceof NextResponse) return candidates;

    return NextResponse.json(candidates);
  } catch (error) {
    console.error(
      "GET /api/performance/succession/critical-positions/[id]/candidates error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
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
    const { id } = await context.params;

    const candidate = await createSuccessionCandidate(
      id,
      rawBody as SuccessionCandidateInput
    );
    if (candidate instanceof NextResponse) return candidate;

    return NextResponse.json(candidate, { status: 201 });
  } catch (error) {
    console.error(
      "POST /api/performance/succession/critical-positions/[id]/candidates error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}