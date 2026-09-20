import { NextRequest, NextResponse } from "next/server";
import { markNotificationRead } from "@/performance-development-dashboard/lib/performance/notifications";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await markNotificationRead(id);
    if (result instanceof NextResponse) return result;
    return NextResponse.json(result);
  } catch (error) {
    console.error("PATCH /api/performance/notifications/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
