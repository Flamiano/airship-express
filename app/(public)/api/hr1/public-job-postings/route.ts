import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

export const dynamic = "force-dynamic";

// Public callers receive only vacancies linked to an approved request and
// explicitly published by HR. Internal legacy position rows are excluded.
export async function GET() {
  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from("hr1_job_positions")
    .select("id,title,department,description,requirements,number_of_positions,salary_range,employment_type,work_arrangement,work_location,benefits,hiring_deadline,manpower_request_id")
    .eq("is_active", true)
    .eq("posting_status", "Published")
    .not("manpower_request_id", "is", null)
    .order("created_at", { ascending: false });

  if (jobsError) {
    console.error("HR1 public vacancy read failed:", jobsError.message);
    return NextResponse.json({ error: "Unable to load published vacancies." }, { status: 500 });
  }

  const rows = jobs ?? [];
  if (!rows.length) return NextResponse.json({ jobs: [] });

  const requestIds = [...new Set(rows.map((job) => job.manpower_request_id).filter(Boolean))];
  const { data: requests, error: requestsError } = await supabaseAdmin
    .from("hr1_manpower_requests")
    .select("id,status")
    .in("id", requestIds);

  if (requestsError) {
    console.error("HR1 public vacancy approval check failed:", requestsError.message);
    return NextResponse.json({ error: "Unable to verify vacancy approvals." }, { status: 500 });
  }

  const approvedRequestIds = new Set((requests ?? [])
    .filter((request) => request.status === "Approved")
    .map((request) => request.id));
  return NextResponse.json({
    jobs: rows.filter((job) => approvedRequestIds.has(job.manpower_request_id!)),
  });
}
