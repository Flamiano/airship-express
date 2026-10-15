import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: unknown; application_reference?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter your application email and reference." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const reference = typeof body.application_reference === "string" ? body.application_reference.trim() : "";
  if (!email || !reference || email.length > 254 || reference.length > 100) {
    return NextResponse.json({ error: "Enter your application email and reference." }, { status: 400 });
  }

  const { data: applicant, error } = await supabaseAdmin
    .from("hr1_applicants")
    .select("id, application_reference, first_name, last_name, email, job_position_id, status, created_at")
    .eq("email", email)
    .eq("application_reference", reference)
    .maybeSingle();

  // Keep the same response for missing records and database errors so the API
  // does not reveal whether an email or application reference exists.
  if (error) {
    console.error("HR1 application status lookup failed:", error.message);
    return NextResponse.json({ error: "Unable to check application status right now." }, { status: 503 });
  }
  if (!applicant) {
    return NextResponse.json({ error: "No matching application found. Please verify your reference number and email address." }, { status: 404 });
  }

  const [positionResult, interviewResult, onboardingResult] = await Promise.all([
    supabaseAdmin.from("hr1_job_positions").select("title").eq("id", applicant.job_position_id).maybeSingle(),
    supabaseAdmin.from("hr1_interviews").select("scheduled_date, location_or_link, status, outcome")
      .eq("applicant_id", applicant.id).order("scheduled_date", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("hr1_onboardings").select("completed_at")
      .eq("applicant_id", applicant.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (positionResult.error || interviewResult.error || onboardingResult.error) {
    console.error("HR1 application status details lookup failed:", positionResult.error?.message ?? interviewResult.error?.message ?? onboardingResult.error?.message);
    return NextResponse.json({ error: "Unable to check application status right now." }, { status: 503 });
  }

  const interview = interviewResult.data;
  const completedAt = onboardingResult.data?.completed_at ?? null;
  return NextResponse.json({ application: {
    application_reference: applicant.application_reference,
    first_name: applicant.first_name,
    last_name: applicant.last_name,
    email: applicant.email,
    job_title: positionResult.data?.title ?? null,
    status: applicant.status,
    submitted_at: applicant.created_at,
    interview_scheduled_date: interview?.scheduled_date ?? null,
    interview_location: interview?.location_or_link ?? null,
    interview_status: interview?.status ?? null,
    interview_outcome: interview?.outcome ?? null,
    onboarding_completed: Boolean(completedAt),
    onboarding_completed_at: completedAt,
  } });
}
