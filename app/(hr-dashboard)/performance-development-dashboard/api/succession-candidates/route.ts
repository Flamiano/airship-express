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

const READINESS_LEVELS = ["ready_now", "1-2_years", "3+_years"] as const;

const RATING_SCHEMA = { type: "number", min: 1, max: 5 } as const;

const CANDIDATE_BODY_SCHEMA: Schema = {
  position_id: { type: "uuid" },
  employee_id: { type: "uuid" },
  readiness_level: { type: "string", enum: READINESS_LEVELS },
  potential_rating: RATING_SCHEMA,
  performance_rating: RATING_SCHEMA,
  development_notes: { type: "string", optional: true, max: 2000 },
};

const CANDIDATE_UPDATE_SCHEMA: Schema = {
  id: { type: "uuid" },
  readiness_level: { type: "string", optional: true, enum: READINESS_LEVELS },
  potential_rating: { type: "number", optional: true, min: 1, max: 5 },
  performance_rating: { type: "number", optional: true, min: 1, max: 5 },
  development_notes: { type: "string", optional: true, max: 2000 },
};

const CANDIDATE_DELETE_SCHEMA: Schema = {
  id: { type: "uuid" },
};

export const GET = handle(async () => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const { data, error } = await supabaseAdmin
    .from("hr3_succession_candidates")
    .select("*, hr3_critical_positions(*)");

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ candidates: data ?? [] });
});

export const POST = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const parsed = await validateJson(request, CANDIDATE_BODY_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const { data: position, error: positionError } = await supabaseAdmin
    .from("hr3_critical_positions")
    .select("id")
    .eq("id", body.position_id)
    .maybeSingle();

  if (positionError) {
    return internalError(positionError);
  }

  if (!position) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Critical position not found");
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_succession_candidates")
    .insert({
      position_id: body.position_id,
      employee_id: body.employee_id,
      readiness_level: body.readiness_level,
      potential_rating: body.potential_rating,
      performance_rating: body.performance_rating,
      development_notes: body.development_notes,
    })
    .select();

  if (error) {
    if (error.code === "23505") {
      return errorResponse(ERROR_CODES.CONFLICT, "This employee is already a candidate for this position");
    }
    return internalError(error);
  }

  return NextResponse.json({ candidate: data?.[0] }, { status: 201 });
});

export const PUT = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const parsed = await validateJson(request, CANDIDATE_UPDATE_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const { data, error } = await supabaseAdmin
    .from("hr3_succession_candidates")
    .update({
      readiness_level: body.readiness_level,
      potential_rating: body.potential_rating,
      performance_rating: body.performance_rating,
      development_notes: body.development_notes,
    })
    .eq("id", body.id)
    .select();

  if (error) {
    return internalError(error);
  }

  if (!data || data.length === 0) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Succession candidate not found");
  }

  return NextResponse.json({ candidate: data[0] });
});

export const DELETE = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const errors = validateQuery(request.url, CANDIDATE_DELETE_SCHEMA);
  if (errors.length > 0) return validationResponse(errors);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")!;

  const { data, error } = await supabaseAdmin
    .from("hr3_succession_candidates")
    .delete()
    .eq("id", id)
    .select();

  if (error) {
    return internalError(error);
  }

  if (!data || data.length === 0) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Succession candidate not found");
  }

  return NextResponse.json({ success: true });
});
