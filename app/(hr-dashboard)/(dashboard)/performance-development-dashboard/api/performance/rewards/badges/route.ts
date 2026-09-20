import { NextRequest, NextResponse } from "next/server";
import {
  createBadge,
  listBadges,
  type BadgeInput,
} from "@/performance-development-dashboard/lib/performance/rewards";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  try {
    const badges = await listBadges();
    if (badges instanceof NextResponse) return badges;

    return NextResponse.json(badges);
  } catch (error) {
    console.error("GET /api/performance/rewards/badges error:", error);
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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const badge = await createBadge(rawBody as BadgeInput);
    if (badge instanceof NextResponse) return badge;

    return NextResponse.json(badge, { status: 201 });
  } catch (error) {
    console.error("POST /api/performance/rewards/badges error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}