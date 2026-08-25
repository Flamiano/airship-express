import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import {
  handle,
  internalError,
  validateJson,
  type Schema,
} from "../lib/validate";
import { getAuthenticatedHrUser, requireHrAdmin } from "../lib/auth";

export const dynamic = "force-dynamic";

const BADGE_BODY_SCHEMA: Schema = {
  name: { type: "string", min: 1, max: 200 },
  description: { type: "string", optional: true, max: 1000 },
  icon_url: { type: "string", optional: true, max: 500 },
};

export const GET = handle(async () => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin.from("hr3_badges").select("*");

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ badges: data ?? [] });
});

export const POST = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const parsed = await validateJson(request, BADGE_BODY_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const { data, error } = await supabaseAdmin
    .from("hr3_badges")
    .insert({
      name: body.name,
      description: body.description,
      icon_url: body.icon_url,
    })
    .select();

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ badge: data?.[0] }, { status: 201 });
});
