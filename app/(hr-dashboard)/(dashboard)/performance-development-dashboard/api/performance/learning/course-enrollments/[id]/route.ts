import { NextRequest, NextResponse } from "next/server";
import {
  getCourseEnrollment,
  updateCourseEnrollment,
  type UpdateCourseEnrollmentInput,
} from "@/performance-development-dashboard/lib/performance/learning";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const enrollment = await getCourseEnrollment(id);
    if (enrollment instanceof NextResponse) return enrollment;

    return NextResponse.json(enrollment);
  } catch (error) {
    console.error(
      "GET /api/performance/learning/course-enrollments/[id] error:",
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
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  try {
    const { id } = await context.params;

    const enrollment = await updateCourseEnrollment(
      id,
      rawBody as UpdateCourseEnrollmentInput
    );
    if (enrollment instanceof NextResponse) return enrollment;

    return NextResponse.json(enrollment);
  } catch (error) {
    console.error(
      "PATCH /api/performance/learning/course-enrollments/[id] error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}