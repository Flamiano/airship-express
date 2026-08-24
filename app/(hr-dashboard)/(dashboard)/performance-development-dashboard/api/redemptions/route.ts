import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import {
  ERROR_CODES,
  errorResponse,
  handle,
  internalError,
  validateJson,
  type Schema,
} from "../lib/validate";
import { getAuthenticatedHrUser, requireHrAdmin } from "../lib/auth";

export const dynamic = "force-dynamic";

const REDEMPTION_STATUSES = ["pending", "approved", "rejected", "fulfilled"] as const;

const REDEMPTION_BODY_SCHEMA: Schema = {
  points_used: { type: "number", integer: true, min: 1, max: 1000000 },
  reward_description: { type: "string", min: 1, max: 500 },
};

const REDEMPTION_UPDATE_SCHEMA: Schema = {
  id: { type: "uuid" },
  status: { type: "string", enum: REDEMPTION_STATUSES },
};

export const GET = handle(async () => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  let query = supabaseAdmin.from("hr3_reward_redemptions").select("*");
  if (!user.isAdmin) {
    if (!user.employeeId) {
      return NextResponse.json({ redemptions: [] });
    }
    query = query.eq("employee_id", user.employeeId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ redemptions: data ?? [] });
});

export const POST = handle(async (request: Request) => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  if (!user.employeeId) {
    return errorResponse(
      ERROR_CODES.EMPLOYEE_PROFILE_REQUIRED,
      "Your account is not linked to an employee profile yet. Contact HR."
    );
  }

  const parsed = await validateJson(request, REDEMPTION_BODY_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const { data, error } = await supabaseAdmin
    .from("hr3_reward_redemptions")
    .insert({
      employee_id: user.employeeId,
      points_used: body.points_used,
      reward_description: body.reward_description,
    })
    .select();

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ redemption: data?.[0] }, { status: 201 });
});

export const PUT = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const parsed = await validateJson(request, REDEMPTION_UPDATE_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const { data, error } = await supabaseAdmin
    .from("hr3_reward_redemptions")
    .update({
      status: body.status,
      processed_at: body.status !== "pending" ? new Date().toISOString() : null,
    })
    .eq("id", body.id)
    .select();

  if (error) {
    return internalError(error);
  }

  if (!data || data.length === 0) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Redemption not found");
  }

  return NextResponse.json({ redemption: data[0] });
});
