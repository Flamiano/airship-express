import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import {
  ERROR_CODES,
  errorResponse,
  handle,
  internalError,
  validateJson,
  validateQuery,
  validationResponse,
  type Schema,
} from "../lib/validate";
import { requireHrAdmin } from "../lib/auth";

export const dynamic = "force-dynamic";

const RISK_LEVELS = ["low", "medium", "high"] as const;

const CRITICAL_POSITION_BODY_SCHEMA: Schema = {
  position_id: { type: "uuid" },
  risk_level: { type: "string", optional: true, enum: RISK_LEVELS },
  reason: { type: "string", optional: true, max: 1000 },
};

const CRITICAL_POSITION_DELETE_SCHEMA: Schema = {
  id: { type: "uuid" },
};

export const GET = handle(async () => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const { data, error } = await supabaseAdmin
    .from("hr3_critical_positions")
    .select("*");

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ positions: data ?? [] });
});

export const POST = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const parsed = await validateJson(request, CRITICAL_POSITION_BODY_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const { data, error } = await supabaseAdmin
    .from("hr3_critical_positions")
    .insert({
      position_id: body.position_id,
      risk_level: body.risk_level || "medium",
      reason: body.reason,
    })
    .select();

  if (error) {
    if (error.code === "23505") {
      return errorResponse(ERROR_CODES.CONFLICT, "This position is already flagged as critical");
    }
    return internalError(error);
  }

  return NextResponse.json({ position: data?.[0] }, { status: 201 });
});

export const DELETE = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const errors = validateQuery(request.url, CRITICAL_POSITION_DELETE_SCHEMA);
  if (errors.length > 0) return validationResponse(errors);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")!;

  const { data, error } = await supabaseAdmin
    .from("hr3_critical_positions")
    .delete()
    .eq("id", id)
    .select();

  if (error) {
    if (error.code === "23503") {
      return errorResponse(ERROR_CODES.CONFLICT, "Remove this position's candidates first");
    }
    return internalError(error);
  }

  if (!data || data.length === 0) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Critical position not found");
  }

  return NextResponse.json({ success: true });
});
