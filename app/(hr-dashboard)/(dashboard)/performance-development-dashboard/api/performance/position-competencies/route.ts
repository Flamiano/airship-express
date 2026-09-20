import { NextRequest, NextResponse } from "next/server";
import {
  createPositionCompetencyRequirement,
  listPositionCompetencyRequirements,
  type ListPositionRequirementsQuery,
  type PositionCompetencyRequirementInput,
} from "@/performance-development-dashboard/lib/performance/competencies";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const query: ListPositionRequirementsQuery = {};
    const positionId = searchParams.get("position_id");
    if (positionId) query.position_id = positionId;

    const requirements = await listPositionCompetencyRequirements(query);
    if (requirements instanceof NextResponse) return requirements;

    return NextResponse.json(requirements);
  } catch (error) {
    console.error(
      "GET /api/performance/position-competencies error:",
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
    const requirement = await createPositionCompetencyRequirement(
      rawBody as PositionCompetencyRequirementInput
    );
    if (requirement instanceof NextResponse) return requirement;

    return NextResponse.json(requirement, { status: 201 });
  } catch (error) {
    console.error(
      "POST /api/performance/position-competencies error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}