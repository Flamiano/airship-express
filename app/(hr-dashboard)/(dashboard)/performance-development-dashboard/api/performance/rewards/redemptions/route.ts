import { NextRequest, NextResponse } from "next/server";
import {
  createRewardRedemption,
  listRewardRedemptions,
  type RedemptionInput,
} from "@/performance-development-dashboard/lib/performance/rewards";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  try {
    const redemptions = await listRewardRedemptions();
    if (redemptions instanceof NextResponse) return redemptions;

    return NextResponse.json(redemptions);
  } catch (error) {
    console.error("GET /api/performance/rewards/redemptions error:", error);
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
    const redemption = await createRewardRedemption(rawBody as RedemptionInput);
    if (redemption instanceof NextResponse) return redemption;

    return NextResponse.json(redemption, { status: 201 });
  } catch (error) {
    console.error("POST /api/performance/rewards/redemptions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}