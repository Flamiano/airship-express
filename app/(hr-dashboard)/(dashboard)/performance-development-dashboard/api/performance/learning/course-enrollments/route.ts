import { NextRequest, NextResponse } from "next/server";
import {
  createCourseEnrollment,
  listCourseEnrollments,
  type CourseEnrollmentInput,
  type ListCourseEnrollmentsQuery,
} from "@/performance-development-dashboard/lib/performance/learning";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const query: ListCourseEnrollmentsQuery = {};
    const employeeId = searchParams.get("employee_id");
    if (employeeId) query.employee_id = employeeId;

    const courseId = searchParams.get("course_id");
    if (courseId) query.course_id = courseId;

    const enrollments = await listCourseEnrollments(query);
    if (enrollments instanceof NextResponse) return enrollments;

    return NextResponse.json(enrollments);
  } catch (error) {
    console.error("GET /api/performance/learning/course-enrollments error:", error);
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
    const enrollment = await createCourseEnrollment(
      rawBody as CourseEnrollmentInput
    );
    if (enrollment instanceof NextResponse) return enrollment;

    return NextResponse.json(enrollment, { status: 201 });
  } catch (error) {
    console.error(
      "POST /api/performance/learning/course-enrollments error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}