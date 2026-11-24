import { NextResponse } from "next/server";
import { hasPermission } from "../../../lib/permissions";
import { authenticateFtmRequest } from "../../../lib/server/ftmRequestAuth";

export async function POST(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "operations", "create")) {
    return NextResponse.json({ error: "Permission denied: operations.create" }, { status: 403 });
  }
  let body: { driver_id?: string; subject?: string; message?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  if (!body.message) return NextResponse.json({ error: "message is required" }, { status: 400 });
  const { data, error } = await context.serviceClient.from("incident_reports").insert({
    driver_id: context.user.role === "driver" ? context.user.id : body.driver_id || null,
    incident_type: "Other",
    description: body.subject ? `[${body.subject}] ${body.message}` : body.message,
  }).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: `Unable to submit support request: ${error.message}` }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}