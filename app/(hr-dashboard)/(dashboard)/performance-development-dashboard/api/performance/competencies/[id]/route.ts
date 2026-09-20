import { NextRequest, NextResponse } from "next/server";
import {
  getCompetency,
  updateCompetency,
  type CompetencyInput,
} from "@/performance-development-dashboard/lib/performance/competencies";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const competency = await getCompetency(id);
    if (competency instanceof NextResponse) return competency;

    return NextResponse.json(competency);
  } catch (error) {
    console.error("GET /api/performance/competencies/[id] error:", error);
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
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  try {
    const { id } = await context.params;

    const competency = await updateCompetency(id, rawBody as CompetencyInput);
    if (competency instanceof NextResponse) return competency;

    return NextResponse.json(competency);
  } catch (error) {
    console.error("PATCH /api/performance/competencies/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}