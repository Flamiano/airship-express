import { NextRequest, NextResponse } from "next/server";
import {
  createAppraisal,
  listAppraisals,
  type CreateAppraisalInput,
  type ListAppraisalsQuery,
} from "@/performance-development-dashboard/lib/performance/appraisals";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const query: ListAppraisalsQuery = {};
    const employeeId = searchParams.get("employee_id");
    if (employeeId) query.employee_id = employeeId;

    const appraisals = await listAppraisals(query);
    if (appraisals instanceof NextResponse) return appraisals;

    return NextResponse.json(appraisals);
  } catch (error) {
    console.error("GET /api/performance/appraisals error:", error);
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
    const appraisal = await createAppraisal(
      rawBody as CreateAppraisalInput
    );
    if (appraisal instanceof NextResponse) return appraisal;

    return NextResponse.json(appraisal, { status: 201 });
  } catch (error) {
    console.error("POST /api/performance/appraisals error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}