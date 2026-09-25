"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type Applicant = {
  first_name: string;
  last_name: string;
  email: string;
};

type Onboarding = {
  id: string;
  applicant_id: string;
  sss_submitted: boolean;
  philhealth_submitted: boolean;
  pagibig_submitted: boolean;
  tin_submitted: boolean;
  clearance_submitted: boolean;
  medical_submitted: boolean;
  training_completed: boolean;
  remarks: string | null;
  completed_at: string | null;
  created_at: string;
  hr1_applicants: Applicant | null;
};

type RequirementKey = 
  | "sss_submitted"
  | "philhealth_submitted"
  | "pagibig_submitted"
  | "tin_submitted"
  | "clearance_submitted"
  | "medical_submitted"
  | "training_completed";

const REQUIREMENTS: Array<{ key: RequirementKey; label: string }> = [
  { key: "sss_submitted", label: "SSS" },
  { key: "philhealth_submitted", label: "PhilHealth" },
  { key: "pagibig_submitted", label: "Pag-IBIG" },
  { key: "tin_submitted", label: "TIN" },
  { key: "clearance_submitted", label: "Clearance" },
  { key: "medical_submitted", label: "Medical" },
  { key: "training_completed", label: "Training" },
];

export default function OnboardingPage() {
  const supabase = createClient();

  const [onboardings, setOnboardings] = useState<Onboarding[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOnboardings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from("hr1_onboardings")
        .select(`
          id,
          applicant_id,
          sss_submitted,
          philhealth_submitted,
          pagibig_submitted,
          tin_submitted,
          clearance_submitted,
          medical_submitted,
          training_completed,
          remarks,
          completed_at,
          created_at,
          hr1_applicants (
            first_name,
            last_name,
            email
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      setOnboardings((data as unknown as Onboarding[]) ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      console.error("ONBOARDING LOAD ERROR:", err);
      setError(`Unable to load onboarding records: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadOnboardings();
  }, [loadOnboardings]);

  function getCompletedCount(onboarding: Onboarding): number {
    return REQUIREMENTS.reduce(
      (count, req) => (onboarding[req.key] ? count + 1 : count),
      0
    );
  }

  function isCompleted(onboarding: Onboarding): boolean {
    return getCompletedCount(onboarding) === REQUIREMENTS.length;
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Are you sure you want to delete this onboarding record?")) {
      return;
    }

    setDeletingId(id);
    setError(null);

    try {
      const { error } = await supabase
        .from("hr1_onboardings")
        .delete()
        .eq("id", id);

      if (error) {
        throw new Error(error.message);
      }

      setOnboardings((prev) => prev.filter((item) => item.id !== id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      console.error("ONBOARDING DELETE ERROR:", err);
      setError(`Delete failed: ${message}`);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] pb-16 text-[#0F172A]">
      {/* HEADER */}
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2.5">
            <Image
              src="/images/logo.jpg"
              alt="Department Logo"
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 rounded-md object-contain"
              priority
            />
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 leading-tight">
                Human Resource Department
              </span>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-tight">
                Recruitment & Employee Records
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 pl-3 sm:pl-4 border-l border-slate-100">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800 leading-none">
                Super Admin
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Administrator
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#E91E8F] to-[#f458ad] text-xs font-bold text-white shadow-sm ring-2 ring-white">
              SA
            </div>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-6 sm:pt-8">
        {/* HEADING */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              New Hire Onboarding
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Track onboarding requirements, statutory clearances, and employee preparation.
            </p>
          </div>

          <Link
            href="/recruitment-core-hub-dashboard/onboarding/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E91E8F] px-5 py-2.5 text-xs font-semibold text-white shadow-sm shadow-[#E91E8F]/30 transition hover:bg-[#d8177f] focus:outline-none focus:ring-4 focus:ring-[#E91E8F]/20 active:scale-[0.98]"
          >
            <svg
              className="h-4 w-4 stroke-[2.5]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Start Onboarding
          </Link>
        </div>

        {/* MAIN CARD */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* CARD HEADER */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Onboarding Records
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Track submitted requirements and statutory document progress.
              </p>
            </div>

            {!loading && !error && onboardings.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {onboardings.length} {onboardings.length === 1 ? "Record" : "Records"}
              </span>
            )}
          </div>

          {/* LOADING STATE */}
          {loading && (
            <div className="p-8 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between gap-4 animate-pulse">
                  <div className="h-10 w-48 bg-slate-100 rounded-lg" />
                  <div className="hidden sm:flex gap-2">
                    {REQUIREMENTS.map((req) => (
                      <div key={req.key} className="h-6 w-6 bg-slate-100 rounded-full" />
                    ))}
                  </div>
                  <div className="h-8 w-24 bg-slate-100 rounded-lg" />
                </div>
              ))}
            </div>
          )}

          {/* ERROR ALERT */}
          {!loading && error && (
            <div className="m-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-xs font-medium text-red-700">
              <svg className="h-5 w-5 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* EMPTY STATE */}
          {!loading && !error && onboardings.length === 0 && (
            <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-50 text-[#E91E8F]">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                No onboarding records yet
              </h3>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Start an onboarding record for an applicant who has successfully passed the recruitment process.
              </p>
              <Link
                href="/recruitment-core-hub-dashboard/onboarding/new"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#E91E8F] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#d8177f]"
              >
                <svg className="h-4 w-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Start First Onboarding
              </Link>
            </div>
          )}

          {/* TABLE */}
          {!loading && !error && onboardings.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/70 font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-3.5">Applicant</th>
                    {REQUIREMENTS.map((req) => (
                      <th key={req.key} className="px-3 py-3.5 text-center">
                        {req.label}
                      </th>
                    ))}
                    <th className="px-6 py-3.5">Status & Progress</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {onboardings.map((onboarding) => {
                    const completed = isCompleted(onboarding);
                    const completedCount = getCompletedCount(onboarding);
                    const applicant = onboarding.hr1_applicants;

                    return (
                      <tr
                        key={onboarding.id}
                        className="group transition-colors hover:bg-slate-50/80"
                      >
                        {/* APPLICANT */}
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900 group-hover:text-[#E91E8F] transition-colors">
                            {applicant
                              ? `${applicant.first_name} ${applicant.last_name}`
                              : "Unknown Applicant"}
                          </p>
                          {applicant && (
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {applicant.email}
                            </p>
                          )}
                        </td>

                        {/* STATUTORY CHECKBOXES */}
                        {REQUIREMENTS.map((req) => (
                          <td key={req.key} className="px-3 py-4 text-center">
                            {onboarding[req.key] ? (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                                ✓
                              </span>
                            ) : (
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-200" />
                            )}
                          </td>
                        ))}

                        {/* STATUS */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-bold ring-1 ring-inset ${
                                completed
                                  ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                                  : "bg-amber-50 text-amber-700 ring-amber-600/20"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  completed ? "bg-emerald-600" : "bg-amber-500"
                                }`}
                              />
                              {completed ? "Completed" : "In Progress"}
                            </span>

                            <span className="text-[11px] font-medium text-slate-400">
                              {completedCount} of {REQUIREMENTS.length} requirements
                            </span>
                          </div>
                        </td>

                        {/* ACTIONS */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/recruitment-core-hub-dashboard/onboarding/edit/${onboarding.id}`}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm transition hover:border-[#E91E8F] hover:bg-pink-50/50 hover:text-[#E91E8F]"
                            >
                              Edit
                            </Link>

                            <button
                              type="button"
                              disabled={deletingId === onboarding.id}
                              onClick={() => handleDelete(onboarding.id)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50"
                            >
                              {deletingId === onboarding.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}