"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type DashboardStats = {
  applicants: number;
  openPositions: number;
  onboarding: number;
  activeEmployees: number;
};

type ActivityItem = {
  id: string;
  type: "applicant" | "onboarding";
  title: string;
  subtitle: string;
  date: string;
  status: string;
};

export default function DashboardPage() {
  const supabase = createClient();

  const [stats, setStats] = useState<DashboardStats>({
    applicants: 0,
    openPositions: 0,
    onboarding: 0,
    activeEmployees: 0,
  });

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    setError(null);

    try {
      const [
        applicantRes,
        positionRes,
        onboardingRes,
        employeeRes,
        recentApplicantsRes,
        recentOnboardingsRes,
      ] = await Promise.all([
        supabase
          .from("applicants")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("job_positions")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true),
        supabase
          .from("onboardings")
          .select("*", { count: "exact", head: true })
          .is("completed_at", null),
        supabase
          .from("employees")
          .select("*", { count: "exact", head: true })
          .eq("status", "Active"),
        supabase
          .from("applicants")
          .select("id, first_name, last_name, created_at, status")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("onboardings")
          .select(`
            id,
            created_at,
            completed_at,
            applicants(first_name, last_name)
          `)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (applicantRes.error) throw new Error(`Applicants query failed: ${applicantRes.error.message}`);
      if (positionRes.error) throw new Error(`Positions query failed: ${positionRes.error.message}`);
      if (onboardingRes.error) throw new Error(`Onboarding query failed: ${onboardingRes.error.message}`);
      if (employeeRes.error) throw new Error(`Employees query failed: ${employeeRes.error.message}`);

      setStats({
        applicants: applicantRes.count ?? 0,
        openPositions: positionRes.count ?? 0,
        onboarding: onboardingRes.count ?? 0,
        activeEmployees: employeeRes.count ?? 0,
      });

      const formattedApplicants: ActivityItem[] = (recentApplicantsRes.data || []).map((item: any) => ({
        id: item.id,
        type: "applicant" as const,
        title: `${item.first_name} ${item.last_name}`,
        subtitle: "Submitted an application",
        date: item.created_at,
        status: item.status || "Pending",
      }));

      const formattedOnboardings: ActivityItem[] = (recentOnboardingsRes.data || []).map((item: any) => ({
        id: item.id,
        type: "onboarding" as const,
        title: item.applicants
          ? `${item.applicants.first_name} ${item.applicants.last_name}`
          : "New Hire",
        subtitle: "Entered onboarding stage",
        date: item.created_at,
        status: item.completed_at ? "Completed" : "In Progress",
      }));

      const combined = [...formattedApplicants, ...formattedOnboardings].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setActivities(combined.slice(0, 6));
    } catch (err: any) {
      console.error("DASHBOARD LOAD ERROR:", JSON.stringify(err, null, 2));
      setError(
        err?.message ||
        err?.error_description ||
        "Failed to load dashboard statistics and activity feed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#121212] sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of your recruitment pipeline, active positions, and staff metrics.
          </p>
        </div>

        <button
          onClick={loadDashboardData}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 shadow-2xs transition hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 active:scale-[0.98]"
        >
          <svg
            className={`h-4 w-4 text-gray-500 ${loading ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh Data
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-8 flex items-start justify-between gap-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700 shadow-2xs">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 shrink-0 text-red-500 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-bold">Failed to load dashboard</p>
              <p className="mt-0.5 text-xs text-red-600 leading-relaxed">{error}</p>
            </div>
          </div>
          <button
            onClick={loadDashboardData}
            className="shrink-0 rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Applicants */}
        <div className="rounded-2xl bg-white p-6 shadow-2xs border border-gray-100 flex flex-col justify-between transition hover:shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
              Total Applicants
            </span>
            <div className="rounded-xl bg-[#CB1A8E]/10 p-2.5 text-[#CB1A8E]">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            {loading ? (
              <div className="h-9 w-20 animate-pulse rounded-lg bg-gray-100" />
            ) : (
              <p className="text-3xl font-black tracking-tight text-[#121212]">
                {stats.applicants}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-400">All registered candidates</p>
          </div>
        </div>

        {/* Open Positions */}
        <div className="rounded-2xl bg-white p-6 shadow-2xs border border-gray-100 flex flex-col justify-between transition hover:shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
              Open Positions
            </span>
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            {loading ? (
              <div className="h-9 w-20 animate-pulse rounded-lg bg-gray-100" />
            ) : (
              <p className="text-3xl font-black tracking-tight text-[#121212]">
                {stats.openPositions}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-400">Active job listings</p>
          </div>
        </div>

        {/* In Onboarding */}
        <div className="rounded-2xl bg-white p-6 shadow-2xs border border-gray-100 flex flex-col justify-between transition hover:shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
              In Onboarding
            </span>
            <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            {loading ? (
              <div className="h-9 w-20 animate-pulse rounded-lg bg-gray-100" />
            ) : (
              <p className="text-3xl font-black tracking-tight text-[#121212]">
                {stats.onboarding}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-400">Candidates submitting requirements</p>
          </div>
        </div>

        {/* Active Employees */}
        <div className="rounded-2xl bg-white p-6 shadow-2xs border border-gray-100 flex flex-col justify-between transition hover:shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
              Active Employees
            </span>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 012-2h2a2 2 0 012 2v1m-6 0h6" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            {loading ? (
              <div className="h-9 w-20 animate-pulse rounded-lg bg-gray-100" />
            ) : (
              <p className="text-3xl font-black tracking-tight text-[#121212]">
                {stats.activeEmployees}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-400">Hired staff records</p>
          </div>
        </div>
      </div>

      {/* Recent Activity Feed Section */}
      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        {/* Activity List */}
        <div className="lg:col-span-2 rounded-2xl bg-white p-6 sm:p-8 shadow-2xs border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-[#121212]">Recent Activity Pipeline</h3>
                <p className="text-xs text-gray-400 mt-0.5">Real-time candidate submissions and updates</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-600 border border-emerald-100">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Feed
              </span>
            </div>

            {loading ? (
              <div className="space-y-3.5">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-16 animate-pulse rounded-xl bg-gray-50 border border-gray-100/60" />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-gray-50 p-4 text-gray-400 mb-3 border border-gray-100">
                  <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-gray-800">No recent activities</p>
                <p className="text-xs text-gray-400 mt-1 max-w-xs">New candidate submissions and onboarding steps will appear here automatically.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {activities.map((item) => (
                  <div key={item.id} className="py-4 flex items-center justify-between gap-4 first:pt-0 last:pb-0 transition hover:bg-gray-50/50 rounded-xl px-2">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`rounded-xl p-3 text-xs font-black shrink-0 shadow-2xs ${
                        item.type === 'applicant' ? 'bg-[#CB1A8E]/10 text-[#CB1A8E]' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {item.type === 'applicant' ? 'APP' : 'ONB'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#121212] truncate">{item.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {item.subtitle} • <span className="font-medium text-gray-500">{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-gray-50 px-3 py-1 text-[11px] font-bold text-gray-600 border border-gray-200/60 shadow-2xs">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Portal Card */}
        <div className="rounded-2xl bg-[#121212] p-6 sm:p-8 text-white shadow-sm flex flex-col justify-between relative overflow-hidden">
          {/* Background decorative glow */}
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#CB1A8E]/20 blur-3xl pointer-events-none" />

          <div>
            <span className="inline-block text-[10px] font-black tracking-widest text-[#E91E8F] uppercase mb-2">
              Airship Express
            </span>
            <h2 className="text-xl font-black tracking-tight text-white">
              Quick Control
            </h2>
            <p className="mt-2.5 text-xs leading-relaxed text-gray-400">
              Manage candidate screenings, schedule interviews, and process new hires seamlessly across your recruitment pipelines.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              href="/recruitment-core-hub-dashboard/applicants"
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-center text-xs font-bold text-white hover:bg-white/20 transition shadow-2xs border border-white/5 active:scale-[0.98]"
            >
              Manage Applicants
            </Link>
            <Link
              href="/recruitment-core-hub-dashboard/onboarding"
              className="w-full rounded-xl bg-[#CB1A8E] px-4 py-3 text-center text-xs font-bold text-white hover:bg-[#a31270] transition shadow-xs active:scale-[0.98]"
            >
              View Onboarding
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}