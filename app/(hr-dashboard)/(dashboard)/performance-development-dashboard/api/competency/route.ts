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

const COMPETENCY_BODY_SCHEMA: Schema = {
  name: { type: "string", min: 1, max: 200 },
  description: { type: "string", optional: true, max: 1000 },
  category: { type: "string", optional: true, max: 100 },
};

const COMPETENCY_UPDATE_SCHEMA: Schema = {
  id: { type: "uuid" },
  name: { type: "string", optional: true, max: 200 },
  description: { type: "string", optional: true, max: 1000 },
  category: { type: "string", optional: true, max: 100 },
};

const COMPETENCY_DELETE_SCHEMA: Schema = {
  id: { type: "uuid" },
};

export const GET = handle(async () => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin.from("hr3_competencies").select("*");

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ competencies: data ?? [] });
});

export const POST = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const parsed = await validateJson(request, COMPETENCY_BODY_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const { data, error } = await supabaseAdmin
    .from("hr3_competencies")
    .insert({
      name: body.name,
      description: body.description,
      category: body.category,
    })
    .select();

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ competency: data?.[0] }, { status: 201 });
});

export const PUT = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const parsed = await validateJson(request, COMPETENCY_UPDATE_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const { data, error } = await supabaseAdmin
    .from("hr3_competencies")
    .update({
      name: body.name,
      description: body.description,
      category: body.category,
    })
    .eq("id", body.id)
    .select();

  if (error) {
    return internalError(error);
  }

  if (!data || data.length === 0) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Competency not found");
  }

  return NextResponse.json({ competency: data[0] });
});

export const DELETE = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const errors = validateQuery(request.url, COMPETENCY_DELETE_SCHEMA);
  if (errors.length > 0) return validationResponse(errors);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")!;

  const { data, error } = await supabaseAdmin
    .from("hr3_competencies")
    .delete()
    .eq("id", id)
    .select();

  if (error) {
    return internalError(error);
  }

  if (!data || data.length === 0) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Competency not found");
  }

  return NextResponse.json({ success: true });
});
