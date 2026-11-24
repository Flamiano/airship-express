import { NextResponse } from "next/server";
import { hasPermission } from "../../../lib/permissions";
import { authenticateFtmRequest } from "../../../lib/server/ftmRequestAuth";
import { createFtmHrServiceClient } from "../../../lib/server/ftmSupabase";

export const dynamic = "force-dynamic";
const EMPLOYEE_SELECT = "id, employee_id_number, first_name, last_name, email, phone, department, date_hired, status, job_position_id, job_position:hr1_job_positions(id, title)";

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "operations", "view")) return NextResponse.json({ error: "Permission denied: operations.view" }, { status: 403 });
  const client = createFtmHrServiceClient();
  if (!client) return NextResponse.json({ error: "HR database is not configured for FTM." }, { status: 503 });
  const params = new URL(request.url).searchParams;
  let query = client.from("hr2_attendance_logs")
    .select(`id, employee_id, status, shift_start, shift_end, terminal, last_scan, created_at, time_in, time_out, employee:hr1_employees(${EMPLOYEE_SELECT})`)
    .order("last_scan", { ascending: false });
  if (params.get("employee_id")) query = query.eq("employee_id", params.get("employee_id"));
  if (params.get("status")) query = query.eq("status", params.get("status"));
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Unable to load HR attendance." }, { status: 500 });
  return NextResponse.json(data || []);
}