import { NextRequest, NextResponse } from "next/server";
import { getDevelopmentProfile } from "@/performance-development-dashboard/lib/performance/development";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const employeeId = request.nextUrl.searchParams.get("employee_id");
    const profile = await getDevelopmentProfile({ employee_id: employeeId });
    if (profile instanceof NextResponse) return profile;
    return NextResponse.json(profile);
  } catch (error) {
    console.error("GET /api/performance/development error:", error);
    return NextResponse.json(
      { error: "Failed to load the development profile." },
      { status: 500 },
    );
  }
}