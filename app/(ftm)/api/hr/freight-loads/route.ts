import { NextResponse } from "next/server";
import { hasPermission } from "../../../lib/permissions";
import { authenticateFtmRequest } from "../../../lib/server/ftmRequestAuth";
import { createFtmHrServiceClient } from "../../../lib/server/ftmSupabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "operations", "view")) return NextResponse.json({ error: "Permission denied: operations.view" }, { status: 403 });
  const client = createFtmHrServiceClient();
  if (!client) return NextResponse.json({ error: "HR database is not configured for FTM." }, { status: 503 });
  const params = new URL(request.url).searchParams;
  let query = client.from("hr2_freight_loads")
    .select("id, load_ref, origin, destination, pickup_date, status, priority, driver_id, created_at, driver:hr1_employees(id, employee_id_number, first_name, last_name, email, department)")
    .order("pickup_date", { ascending: true });
  if (params.get("status")) query = query.eq("status", params.get("status"));
  if (params.get("driver_id")) query = query.eq("driver_id", params.get("driver_id"));
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Unable to load HR freight loads." }, { status: 500 });
  return NextResponse.json(data || []);
}