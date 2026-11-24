import { NextResponse } from "next/server";
import { hasPermission } from "../../lib/permissions";
import { authenticateFtmRequest } from "../../lib/server/ftmRequestAuth";
import { listAlerts } from "../../lib/server/ftmAlerts";

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
    return NextResponse.json(await listAlerts(context.serviceClient, {
      status: params.get("status"),
      category: params.get("category"),
      severity: params.get("severity"),
      userId: context.user.id,
      role: context.user.role,
      limit: params.get("limit"),
      offset: params.get("offset"),
    }));
  } catch (error) {
    console.error("Alert list error:", error);
    return NextResponse.json({ error: "Unable to load alerts" }, { status: 500 });
  }
}