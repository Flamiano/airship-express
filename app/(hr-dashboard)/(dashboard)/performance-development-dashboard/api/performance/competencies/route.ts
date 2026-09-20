import { NextRequest, NextResponse } from "next/server";
import {
  createCompetency,
  listCompetencies,
  type CompetencyInput,
  type ListCompetenciesQuery,
} from "@/performance-development-dashboard/lib/performance/competencies";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const query: ListCompetenciesQuery = {};
    const search = searchParams.get("search");
    if (search) query.search = search;

    const category = searchParams.get("category");
    if (category) query.category = category;

    const competencies = await listCompetencies(query);
    if (competencies instanceof NextResponse) return competencies;

    return NextResponse.json(competencies);
  } catch (error) {
    console.error("GET /api/performance/competencies error:", error);
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
    const competency = await createCompetency(rawBody as CompetencyInput);
    if (competency instanceof NextResponse) return competency;

    return NextResponse.json(competency, { status: 201 });
  } catch (error) {
    console.error("POST /api/performance/competencies error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}