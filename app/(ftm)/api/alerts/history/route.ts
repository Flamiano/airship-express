import { NextResponse } from "next/server";
import { hasPermission } from "../../../lib/permissions";
import { authenticateFtmRequest } from "../../../lib/server/ftmRequestAuth";
import { listAlertHistory } from "../../../lib/server/ftmAlerts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "alerts", "view")) {
    return NextResponse.json({ error: "Permission denied: alerts.view" }, { status: 403 });
  }
  const params = new URL(request.url).searchParams;
  try {
    return NextResponse.json(await listAlertHistory(context.serviceClient, context.user.id, context.user.role, params.get("limit"), params.get("offset")));
  } catch (error) {
    console.error("Alert history error:", error);
    return NextResponse.json({ error: "Unable to load alert history" }, { status: 500 });
  }
}