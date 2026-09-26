import { NextResponse } from "next/server";
import { getMyDevelopment } from "@/performance-development-dashboard/lib/performance/myDevelopment";

export const dynamic = "force-dynamic";

/**
 * Employee My Development (self-scope, read-only).
 *
 * Paramless by design: employee identity is resolved server-side from the
 * authenticated actor inside `getMyDevelopment`. No query parameter selects
 * another employee — there is no identifier to tamper with. GET only.
 */
export async function GET() {
  try {
    const data = await getMyDevelopment();
    if (data instanceof NextResponse) return data;
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/performance/my-development error:", error);
    return NextResponse.json(
      { error: "Failed to load My Development." },
      { status: 500 },
    );
  }
}
