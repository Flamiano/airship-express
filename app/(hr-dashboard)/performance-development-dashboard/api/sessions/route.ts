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
import { getAuthenticatedHrUser, requireHrAdmin } from "../lib/auth";

export const dynamic = "force-dynamic";

const SESSION_TYPES = ["development", "mandatory"] as const;
const TRAINER_TYPES = ["internal", "external"] as const;

const SESSION_BODY_SCHEMA: Schema = {
  title: { type: "string", min: 1, max: 200 },
  trainer_name: { type: "string", min: 1, max: 200 },
  trainer_type: { type: "string", enum: TRAINER_TYPES },
  mode: { type: "string", min: 1, max: 100 },
  venue: { type: "string", optional: true, max: 500 },
  schedule_date: { type: "date" },
  capacity: { type: "number", integer: true, min: 1, max: 10000 },
  cost: { type: "number", min: 0 },
  session_type: { type: "string", optional: true, enum: SESSION_TYPES },
  competency_id: { type: "uuid", optional: true },
};

const SESSION_UPDATE_SCHEMA: Schema = {
  id: { type: "uuid" },
  title: { type: "string", optional: true, max: 200 },
  trainer_name: { type: "string", optional: true, max: 200 },
  trainer_type: { type: "string", optional: true, enum: TRAINER_TYPES },
  mode: { type: "string", optional: true, max: 100 },
  venue: { type: "string", optional: true, max: 500 },
  schedule_date: { type: "date", optional: true },
  capacity: { type: "number", optional: true, integer: true, min: 1, max: 10000 },
  cost: { type: "number", optional: true, min: 0 },
  session_type: { type: "string", optional: true, enum: SESSION_TYPES },
  competency_id: { type: "uuid", optional: true },
};

const SESSION_DELETE_SCHEMA: Schema = {
  id: { type: "uuid" },
};

export const GET = handle(async () => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from("hr3_training_sessions")
    .select("*, hr3_competencies(name)");

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ sessions: data ?? [] });
});

export const POST = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const parsed = await validateJson(request, SESSION_BODY_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  if (body.competency_id) {
    const { data: competency, error: competencyError } = await supabaseAdmin
      .from("hr3_competencies")
      .select("id")
      .eq("id", body.competency_id)
      .maybeSingle();

    if (competencyError) {
      return internalError(competencyError);
    }

    if (!competency) {
      return errorResponse(ERROR_CODES.NOT_FOUND, "Competency not found");
    }
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_training_sessions")
    .insert({
      title: body.title,
      trainer_name: body.trainer_name,
      trainer_type: body.trainer_type,
      mode: body.mode,
      venue: body.venue,
      schedule_date: body.schedule_date,
      capacity: body.capacity,
      cost: body.cost,
      session_type: body.session_type ?? "development",
      competency_id: body.competency_id || null,
    })
    .select();

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ session: data?.[0] }, { status: 201 });
});

export const PUT = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const parsed = await validateJson(request, SESSION_UPDATE_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const { data, error } = await supabaseAdmin
    .from("hr3_training_sessions")
    .update({
      title: body.title,
      trainer_name: body.trainer_name,
      trainer_type: body.trainer_type,
      mode: body.mode,
      venue: body.venue,
      schedule_date: body.schedule_date,
      capacity: body.capacity,
      cost: body.cost,
      session_type: body.session_type,
      competency_id: body.competency_id || null,
    })
    .eq("id", body.id)
    .select();

  if (error) {
    return internalError(error);
  }

  if (!data || data.length === 0) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Training session not found");
  }

  return NextResponse.json({ session: data[0] });
});

export const DELETE = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const errors = validateQuery(request.url, SESSION_DELETE_SCHEMA);
  if (errors.length > 0) return validationResponse(errors);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")!;

  const { data, error } = await supabaseAdmin
    .from("hr3_training_sessions")
    .delete()
    .eq("id", id)
    .select();

  if (error) {
    return internalError(error);
  }

  if (!data || data.length === 0) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Training session not found");
  }

  return NextResponse.json({ success: true });
});
