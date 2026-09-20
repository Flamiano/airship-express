import { NextResponse } from "next/server";
import {
  listNotifications,
  getUnreadCount,
} from "@/performance-development-dashboard/lib/performance/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [notifications, unreadCount] = await Promise.all([
      listNotifications(),
      getUnreadCount(),
    ]);

    if (notifications instanceof NextResponse) return notifications;

    return NextResponse.json({
      notifications,
      unreadCount: typeof unreadCount === "number" ? unreadCount : 0,
    });
  } catch (error) {
    console.error("GET /api/performance/notifications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
