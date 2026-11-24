import { NextResponse } from "next/server";
import { hasPermission } from "../../../../lib/permissions";
import { authenticateFtmRequest } from "../../../../lib/server/ftmRequestAuth";
import { transitionAlert } from "../../../../lib/server/ftmAlerts";

export const dynamic = "force-dynamic";
const ALLOWED = new Set(["ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "DISMISSED"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "alerts", "update")) {
    return NextResponse.json({ error: "Permission denied: alerts.update" }, { status: 403 });
  }
  let body: { status?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  const status = String(body.status || "").toUpperCase();
  if (!ALLOWED.has(status)) return NextResponse.json({ error: "Invalid alert status" }, { status: 400 });
  try {
    return NextResponse.json(await transitionAlert(context.serviceClient, id, status, context.user.id));
  } catch (error) {
    console.error("Alert transition error:", error);
    return NextResponse.json({ error: "Unable to update alert" }, { status: 500 });
  }
}