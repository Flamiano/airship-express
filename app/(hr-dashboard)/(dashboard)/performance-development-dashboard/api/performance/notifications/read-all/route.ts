import { NextResponse } from "next/server";
import { markAllNotificationsRead } from "@/performance-development-dashboard/lib/performance/notifications";

export const dynamic = "force-dynamic";

export async function PATCH() {
  try {
    const result = await markAllNotificationsRead();
    if (result instanceof NextResponse) return result;
    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "PATCH /api/performance/notifications/read-all error:",
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
