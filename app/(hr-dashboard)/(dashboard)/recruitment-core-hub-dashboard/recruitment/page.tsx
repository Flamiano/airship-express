"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type ApplicantRow = { id: string; status: string | null };
type InterviewRow = { id: string; status: string | null; outcome: string | null };
type OnboardingRow = { id: string; completed_at: string | null };
type PositionRow = { id: string; is_active: boolean; posting_status: string | null };

type RecruitmentData = {
  applicants: ApplicantRow[];
  interviews: InterviewRow[];
  onboardings: OnboardingRow[];
  positions: PositionRow[];
};

const links = {
  applicants: "/recruitment-core-hub-dashboard/applicants",
  jobs: "/recruitment-core-hub-dashboard/job-posting",
  requests: "/recruitment-core-hub-dashboard/manpower-requests",
  screening: "/recruitment-core-hub-dashboard/screening",
  interviews: "/recruitment-core-hub-dashboard/recruitment/interviews",
  onboarding: "/recruitment-core-hub-dashboard/onboarding",
};

function countStatus(rows: { status: string | null }[], matcher: RegExp) {
  return rows.filter((row) => matcher.test((row.status ?? "").toLowerCase())).length;
}

export default function RecruitmentOverviewPage() {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<RecruitmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [applicantsRes, interviewsRes, onboardingRes, positionsRes] = await Promise.all([
        supabase.from("hr1_applicants").select("id, status"),
        supabase.from("hr1_interviews").select("id, status, outcome"),
        supabase.from("hr1_onboardings").select("id, completed_at"),
        supabase.from("hr1_job_positions").select("id, is_active, posting_status"),
      ]);

      const failed = [applicantsRes, interviewsRes, onboardingRes, positionsRes].find((result) => result.error);
      if (failed?.error) throw new Error(failed.error.message);

      setData({
        applicants: applicantsRes.data ?? [],
        interviews: interviewsRes.data ?? [],
        onboardings: onboardingRes.data ?? [],
        positions: positionsRes.data ?? [],
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load recruitment records.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const applicant of data?.applicants ?? []) {
      const status = applicant.status?.trim() || "Pending";
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const stats = data ? [
    { label: "Applicants", value: data.applicants.length, href: links.applicants, detail: "All submitted applications" },
    { label: "Published vacancies", value: data.positions.filter((position) => position.is_active && position.posting_status === "Published").length, href: links.jobs, detail: "Active and published" },
    { label: "Interviews scheduled", value: countStatus(data.interviews, /scheduled/), href: links.interviews, detail: "Based on interview status" },
    { label: "Hired applicants", value: countStatus(data.applicants, /hired/), href: links.applicants, detail: "Based on applicant status" },
    { label: "Active onboarding", value: data.onboardings.filter((row) => !row.completed_at).length, href: links.onboarding, detail: "Not yet completed" },
  ] : [];
  const workflowSteps = [
    { number: "01", title: "Manpower request", description: "Department hiring need and HR decision", href: links.requests },
    { number: "02", title: "Job posting", description: "Approved vacancies and publication status", href: links.jobs },
    { number: "03", title: "Applicants & screening", description: "Candidate records and advisory AI screening", href: links.applicants },
    { number: "04", title: "Interviews", description: "Schedules, feedback, and outcomes", href: links.interviews },
    { number: "05", title: "Assessment", description: "Assessment records are not connected in this HR1 demo", href: "" },
    { number: "06", title: "Onboarding", description: "Required documents and new-hire progress", href: links.onboarding },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e5167e]">HR1 · Recruitment</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Recruitment Overview</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Follow the hiring workflow from department request through applicant review, interviews, and onboarding.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-[#e5167e] disabled:opacity-50">
          {loading ? "Refreshing…" : "Refresh records"}
        </button>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Could not load recruitment data: {error}</div>}

      <section aria-label="Recruitment statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {(loading && !data ? Array.from({ length: 5 }, (_, index) => ({ label: `Loading ${index + 1}`, value: "—", href: "#", detail: "Loading live records" })) : stats).map((stat) => (
          <Link key={stat.label} href={stat.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-pink-200 hover:shadow-md">
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">{stat.value}</p>
            <p className="mt-2 text-xs text-slate-500">{stat.detail}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Recruitment workflow</h2>
              <p className="mt-1 text-sm text-slate-500">Open each HR1 area to review its current records.</p>
            </div>
            <Link href={links.requests} className="rounded-lg bg-[#e5167e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-pink-700">Review manpower requests</Link>
          </div>
          <ol className="mt-6 grid gap-3 sm:grid-cols-2">
            {workflowSteps.map((step) => (
              <li key={step.number}>
                {step.href ? (
                  <Link href={step.href} className="block h-full rounded-xl border border-slate-200 p-4 transition hover:border-pink-300 hover:bg-pink-50/40">
                    <WorkflowStep number={step.number} title={step.title} description={step.description} />
                  </Link>
                ) : (
                  <div className="h-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                    <WorkflowStep number={step.number} title={step.title} description={step.description} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Applicants by status</h2>
            <p className="mt-1 text-sm text-slate-500">Counts from current HR1 applicant records.</p>
          </div>
          {loading && !data ? (
            <p className="mt-6 text-sm text-slate-500">Loading applicant statuses…</p>
          ) : statusCounts.length ? (
            <ul className="mt-5 space-y-4">
              {statusCounts.map(([status, count]) => {
                const total = data?.applicants.length ?? 0;
                const width = total ? Math.max(4, Math.round((count / total) * 100)) : 0;
                return <li key={status}>
                  <div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="truncate font-medium text-slate-700">{status}</span><span className="font-semibold text-slate-900">{count}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#e5167e]" style={{ width: `${width}%` }} /></div>
                </li>;
              })}
            </ul>
          ) : (
            <div className="mt-6 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No applicant records yet. New applications will appear here.</div>
          )}
          <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">Demo scope note: HR3 training and cross-subsystem HCM/ESS handoffs are not connected from this overview.</p>
        </div>
      </section>

      <section className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <Link href={links.screening} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-pink-300 hover:text-pink-700">Open AI Screening</Link>
        <Link href={links.interviews} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-pink-300 hover:text-pink-700">Manage interviews</Link>
        <Link href={links.applicants} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-pink-300 hover:text-pink-700">View applicants</Link>
      </section>
    </main>
  );
}

function WorkflowStep({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="flex gap-3">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-100 text-xs font-bold text-pink-700">{number}</span>
    <div><h3 className="text-sm font-semibold text-slate-900">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div>
  </div>;
}
