import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/(hr-dashboard)/supabase/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { resolveHrAccountForSession } from "@/app/(hr-dashboard)/lib/hr-account";

export const dynamic = "force-dynamic";
const HR_ROLES = new Set(["super_admin", "hr_recruitment_admin"]);

async function requireRecruitmentHr() {
  const sessionClient = await createServerSupabaseClient();
  const { data: { user }, error } = await sessionClient.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const account = await resolveHrAccountForSession(user.id);
  if (!account || account.accountType !== "hr_admin" || !HR_ROLES.has(account.role)) {
    return { response: NextResponse.json({ error: "HR Recruitment Admin or Super Admin access required" }, { status: 403 }) };
  }
  return { user, account, sessionClient };
}

export async function GET() {
  const auth = await requireRecruitmentHr();
  if ("response" in auth) return auth.response;
  const [jobsResult, requestsResult] = await Promise.all([
    supabaseAdmin.from("hr1_job_positions").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("hr1_manpower_requests").select("id,department,position_title,number_of_positions,job_description,requirements,reason_for_request,salary_range,employment_type,work_arrangement,work_location,benefits,hiring_deadline,positions_posted,status,review_remarks").eq("status", "Approved").order("created_at", { ascending: false }),
  ]);
  if (jobsResult.error || requestsResult.error) {
    console.error("HR1 job posting data read failed:", jobsResult.error?.message ?? requestsResult.error?.message);
    return NextResponse.json({ error: "Unable to load job postings. Apply the HR1 approval workflow migration first if it has not been applied." }, { status: 500 });
  }
  return NextResponse.json({ jobs: jobsResult.data ?? [], approvedRequests: requestsResult.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireRecruitmentHr();
  if ("response" in auth) return auth.response;
  let body: { manpower_request_id?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (typeof body.manpower_request_id !== "string") return NextResponse.json({ error: "Select an approved manpower request" }, { status: 400 });

  // Call the SECURITY DEFINER function with the user's JWT so auth.uid() and
  // the function's HR-role check identify the actual reviewer.
  const { data, error } = await auth.sessionClient.rpc("hr1_create_job_posting_from_request", { p_request_id: body.manpower_request_id });
  if (error) {
    console.error("HR1 job posting creation failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  return NextResponse.json({ job: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireRecruitmentHr();
  if ("response" in auth) return auth.response;
  let body: { id?: unknown; posting_status?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  const status = body.posting_status;
  if (!id || !["Published", "Closed"].includes(String(status))) return NextResponse.json({ error: "Select a job and a valid publication status" }, { status: 400 });

  const { data: job, error: jobError } = await supabaseAdmin.from("hr1_job_positions")
    .select("id,manpower_request_id,posting_status").eq("id", id).maybeSingle();
  if (jobError || !job) return NextResponse.json({ error: "Job posting not found" }, { status: 404 });
  if (!job.manpower_request_id) return NextResponse.json({ error: "Legacy positions cannot be published through this workflow" }, { status: 409 });
  const { data: requestRecord, error: requestError } = await supabaseAdmin.from("hr1_manpower_requests")
    .select("id,status").eq("id", job.manpower_request_id).maybeSingle();
  if (requestError || !requestRecord || requestRecord.status !== "Approved") {
    return NextResponse.json({ error: "The source manpower request is not approved" }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin.from("hr1_job_positions").update({
    posting_status: status,
    is_active: status === "Published",
    updated_at: new Date().toISOString(),
  }).eq("id", id).select("*").single();
  if (error) {
    console.error("HR1 job posting status update failed:", error.message);
    return NextResponse.json({ error: "Unable to update publication status" }, { status: 500 });
  }
  return NextResponse.json({ job: data });
}
