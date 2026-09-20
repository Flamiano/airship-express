import { NextRequest, NextResponse } from "next/server";
import {
  deleteSuccessionCandidate,
  getSuccessionCandidate,
  updateSuccessionCandidate,
  type UpdateSuccessionCandidateInput,
} from "@/performance-development-dashboard/lib/performance/succession";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const candidate = await getSuccessionCandidate(id);
    if (candidate instanceof NextResponse) return candidate;

    return NextResponse.json(candidate);
  } catch (error) {
    console.error(
      "GET /api/performance/succession/candidates/[id] error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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

    const candidate = await updateSuccessionCandidate(
      id,
      rawBody as UpdateSuccessionCandidateInput
    );
    if (candidate instanceof NextResponse) return candidate;

    return NextResponse.json(candidate);
  } catch (error) {
    console.error(
      "PATCH /api/performance/succession/candidates/[id] error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const result = await deleteSuccessionCandidate(id);
    if (result instanceof NextResponse) return result;

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "DELETE /api/performance/succession/candidates/[id] error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}