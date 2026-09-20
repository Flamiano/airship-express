import { NextRequest, NextResponse } from "next/server";
import {
  listDevPlanItems,
  createDevPlanItem,
  type CreateDevelopmentPlanItemInput,
  type DevPlanItemStatus,
} from "@/performance-development-dashboard/lib/performance/developmentPlanItems";
import { DEV_PLAN_ITEM_STATUSES } from "@/performance-development-dashboard/types";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const appraisalId = searchParams.get("appraisal_id");

    if (!appraisalId) {
      return NextResponse.json(
        { error: "appraisal_id is required." },
        { status: 400 },
      );
    }

    const items = await listDevPlanItems(appraisalId);
    if (items instanceof NextResponse) return items;

    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/performance/development-plan-items error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 },
      );
    }

    const appraisalId = body.appraisal_id;
    if (typeof appraisalId !== "string" || !appraisalId) {
      return NextResponse.json(
        { error: "appraisal_id is required." },
        { status: 400 },
      );
    }

    const input: CreateDevelopmentPlanItemInput = {
      action: String(body.action ?? ""),
      target: String(body.target ?? ""),
      status: (DEV_PLAN_ITEM_STATUSES as readonly string[]).includes(
        body.status as string,
      )
        ? (body.status as DevPlanItemStatus)
        : undefined,
    };

    const item = await createDevPlanItem(appraisalId, input);
    if (item instanceof NextResponse) return item;

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/performance/development-plan-items error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
