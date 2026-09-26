"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type ReportStats = {
  applicants: number;
  interviews: number;
  completedInterviews: number;
  onboarding: number;
  completedOnboarding: number;
  employees: number;
};

type Applicant = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  created_at: string;
};

type Employee = {
  id: string;
  employee_id_number: string;
  first_name: string;
  last_name: string;
  department: string;
  status: string;
  date_hired: string;
};

export default function ReportsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [stats, setStats] = useState<ReportStats>({
    applicants: 0,
    interviews: 0,
    completedInterviews: 0,
    onboarding: 0,
    completedOnboarding: 0,
    employees: 0,
  });

  const [recentApplicants, setRecentApplicants] = useState<Applicant[]>([]);
  const [recentEmployees, setRecentEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // --------------------------------------------------
      // 0. Verify logged-in user
      // --------------------------------------------------

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.error("AUTH ERROR:", authError);
        throw new Error(
          `Authentication check failed: ${authError.message}`
        );
      }

      if (!user) {
        throw new Error(
          "No authenticated user found. Please log in again."
        );
      }

      console.log("REPORTS AUTH USER:", user.id);

      // --------------------------------------------------
      // 1. Get applicant count
      // --------------------------------------------------

      const {
        data: applicantRows,
        error: applicantError,
      } = await supabase
        .from("hr1_applicants")
        .select("id");

      if (applicantError) {
        console.error("APPLICANTS ERROR:", applicantError);
        throw new Error(
          `Applicants query failed: ${applicantError.message}`
        );
      }

      console.log("REPORTS APPLICANTS:", applicantRows?.length ?? 0);

      // --------------------------------------------------
      // 2. Get interview count
      // --------------------------------------------------

      const {
        data: interviewRows,
        error: interviewError,
      } = await supabase
        .from("hr1_interviews")
        .select("id");

      if (interviewError) {
        console.error("INTERVIEWS ERROR:", interviewError);
        throw new Error(
          `Interviews query failed: ${interviewError.message}`
        );
      }

      console.log("REPORTS INTERVIEWS:", interviewRows?.length ?? 0);

      // --------------------------------------------------
      // 3. Get completed interview count
      // --------------------------------------------------

      const {
        data: completedInterviewRows,
        error: completedInterviewError,
      } = await supabase
        .from("hr1_interviews")
        .select("id")
        .eq("status", "Completed");

      if (completedInterviewError) {
        console.error(
          "COMPLETED INTERVIEWS ERROR:",
          completedInterviewError
        );
        throw new Error(
          `Completed interviews query failed: ${completedInterviewError.message}`
        );
      }

      console.log(
        "REPORTS COMPLETED INTERVIEWS:",
        completedInterviewRows?.length ?? 0
      );

      // --------------------------------------------------
      // 4. Get onboarding count
      // --------------------------------------------------

      const {
        data: onboardingRows,
        error: onboardingError,
      } = await supabase
        .from("hr1_onboardings")
        .select("id");

      if (onboardingError) {
        console.error("ONBOARDING ERROR:", onboardingError);
        throw new Error(
          `Onboarding query failed: ${onboardingError.message}`
        );
      }

      console.log("REPORTS ONBOARDING:", onboardingRows?.length ?? 0);

      // --------------------------------------------------
      // 5. Get completed onboarding count
      // --------------------------------------------------

      const {
        data: completedOnboardingRows,
        error: completedOnboardingError,
      } = await supabase
        .from("hr1_onboardings")
        .select("id")
        .not("completed_at", "is", null);

      if (completedOnboardingError) {
        console.error(
          "COMPLETED ONBOARDING ERROR:",
          completedOnboardingError
        );
        throw new Error(
          `Completed onboarding query failed: ${completedOnboardingError.message}`
        );
      }

      console.log(
        "REPORTS COMPLETED ONBOARDING:",
        completedOnboardingRows?.length ?? 0
      );

      // --------------------------------------------------
      // 6. Get employee count
      // --------------------------------------------------

      const {
        data: employeeRows,
        error: employeeError,
      } = await supabase
        .from("hr1_employees")
        .select("id");

      if (employeeError) {
        console.error("EMPLOYEES ERROR:", employeeError);
        throw new Error(
          `Employees query failed: ${employeeError.message}`
        );
      }

      console.log("REPORTS EMPLOYEES:", employeeRows?.length ?? 0);

      // --------------------------------------------------
      // 7. Get recent applicants
      // --------------------------------------------------

      const {
        data: applicants,
        error: recentApplicantsError,
      } = await supabase
        .from("hr1_applicants")
        .select(`
          id,
          first_name,
          last_name,
          email,
          status,
          created_at
        `)
        .order("created_at", {
          ascending: false,
        })
        .limit(5);

      if (recentApplicantsError) {
        console.error(
          "RECENT APPLICANTS ERROR:",
          recentApplicantsError
        );

        throw new Error(
          `Recent applicants query failed: ${recentApplicantsError.message}`
        );
      }

      console.log("REPORTS RECENT APPLICANTS:", applicants?.length ?? 0);

      // --------------------------------------------------
      // 8. Get recent employees
      // --------------------------------------------------

      const {
        data: employees,
        error: recentEmployeesError,
      } = await supabase
        .from("hr1_employees")
        .select(`
          id,
          employee_id_number,
          first_name,
          last_name,
          department,
          status,
          date_hired
        `)
        .order("created_at", {
          ascending: false,
        })
        .limit(5);

      if (recentEmployeesError) {
        console.error(
          "RECENT EMPLOYEES ERROR:",
          recentEmployeesError
        );

        throw new Error(
          `Recent employees query failed: ${recentEmployeesError.message}`
        );
      }

      console.log("REPORTS RECENT EMPLOYEES:", employees?.length ?? 0);

      // --------------------------------------------------
      // 9. Update state
      // --------------------------------------------------

      setStats({
        applicants: applicantRows?.length ?? 0,
        interviews: interviewRows?.length ?? 0,
        completedInterviews: completedInterviewRows?.length ?? 0,
        onboarding: onboardingRows?.length ?? 0,
        completedOnboarding: completedOnboardingRows?.length ?? 0,
        employees: employeeRows?.length ?? 0,
      });

      setRecentApplicants(applicants ?? []);
      setRecentEmployees(employees ?? []);
    } catch (err) {
      console.error("REPORTS LOAD ERROR:", err);

      setError(
        err instanceof Error ? err.message : "Failed to load reports."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Helper badge color generator
  const getStatusBadge = (statusStr: string) => {
    const statusLower = statusStr?.toLowerCase() || "";
    if (statusLower.includes("hired") || statusLower.includes("active") || statusLower.includes("regular") || statusLower.includes("completed")) {
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
    }
    if (statusLower.includes("probation") || statusLower.includes("pending") || statusLower.includes("in progress")) {
      return "bg-amber-50 text-amber-700 ring-amber-600/20";
    }
    if (statusLower.includes("rejected") || statusLower.includes("terminated") || statusLower.includes("resigned")) {
      return "bg-rose-50 text-rose-700 ring-rose-600/20";
    }
    return "bg-slate-100 text-slate-700 ring-slate-500/10";
  };

  // --------------------------------------------------
  // Loading state
  // --------------------------------------------------
  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] pb-16 text-[#0F172A]">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#E91E8F]/10 flex items-center justify-center text-[#E91E8F] shrink-0">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-semibold tracking-wide uppercase text-slate-400">Analytics & Insights</p>
                <h1 className="text-sm sm:text-lg font-bold text-slate-900 leading-tight">Reports & Executive Overview</h1>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-6 sm:pt-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 rounded-lg bg-slate-200" />
            <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 rounded-2xl border border-slate-200/60 bg-white p-6" />
              ))}
            </div>
            <div className="h-64 rounded-2xl border border-slate-200/60 bg-white" />
          </div>
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // Error state
  // --------------------------------------------------
  if (error) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] pb-16 text-[#0F172A]">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#E91E8F]/10 flex items-center justify-center text-[#E91E8F] shrink-0">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-semibold tracking-wide uppercase text-slate-400">Analytics & Insights</p>
                <h1 className="text-sm sm:text-lg font-bold text-slate-900 leading-tight">Reports & Executive Overview</h1>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-12">
          <div className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-6 sm:p-8 shadow-sm text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 mb-4">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-slate-900">Failed to load reports</h2>
            <p className="mt-1 text-sm text-slate-500">{error}</p>
            <button
              onClick={loadReports}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#E91E8F] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#d8177f]"
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] pb-16 text-[#0F172A]">
      {/* --------------------------------------------------
          HEADER
      -------------------------------------------------- */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E91E8F]/10 text-[#E91E8F] shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-semibold tracking-wide uppercase text-slate-400">Analytics & Insights</p>
              <h1 className="text-sm sm:text-lg font-bold text-slate-900 leading-tight">Reports & Executive Overview</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 pl-4 border-l border-slate-100">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800 leading-none">Super Admin</p>
              <p className="text-xs text-slate-400 mt-1">Administrator</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-[#E91E8F] to-[#f458ad] text-xs font-bold text-white shadow-sm ring-2 ring-white shrink-0">
              SA
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-6 sm:pt-8">
        {/* Title Action Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">System Dashboard</h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Real-time recruitment pipeline, onboarding metrics, and headcount analytics.
            </p>
          </div>

          <button
            onClick={loadReports}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:bg-slate-100 shrink-0 self-start sm:self-auto"
          >
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Records
          </button>
        </div>

        {/* --------------------------------------------------
            SUMMARY CARDS
        -------------------------------------------------- */}
        <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Applicants */}
          <Link
            href="/recruitment-core-hub-dashboard/applicants"
            className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Total Applicants</p>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{stats.applicants}</p>
            <p className="mt-3 inline-flex items-center text-xs font-semibold text-[#E91E8F] group-hover:translate-x-0.5 transition-transform">
              View Applicants <span className="ml-1">→</span>
            </p>
          </Link>

          {/* Interviews */}
          <Link
            href="/recruitment-core-hub-dashboard/recruitment/interviews"
            className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Total Interviews</p>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 shrink-0">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{stats.interviews}</p>
            <p className="mt-3 inline-flex items-center text-xs font-semibold text-[#E91E8F] group-hover:translate-x-0.5 transition-transform">
              View Interviews <span className="ml-1">→</span>
            </p>
          </Link>

          {/* Completed Interviews */}
          <Link
            href="/recruitment-core-hub-dashboard/recruitment/interviews"
            className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Completed Interviews</p>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{stats.completedInterviews}</p>
            <p className="mt-3 inline-flex items-center text-xs font-semibold text-[#E91E8F] group-hover:translate-x-0.5 transition-transform">
              View Interviews <span className="ml-1">→</span>
            </p>
          </Link>

          {/* Onboarding */}
          <Link
            href="/recruitment-core-hub-dashboard/onboarding"
            className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Onboarding Records</p>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 shrink-0">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{stats.onboarding}</p>
            <p className="mt-3 inline-flex items-center text-xs font-semibold text-[#E91E8F] group-hover:translate-x-0.5 transition-transform">
              View Onboarding <span className="ml-1">→</span>
            </p>
          </Link>

          {/* Completed Onboarding */}
          <Link
            href="/recruitment-core-hub-dashboard/onboarding"
            className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Completed Onboarding</p>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600 shrink-0">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
            </div>
            <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{stats.completedOnboarding}</p>
            <p className="mt-3 inline-flex items-center text-xs font-semibold text-[#E91E8F] group-hover:translate-x-0.5 transition-transform">
              View Onboarding <span className="ml-1">→</span>
            </p>
          </Link>

          {/* Employees */}
          <Link
            href="/recruitment-core-hub-dashboard/employees"
            className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Total Employees</p>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-50 text-[#E91E8F] shrink-0">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{stats.employees}</p>
            <p className="mt-3 inline-flex items-center text-xs font-semibold text-[#E91E8F] group-hover:translate-x-0.5 transition-transform">
              View Employees <span className="ml-1">→</span>
            </p>
          </Link>
        </div>

        {/* --------------------------------------------------
            RECENT APPLICANTS
        -------------------------------------------------- */}
        <section className="mt-8 sm:mt-10 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 sm:px-6 py-4 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">Recent Applicants</h2>
                <p className="text-[11px] sm:text-xs text-slate-500">Latest applicant submissions to the database.</p>
              </div>

              <Link
                href="/recruitment-core-hub-dashboard/applicants"
                className="text-xs font-semibold text-[#E91E8F] hover:underline shrink-0"
              >
                View All
              </Link>
            </div>
          </div>

          {recentApplicants.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-700">No recent applicants found</p>
              <p className="text-xs text-slate-400 mt-1">Applicants will appear here once submitted.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
                <thead className="bg-slate-50/70 text-slate-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 sm:px-6 py-3.5">Applicant</th>
                    <th className="px-4 sm:px-6 py-3.5">Email</th>
                    <th className="px-4 sm:px-6 py-3.5">Status</th>
                    <th className="px-4 sm:px-6 py-3.5">Applied Date</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {recentApplicants.map((applicant) => (
                    <tr key={applicant.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 font-semibold text-slate-800">
                        {applicant.first_name} {applicant.last_name}
                      </td>

                      <td className="px-4 sm:px-6 py-4 text-slate-600">{applicant.email}</td>

                      <td className="px-4 sm:px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${getStatusBadge(applicant.status)}`}>
                          {applicant.status}
                        </span>
                      </td>

                      <td className="px-4 sm:px-6 py-4 text-slate-500 text-xs">
                        {new Date(applicant.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* --------------------------------------------------
            RECENT EMPLOYEES
        -------------------------------------------------- */}
        <section className="mt-8 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 sm:px-6 py-4 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">Recent Employees</h2>
                <p className="text-[11px] sm:text-xs text-slate-500">Newly added employee profiles.</p>
              </div>

              <Link
                href="/recruitment-core-hub-dashboard/employees"
                className="text-xs font-semibold text-[#E91E8F] hover:underline shrink-0"
              >
                View All
              </Link>
            </div>
          </div>

          {recentEmployees.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-700">No recent employees found</p>
              <p className="text-xs text-slate-400 mt-1">Employees will appear here once onboarded.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
                <thead className="bg-slate-50/70 text-slate-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 sm:px-6 py-3.5">Employee</th>
                    <th className="px-4 sm:px-6 py-3.5">ID Number</th>
                    <th className="px-4 sm:px-6 py-3.5">Department</th>
                    <th className="px-4 sm:px-6 py-3.5">Status</th>
                    <th className="px-4 sm:px-6 py-3.5">Date Hired</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {recentEmployees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 font-semibold text-slate-800">
                        {employee.first_name} {employee.last_name}
                      </td>

                      <td className="px-4 sm:px-6 py-4 text-slate-600">{employee.employee_id_number}</td>

                      <td className="px-4 sm:px-6 py-4 text-slate-600">{employee.department}</td>

                      <td className="px-4 sm:px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${getStatusBadge(employee.status)}`}>
                          {employee.status}
                        </span>
                      </td>

                      <td className="px-4 sm:px-6 py-4 text-slate-500 text-xs">
                        {employee.date_hired ? new Date(employee.date_hired).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        }) : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}