import { NextRequest, NextResponse } from "next/server";
import {
  createCourse,
  listCourses,
  type CourseInput,
  type ListCoursesQuery,
} from "@/performance-development-dashboard/lib/performance/learning";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const query: ListCoursesQuery = {};
    const search = searchParams.get("search");
    if (search) query.search = search;

    const competencyId = searchParams.get("competency_id");
    if (competencyId) query.competency_id = competencyId;

    const courses = await listCourses(query);
    if (courses instanceof NextResponse) return courses;

    return NextResponse.json(courses);
  } catch (error) {
    console.error("GET /api/performance/learning/courses error:", error);
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
    const course = await createCourse(rawBody as CourseInput);
    if (course instanceof NextResponse) return course;

    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    console.error("POST /api/performance/learning/courses error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}