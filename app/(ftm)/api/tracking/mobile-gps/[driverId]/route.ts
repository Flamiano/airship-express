import { NextResponse } from "next/server";
import { hasPermission } from "../../../../lib/permissions";
import { authenticateFtmRequest } from "../../../../lib/server/ftmRequestAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ driverId: string }> }) {
  const { driverId } = await params;
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "operations", "view")) return NextResponse.json({ error: "Permission denied: operations.view" }, { status: 403 });
  const limit = Math.max(1, Number.parseInt(new URL(request.url).searchParams.get("limit") || "100", 10) || 100);
  const { data, error } = await auth.context.serviceClient.from("mobile_device_tracking").select("*").eq("driver_id", driverId).order("recorded_at", { ascending: false }).limit(limit);
  if (error) return NextResponse.json({ error: "Failed to fetch mobile GPS tracking" }, { status: 500 });
  return NextResponse.json((data || []).reverse());
}