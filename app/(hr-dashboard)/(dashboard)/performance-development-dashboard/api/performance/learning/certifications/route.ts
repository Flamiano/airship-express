import { NextRequest, NextResponse } from "next/server";
import {
  createCertification,
  listCertifications,
  type CertificationInput,
  type ListCertificationsQuery,
} from "@/performance-development-dashboard/lib/performance/learning";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const query: ListCertificationsQuery = {};
    const employeeId = searchParams.get("employee_id");
    if (employeeId) query.employee_id = employeeId;

    const certifications = await listCertifications(query);
    if (certifications instanceof NextResponse) return certifications;

    return NextResponse.json(certifications);
  } catch (error) {
    console.error("GET /api/performance/learning/certifications error:", error);
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
    const certification = await createCertification(
      rawBody as CertificationInput
    );
    if (certification instanceof NextResponse) return certification;

    return NextResponse.json(certification, { status: 201 });
  } catch (error) {
    console.error(
      "POST /api/performance/learning/certifications error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}