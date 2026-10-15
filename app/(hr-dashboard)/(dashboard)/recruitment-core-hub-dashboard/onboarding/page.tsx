"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

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
  required_documents: string[];
  onboarding_documents: {
    document_type: string;
    verification_status: string;
    created_at: string;
  }[];

  applicants:
    | {
        first_name: string;
        last_name: string;
        email: string;
      }
    | null;
};

function describeSupabaseError(error: unknown) {
  if (!error || typeof error !== "object") return String(error);
  const value = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
  return [
    value.code ? `code=${value.code}` : null,
    value.message ?? "Unknown Supabase error",
    value.details ? `details=${value.details}` : null,
    value.hint ? `hint=${value.hint}` : null,
  ].filter(Boolean).join(" | ");
}

function onboardingErrorMessage(error: unknown) {
  const detail = describeSupabaseError(error);
  const normalized = detail.toLowerCase();
  if (
    normalized.includes("required_documents") ||
    normalized.includes("onboarding_id") ||
    normalized.includes("hr1_onboarding_invites")
  ) {
    return `Onboarding database setup is incomplete. Run the HR1 onboarding migration in Supabase SQL Editor, then refresh. (${detail})`;
  }
  return `Unable to load onboarding records: ${detail}`;
}

export default function OnboardingPage() {
  const supabase = createClient();

  const [onboardings, setOnboardings] = useState<Onboarding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadOnboardings() {
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
          required_documents,
          applicants:hr1_applicants (
            first_name,
            last_name,
            email
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        // Log scalar fields explicitly; Next's dev console formatter can render
        // the Supabase error object as {} and hide the actual database message.
        console.warn("ONBOARDING LOAD ERROR:", describeSupabaseError(error));
        setError(onboardingErrorMessage(error));
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as unknown as Onboarding[];
      const onboardingIds = rows.map((row) => row.id);
      const { data: documents, error: documentsError } = onboardingIds.length
        ? await supabase.from("hr1_applicant_documents")
            .select("onboarding_id, document_type, verification_status, created_at")
            .in("onboarding_id", onboardingIds).order("created_at", { ascending: false })
        : { data: [], error: null };
      if (documentsError) throw documentsError;
      setOnboardings(rows.map((row) => ({
        ...row,
        required_documents: Array.isArray(row.required_documents) ? row.required_documents : [],
        onboarding_documents: (documents ?? []).filter((document) => document.onboarding_id === row.id),
      })));
    } catch (err: unknown) {
      console.warn("ONBOARDING CATCH ERROR:", describeSupabaseError(err));
      setError(onboardingErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // The initial Supabase read hydrates this page after the component mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOnboardings();
  }, []);

  function isCompleted(onboarding: Onboarding) {
    const latest = latestDocuments(onboarding);
    return onboarding.required_documents.length > 0
      && onboarding.required_documents.every((type) => latest.get(type)?.verification_status === "Verified")
      && onboarding.training_completed;
  }

  function getCompletedCount(onboarding: Onboarding) {
    const latest = latestDocuments(onboarding);
    return onboarding.required_documents.filter((type) => latest.get(type)?.verification_status === "Verified").length
      + (onboarding.training_completed ? 1 : 0);
  }

  function latestDocuments(onboarding: Onboarding) {
    const latest = new Map<string, Onboarding["onboarding_documents"][number]>();
    for (const document of onboarding.onboarding_documents ?? []) {
      if (!latest.has(document.document_type)) latest.set(document.document_type, document);
    }
    return latest;
  }

  function isRequirementVerified(onboarding: Onboarding, type: string) {
    return latestDocuments(onboarding).get(type)?.verification_status === "Verified";
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this onboarding record?"
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      const { error } = await supabase
        .from("hr1_onboardings")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("ONBOARDING DELETE ERROR:", error);
        setError(`Delete failed: ${error.message}`);
        return;
      }

      setOnboardings((current) =>
        current.filter((onboarding) => onboarding.id !== id)
      );
    } catch (err: unknown) {
      console.error("ONBOARDING DELETE CATCH ERROR:", err);
      setError(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] pb-16 text-[#0F172A]">

      {/* HEADER */}


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
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#e5167e] px-5 py-2.5 text-xs font-semibold text-white shadow-sm shadow-[#e5167e]/30 transition hover:bg-[#d8177f] focus:outline-none focus:ring-4 focus:ring-[#e5167e]/20 active:scale-[0.98]"
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
                Send each hired applicant a separate secure onboarding form for requested IDs, diploma, certificates, and other documents. This is separate from the public /apply application form.
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
                    {[...Array(7)].map((_, idx) => (
                      <div key={idx} className="h-6 w-6 bg-slate-100 rounded-full" />
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
          {!loading &&
            !error &&
            onboardings.length === 0 && (

              <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">

                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-50 text-[#e5167e] text-2xl">
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
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#e5167e] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#d8177f]"
                >
                  <svg className="h-4 w-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Start First Onboarding
                </Link>

              </div>

            )}

          {/* TABLE */}
          {!loading &&
            !error &&
            onboardings.length > 0 && (

              <div className="max-w-full overflow-x-auto" tabIndex={0} aria-label="Onboarding records table; scroll horizontally to see all columns">

                <table className="w-full text-left text-xs">

                  <thead className="border-b border-slate-200 bg-slate-50/70 font-bold uppercase tracking-wider text-slate-500">

                    <tr>

                      <th className="px-6 py-3.5">
                        Applicant
                      </th>

                      <th className="px-3 py-3.5 text-center">
                        SSS
                      </th>

                      <th className="px-3 py-3.5 text-center">
                        PhilHealth
                      </th>

                      <th className="px-3 py-3.5 text-center">
                        Pag-IBIG
                      </th>

                      <th className="px-3 py-3.5 text-center">
                        TIN
                      </th>

                      <th className="px-3 py-3.5 text-center">
                        Clearance
                      </th>

                      <th className="px-3 py-3.5 text-center">
                        Medical
                      </th>

                      <th className="px-3 py-3.5 text-center">
                        Training
                      </th>

                      <th className="px-6 py-3.5">
                        Status & Progress
                      </th>

                      <th className="px-6 py-3.5 text-right">
                        Actions
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {onboardings.map(
                      (onboarding) => {

                        const completed = isCompleted(onboarding);
                        const completedCount = getCompletedCount(onboarding);

                        return (
                          <tr
                            key={onboarding.id}
                            className="group transition-colors hover:bg-slate-50/80"
                          >

                            {/* APPLICANT */}
                            <td className="px-6 py-4">

                              <p className="font-semibold text-slate-900 group-hover:text-[#e5167e] transition-colors">

                                {onboarding.applicants
                                  ? `${onboarding.applicants.first_name} ${onboarding.applicants.last_name}`
                                  : "Unknown Applicant"}

                              </p>

                              {onboarding.applicants && (
                                <p className="mt-0.5 text-[11px] text-slate-500">
                                  {onboarding.applicants.email}
                                </p>
                              )}

                            </td>

                            {/* SSS */}
                            <td className="px-3 py-4 text-center">
                              {isRequirementVerified(onboarding, "sss") ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                                  ✓
                                </span>
                              ) : (
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-200" />
                              )}
                            </td>

                            {/* PHILHEALTH */}
                            <td className="px-3 py-4 text-center">
                              {isRequirementVerified(onboarding, "philhealth") ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                                  ✓
                                </span>
                              ) : (
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-200" />
                              )}
                            </td>

                            {/* PAG-IBIG */}
                            <td className="px-3 py-4 text-center">
                              {isRequirementVerified(onboarding, "pagibig") ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                                  ✓
                                </span>
                              ) : (
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-200" />
                              )}
                            </td>

                            {/* TIN */}
                            <td className="px-3 py-4 text-center">
                              {isRequirementVerified(onboarding, "tin") ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                                  ✓
                                </span>
                              ) : (
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-200" />
                              )}
                            </td>

                            {/* CLEARANCE */}
                            <td className="px-3 py-4 text-center">
                              {isRequirementVerified(onboarding, "clearance") ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                                  ✓
                                </span>
                              ) : (
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-200" />
                              )}
                            </td>

                            {/* MEDICAL */}
                            <td className="px-3 py-4 text-center">
                              {isRequirementVerified(onboarding, "medical") ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                                  ✓
                                </span>
                              ) : (
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-200" />
                              )}
                            </td>

                            {/* TRAINING */}
                            <td className="px-3 py-4 text-center">
                              {onboarding.training_completed ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                                  ✓
                                </span>
                              ) : (
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-200" />
                              )}
                            </td>

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
                                  {completedCount} of {onboarding.required_documents.length + 1} requirements
                                </span>
                              </div>
                            </td>

                            {/* ACTIONS */}
                            <td className="px-6 py-4 text-right">

                              <div className="flex items-center justify-end gap-2">

                                <Link
                                  href={`/recruitment-core-hub-dashboard/onboarding/edit/${onboarding.id}`}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm transition hover:border-[#e5167e] hover:bg-pink-50/50 hover:text-[#e5167e]"
                                >
                                  Edit
                                </Link>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDelete(
                                      onboarding.id
                                    )
                                  }
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
                                >
                                  Delete
                                </button>

                              </div>

                            </td>

                          </tr>
                        );
                      }
                    )}

                  </tbody>

                </table>

              </div>
            )}

        </div>

      </div>

    </main>
  );
}
