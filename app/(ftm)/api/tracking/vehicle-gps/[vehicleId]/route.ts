import { NextResponse } from "next/server";
import { hasPermission } from "../../../../lib/permissions";
import { authenticateFtmRequest } from "../../../../lib/server/ftmRequestAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "operations", "view")) return NextResponse.json({ error: "Permission denied: operations.view" }, { status: 403 });
  const limit = Math.max(1, Number.parseInt(new URL(request.url).searchParams.get("limit") || "100", 10) || 100);
  const { data, error } = await auth.context.serviceClient.from("vehicle_gps_tracking").select("*").eq("vehicle_id", vehicleId).order("recorded_at", { ascending: false }).limit(limit);
  if (error && /could not find the table|schema cache|relation .* does not exist/i.test(error.message)) return NextResponse.json([]);
  if (error) return NextResponse.json({ error: "Failed to fetch vehicle GPS tracking" }, { status: 500 });
  return NextResponse.json((data || []).reverse());
}