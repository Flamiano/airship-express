import { NextRequest, NextResponse } from "next/server";
import {
  deleteCriticalPosition,
  getCriticalPosition,
  updateCriticalPosition,
  type UpdateCriticalPositionInput,
} from "@/performance-development-dashboard/lib/performance/succession";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const position = await getCriticalPosition(id);
    if (position instanceof NextResponse) return position;

    return NextResponse.json(position);
  } catch (error) {
    console.error(
      "GET /api/performance/succession/critical-positions/[id] error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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
    const { id } = await context.params;

    const position = await updateCriticalPosition(
      id,
      rawBody as UpdateCriticalPositionInput
    );
    if (position instanceof NextResponse) return position;

    return NextResponse.json(position);
  } catch (error) {
    console.error(
      "PATCH /api/performance/succession/critical-positions/[id] error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const result = await deleteCriticalPosition(id);
    if (result instanceof NextResponse) return result;

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "DELETE /api/performance/succession/critical-positions/[id] error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}