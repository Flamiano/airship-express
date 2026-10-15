import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/(hr-dashboard)/supabase/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { resolveHrAccountForSession } from "@/app/(hr-dashboard)/lib/hr-account";

export const dynamic = "force-dynamic";

const HR_REVIEW_ROLES = new Set(["super_admin", "hr_recruitment_admin"]);

async function getIdentity() {
  const sessionClient = await createServerSupabaseClient();
  const { data: { user }, error } = await sessionClient.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const account = await resolveHrAccountForSession(user.id);
  if (!account) return { error: NextResponse.json({ error: "Active HR account required" }, { status: 403 }) };

  let department: string | null = null;
  if (account.accountType !== "hr_admin" && account.employeeUuid) {
    const { data } = await supabaseAdmin
      .from("hr1_employees")
      .select("department")
      .eq("id", account.employeeUuid)
      .eq("status", "active")
      .maybeSingle();
    department = data?.department ?? null;
  }

  return { user, account, department };
}

export async function GET() {
  const identity = await getIdentity();
  if ("error" in identity) return identity.error;

  const isHrReviewer = identity.account.accountType === "hr_admin" && HR_REVIEW_ROLES.has(identity.account.role);
  if (!isHrReviewer && identity.account.accountType === "hr_admin") {
    return NextResponse.json({ error: "HR Recruitment Admin or Super Admin access required" }, { status: 403 });
  }

  let query = supabaseAdmin.from("hr1_manpower_requests").select("*").order("created_at", { ascending: false });
  if (!isHrReviewer) {
    if (!identity.department) return NextResponse.json({ error: "Your employee record has no department assigned" }, { status: 403 });
    query = query.eq("department", identity.department);
  }

  const { data, error } = await query;
  if (error) {
    console.error("HR1 manpower request read failed:", error.message);
    return NextResponse.json({ error: "Unable to load manpower requests" }, { status: 500 });
  }
  return NextResponse.json({ requests: data ?? [], role: isHrReviewer ? "hr" : "department", department: identity.department });
}

export async function POST(request: Request) {
  const identity = await getIdentity();
  if ("error" in identity) return identity.error;
  if (identity.account.accountType === "hr_admin" || !identity.department) {
    return NextResponse.json({ error: "An active employee account with an assigned department is required to submit a request" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const title = typeof body.position_title === "string" ? body.position_title.trim() : "";
  const description = typeof body.job_description === "string" ? body.job_description.trim() : "";
  const requirements = typeof body.requirements === "string" ? body.requirements.trim() : "";
  const reason = typeof body.reason_for_request === "string" ? body.reason_for_request.trim() : "";
  const headcount = Number(body.number_of_positions);
  if (!title || !description || !requirements || !reason || !Number.isInteger(headcount) || headcount < 1 || headcount > 10000) {
    return NextResponse.json({ error: "Provide title, description, requirements, hiring reason, and a valid headcount" }, { status: 400 });
  }

  const optionalText = (key: string, max = 500) => {
    const value = body[key];
    return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
  };
  const deadline = optionalText("hiring_deadline", 10);
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return NextResponse.json({ error: "Invalid hiring deadline" }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("hr1_manpower_requests").insert({
    department: identity.department,
    position_title: title.slice(0, 150),
    number_of_positions: headcount,
    job_description: description.slice(0, 5000),
    requirements: requirements.slice(0, 5000),
    reason_for_request: reason.slice(0, 3000),
    requested_by: identity.user.id,
    status: "Pending",
    salary_range: optionalText("salary_range", 150),
    employment_type: optionalText("employment_type", 100),
    work_arrangement: optionalText("work_arrangement", 100),
    work_location: optionalText("work_location", 250),
    benefits: optionalText("benefits", 3000),
    hiring_deadline: deadline,
  }).select("*").single();

  if (error) {
    console.error("HR1 manpower request insert failed:", error.message);
    return NextResponse.json({ error: "Unable to submit request" }, { status: 500 });
  }
  return NextResponse.json({ request: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const identity = await getIdentity();
  if ("error" in identity) return identity.error;
  if (identity.account.accountType !== "hr_admin" || !HR_REVIEW_ROLES.has(identity.account.role)) {
    return NextResponse.json({ error: "Only HR Recruitment Admin or Super Admin may review requests" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  const status = body.status;
  const remarks = typeof body.review_remarks === "string" ? body.review_remarks.trim() : "";
  if (!id || !["Approved", "Rejected", "Revision Requested"].includes(String(status)) || !remarks) {
    return NextResponse.json({ error: "Request ID, valid decision, and review remarks are required" }, { status: 400 });
  }

  const { data: current, error: readError } = await supabaseAdmin.from("hr1_manpower_requests").select("id,status").eq("id", id).maybeSingle();
  if (readError || !current) return NextResponse.json({ error: "Manpower request not found" }, { status: 404 });
  if (current.status !== "Pending" && current.status !== "Revision Requested") {
    return NextResponse.json({ error: "Only pending or revision-requested submissions may be reviewed" }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin.from("hr1_manpower_requests").update({
    status,
    reviewed_by: identity.account.hrAdminId,
    review_remarks: remarks.slice(0, 3000),
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", id).select("*").single();
  if (error) {
    console.error("HR1 manpower review update failed:", error.message);
    return NextResponse.json({ error: "Unable to record HR review" }, { status: 500 });
  }
  return NextResponse.json({ request: data });
}
