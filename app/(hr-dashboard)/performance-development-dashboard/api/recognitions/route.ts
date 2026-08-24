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
import { getAuthenticatedHrUser } from "../lib/auth";

export const dynamic = "force-dynamic";

const REASON_CATEGORIES = [
  "teamwork",
  "innovation",
  "customer_service",
  "leadership",
  "ownership",
] as const;

const VISIBILITIES = ["public", "private"] as const;

const RECOGNITION_BODY_SCHEMA: Schema = {
  recipient_id: { type: "uuid" },
  message: { type: "string", min: 1, max: 1000 },
  badge_id: { type: "uuid", optional: true },
  reason_category: { type: "string", enum: REASON_CATEGORIES },
  points: { type: "number", optional: true, min: 0, max: 1000 },
  visibility: { type: "string", optional: true, enum: VISIBILITIES },
};

export const GET = handle(async () => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from("hr3_recognitions")
    .select("*, hr3_badges(name, icon_url)")
    .eq("visibility", "public")
    .order("created_at", { ascending: false });

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ recognitions: data ?? [] });
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

  const parsed = await validateJson(request, RECOGNITION_BODY_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  if (body.recipient_id === user.employeeId) {
    return errorResponse(
      ERROR_CODES.CONFLICT,
      "You cannot recognize yourself."
    );
  }

  const { data: recipient } = await supabaseAdmin
    .from("hr1_employees")
    .select("id")
    .eq("id", body.recipient_id)
    .maybeSingle();

  if (!recipient) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Recipient not found");
  }

  if (body.badge_id) {
    const { data: badge, error: badgeError } = await supabaseAdmin
      .from("hr3_badges")
      .select("id")
      .eq("id", body.badge_id)
      .maybeSingle();

    if (badgeError) {
      return internalError(badgeError);
    }

    if (!badge) {
      return errorResponse(ERROR_CODES.NOT_FOUND, "Badge not found");
    }
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_recognitions")
    .insert({
      sender_id: user.employeeId,
      recipient_id: body.recipient_id,
      message: body.message,
      badge_id: body.badge_id || null,
      reason_category: body.reason_category,
      points: body.points || 0,
      visibility: body.visibility || "public",
    })
    .select();

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ recognition: data?.[0] }, { status: 201 });
});
