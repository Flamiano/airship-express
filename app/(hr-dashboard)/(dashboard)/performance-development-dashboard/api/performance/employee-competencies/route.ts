import { NextRequest, NextResponse } from "next/server";
import {
  createEmployeeCompetencyAssessment,
  listEmployeeCompetencies,
  type EmployeeCompetencyAssessmentInput,
  type ListEmployeeCompetenciesQuery,
} from "@/performance-development-dashboard/lib/performance/competencies";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const query: ListEmployeeCompetenciesQuery = {};
    const employeeId = searchParams.get("employee_id");
    if (employeeId) query.employee_id = employeeId;

    const competencyId = searchParams.get("competency_id");
    if (competencyId) query.competency_id = competencyId;

    const profile = await listEmployeeCompetencies(query);
    if (profile instanceof NextResponse) return profile;

    return NextResponse.json(profile);
  } catch (error) {
    console.error(
      "GET /api/performance/employee-competencies error:",
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
    const assessment = await createEmployeeCompetencyAssessment(
      rawBody as EmployeeCompetencyAssessmentInput
    );
    if (assessment instanceof NextResponse) return assessment;

    return NextResponse.json(assessment, { status: 201 });
  } catch (error) {
    console.error(
      "POST /api/performance/employee-competencies error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}