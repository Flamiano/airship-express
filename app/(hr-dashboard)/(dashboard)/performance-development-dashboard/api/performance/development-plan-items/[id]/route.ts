import { NextRequest, NextResponse } from "next/server";
import {
  updateDevPlanItem,
  deleteDevPlanItem,
  type UpdateDevelopmentPlanItemInput,
  type DevPlanItemStatus,
} from "@/performance-development-dashboard/lib/performance/developmentPlanItems";
import { DEV_PLAN_ITEM_STATUSES } from "@/performance-development-dashboard/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PATCH(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await _request.json();

    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 },
      );
    }

    const input: UpdateDevelopmentPlanItemInput = {};
    if (body.action !== undefined) input.action = String(body.action);
    if (body.target !== undefined) input.target = String(body.target);
    if (body.status !== undefined) {
      input.status = (DEV_PLAN_ITEM_STATUSES as readonly string[]).includes(
        body.status as string,
      )
        ? (body.status as DevPlanItemStatus)
        : undefined;
    }

    const item = await updateDevPlanItem(id, input);
    if (item instanceof NextResponse) return item;

    return NextResponse.json(item);
  } catch (error) {
    console.error(
      "PATCH /api/performance/development-plan-items/[id] error:",
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await deleteDevPlanItem(id);
    return result;
  } catch (error) {
    console.error(
      "DELETE /api/performance/development-plan-items/[id] error:",
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
