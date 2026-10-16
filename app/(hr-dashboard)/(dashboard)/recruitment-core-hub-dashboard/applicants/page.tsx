"use client";

import Link from "next/link";
import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type JobPosition = {
  title: string;
};

type Applicant = {
  id: string;
  job_position_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
  job_positions: JobPosition | null;
};

type ScreeningResult = {
  match_score: number;
  recommendation: string;
  strengths: string[];
  gaps: string[];
  summary: string;
};

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const details = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    const message = [
      details.message,
      details.details,
      details.hint,
      details.code ? `Code: ${details.code}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    if (message) return message;
  }

  if (error instanceof Error) return error.message;

  return String(error || "Unknown error");
}

export default function ApplicantsPage() {
  const supabase = createClient();

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [screeningApplicantId, setScreeningApplicantId] =
    useState<string | null>(null);
  const [screeningResult, setScreeningResult] =
    useState<ScreeningResult | null>(null);
  const [screeningApplicantName, setScreeningApplicantName] = useState("");

  // ==========================================
  // FETCH APPLICANTS FROM THE SHARED DATABASE
  // ==========================================

  const loadApplicants = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // Step 1: Fetch applicants from the HR1 table.
      const { data: applicantData, error: applicantError } = await supabase
        .from("hr1_applicants")
        .select(
          `
            id,
            job_position_id,
            first_name,
            last_name,
            email,
            phone,
            status,
            created_at
          `
        )
        .order("created_at", { ascending: false });

      if (applicantError) {
        throw applicantError;
      }

      const records = applicantData ?? [];

      // Step 2: Fetch the job positions separately.
      // This avoids depending on Supabase's relationship-name syntax.
      const positionIds = [
        ...new Set(records.map((applicant) => applicant.job_position_id)),
      ];

      const positionMap = new Map<string, JobPosition>();

      if (positionIds.length > 0) {
        const { data: positions, error: positionsError } = await supabase
          .from("hr1_job_positions")
          .select("id, title")
          .in("id", positionIds);

        if (positionsError) {
          throw positionsError;
        }

        for (const position of positions ?? []) {
          positionMap.set(position.id, { title: position.title });
        }
      }

      // Step 3: Attach each applicant's job title.
      const formattedApplicants: Applicant[] = records.map((applicant) => ({
        ...applicant,
        job_positions: positionMap.get(applicant.job_position_id) ?? null,
      }));

      setApplicants(formattedApplicants);
    } catch (err: unknown) {
      console.error("APPLICANTS LOAD ERROR:", err);

      setError(
        `Unable to load applicant records: ${getErrorMessage(err)}`
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // The initial Supabase read hydrates this page after the component mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadApplicants();
  }, [loadApplicants]);

  function getPositionTitle(
    jobPosition: JobPosition | null
  ): string {
    return jobPosition?.title || "Not assigned";
  }

  // ==========================================
  // AI SCREENING
  // ==========================================

  async function handleAIScreening(applicant: Applicant) {
    setError("");
    setScreeningApplicantId(applicant.id);
    setScreeningResult(null);
    setScreeningApplicantName(
      `${applicant.first_name} ${applicant.last_name}`
    );

    try {
      const response = await fetch("/recruitment-core-hub-dashboard/api/screening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicant_id: applicant.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "AI screening failed. Please try again."
        );
      }

      const screening = result.screening;

      if (
        !screening ||
        typeof screening.match_score !== "number" ||
        typeof screening.recommendation !== "string" ||
        !Array.isArray(screening.strengths) ||
        !Array.isArray(screening.gaps) ||
        typeof screening.summary !== "string"
      ) {
        throw new Error("The screening service returned an invalid result.");
      }

      setScreeningResult(screening as ScreeningResult);
    } catch (err: unknown) {
      console.error("AI SCREENING ERROR:", err);
      setError(getErrorMessage(err));
    } finally {
      setScreeningApplicantId(null);
    }
  }

  // ==========================================
  // DELETE APPLICANT
  // ==========================================

  async function handleDeleteApplicant(applicantId: string) {
    const applicant = applicants.find(
      (item) => item.id === applicantId
    );

    const candidateName = applicant
      ? `${applicant.first_name} ${applicant.last_name}`
      : "this applicant";

    if (
      !window.confirm(
        `Are you sure you want to delete ${candidateName}? This action cannot be undone.`
      )
    ) {
      return;
    }

    setError("");

    try {
      const { data, error: deleteError } = await supabase
        .from("hr1_applicants")
        .delete()
        .eq("id", applicantId)
        .select("id");

      if (deleteError) {
        throw deleteError;
      }

      // An empty result can mean permissions prevented the deletion.
      if (!data || data.length === 0) {
        throw new Error(
          "No applicant was deleted. Check your account permissions and database policies."
        );
      }

      setApplicants((previous) =>
        previous.filter((item) => item.id !== applicantId)
      );

      if (screeningApplicantName === candidateName) {
        setScreeningResult(null);
        setScreeningApplicantName("");
      }
    } catch (err: unknown) {
      const errorCode =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code?: unknown }).code ?? "")
          : "";
      const databaseMessage = getErrorMessage(err);
      const isLinkedEmployeeError =
        errorCode === "23503" &&
        databaseMessage.includes("hr1_employees_applicant_id_fkey");
      const message = isLinkedEmployeeError
        ? "This applicant is linked to an employee record, so the database blocked deletion to preserve the employee's hiring history. Keep this applicant record, or review the employee link before removing it."
        : databaseMessage;

      // Keep expected database failures out of the Next.js dev error overlay;
      // the actionable message is shown in the page alert below.
      console.warn("Applicant delete failed:", message);
      setError(`Delete failed: ${message}`);
    }
  }

  // ==========================================
  // FILTERING
  // ==========================================

  const filteredApplicants = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return applicants.filter((applicant) => {
      const fullName =
        `${applicant.first_name} ${applicant.last_name}`.toLowerCase();

      const matchesSearch =
        fullName.includes(query) ||
        applicant.email.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        applicant.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [applicants, searchQuery, statusFilter]);

  // Use the actual statuses stored in the database.
  const availableStatuses = useMemo(
    () => [...new Set(applicants.map((item) => item.status).filter(Boolean))].sort(),
    [applicants]
  );

  // ==========================================
  // STATUS BADGES
  // ==========================================

  function getStatusClass(status: string) {
    switch (status.toLowerCase()) {
      case "applied":
      case "pending":
        return "bg-gray-100 text-gray-700 ring-gray-200";

      case "under review":
      case "screening":
        return "bg-blue-50 text-blue-700 ring-blue-200";

      case "shortlisted":
        return "bg-indigo-50 text-indigo-700 ring-indigo-200";

      case "interview scheduled":
      case "initial interview":
      case "final interview":
        return "bg-purple-50 text-purple-700 ring-purple-200";

      case "passed interview":
      case "passed":
        return "bg-emerald-50 text-emerald-700 ring-emerald-200";

      case "failed interview":
      case "rejected":
        return "bg-red-50 text-red-700 ring-red-200";

      case "rescheduled":
        return "bg-amber-50 text-amber-700 ring-amber-200";

      case "for onboarding":
      case "hired":
      case "training":
        return "bg-green-100 text-green-800 ring-green-300";

      default:
        return "bg-gray-100 text-gray-700 ring-gray-200";
    }
  }

  // ==========================================
  // PAGE UI
  // ==========================================

  return (
    <main className="min-h-screen bg-[#F8F9FA] pb-16">
      {/* Main Container */}
      <div className="mx-auto max-w-7xl space-y-6 px-4 pt-8 sm:px-6">
        {/* Title Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-[#121212]">
              Applicants
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Manage candidate profiles, review AI-assisted screening
              results, and track recruitment progress.
            </p>
          </div>

          <Link
            href="/recruitment-core-hub-dashboard/applicants/new"
            className="inline-flex items-center justify-center rounded-xl bg-[#e5167e] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#b3115f] active:scale-[0.98]"
          >
            + Add Applicant
          </Link>
        </div>

        {/* Error Notice */}
        {error && (
          <div
            role="alert"
            className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700 shadow-sm"
          >
            <span className="break-words">{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
              className="shrink-0 font-bold text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* Applicant Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
          {/* Search, Status Filter, Refresh */}
          <div className="flex flex-col gap-3.5 border-b border-gray-100 px-4 py-4 md:flex-row md:items-center md:justify-between sm:px-6">
            <div className="flex flex-1 flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full max-w-md flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </span>

                <input
                  type="text"
                  placeholder="Search by candidate name or email..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2 pl-10 pr-3.5 text-xs text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#e5167e] focus:bg-white focus:ring-2 focus:ring-[#e5167e]/15"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2 text-xs text-gray-800 outline-none transition focus:border-[#e5167e] focus:bg-white focus:ring-2 focus:ring-[#e5167e]/15"
              >
                <option value="ALL">All Statuses</option>
                {availableStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => void loadApplicants()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg
                    className="h-3.5 w-3.5 animate-spin text-[#e5167e]"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Refreshing...
                </>
              ) : (
                <>
                  <svg
                    className="h-3.5 w-3.5 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 014.582 9M4.582 9H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2M19.419 15H15"
                    />
                  </svg>
                  Refresh List
                </>
              )}
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-[#e5167e]">
                  <svg
                    className="h-5 w-5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l-2.647-3z"
                    />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-gray-500">
                  Loading applicant data...
                </p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredApplicants.length === 0 && (
            <div className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-50/80 text-2xl shadow-sm">
                👤
              </div>

              <h3 className="text-sm font-bold text-[#121212]">
                No applicant records found
              </h3>

              <p className="mt-1 max-w-sm text-xs leading-relaxed text-gray-400">
                {searchQuery || statusFilter !== "ALL"
                  ? "Try adjusting your search or status filter."
                  : "Applicant records will appear here when applications are submitted or encoded."}
              </p>

              {!searchQuery && statusFilter === "ALL" && (
                <Link
                  href="/recruitment-core-hub-dashboard/applicants/new"
                  className="mt-5 rounded-xl bg-[#e5167e] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#b3115f]"
                >
                  Add First Applicant
                </Link>
              )}
            </div>
          )}

          {/* Applicant Data Table */}
          {!loading && filteredApplicants.length > 0 && (
            <div className="max-w-full overflow-x-auto" tabIndex={0} aria-label="Applicant records table; scroll horizontally to see all columns">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-100 bg-gray-50/75 font-semibold uppercase tracking-wider text-gray-400">
                  <tr>
                    <th className="px-3 py-3.5 sm:px-4">Candidate</th>
                    <th className="px-3 py-3.5 sm:px-4">Applied Position</th>
                    <th className="px-3 py-3.5 sm:px-4">Contact Email</th>
                    <th className="px-3 py-3.5 sm:px-4">Phone</th>
                    <th className="px-3 py-3.5 sm:px-4">Status</th>
                    <th className="px-3 py-3.5 sm:px-4">Date Added</th>
                    <th className="px-3 py-3.5 text-right sm:px-4">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  {filteredApplicants.map((applicant) => (
                    <tr
                      key={applicant.id}
                      className="transition-colors hover:bg-gray-50/60"
                    >
                      <td className="px-3 py-4 sm:px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[11px] font-bold text-gray-600">
                            {applicant.first_name?.[0] ?? ""}
                            {applicant.last_name?.[0] ?? ""}
                          </div>

                          <span className="whitespace-nowrap font-bold text-[#121212]">
                            {applicant.first_name} {applicant.last_name}
                          </span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-3 py-4 text-gray-600 sm:px-4">
                        {getPositionTitle(applicant.job_positions)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-4 text-gray-500 sm:px-4">
                        {applicant.email}
                      </td>

                      <td className="whitespace-nowrap px-3 py-4 text-gray-500 sm:px-4">
                        {applicant.phone}
                      </td>

                      <td className="whitespace-nowrap px-3 py-4 sm:px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${getStatusClass(
                            applicant.status || "applied"
                          )}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-75" />
                          {applicant.status || "applied"}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-3 py-4 text-gray-400 sm:px-4">
                        {new Date(applicant.created_at).toLocaleDateString(
                          "en-PH",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </td>

                      <td className="whitespace-nowrap px-3 py-4 text-right sm:px-4">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Link
                            href={`/recruitment-core-hub-dashboard/applicants/${applicant.id}/edit`}
                            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
                          >
                            Profile & Documents
                          </Link>

                          <button
                            type="button"
                            onClick={() => void handleAIScreening(applicant)}
                            disabled={
                              screeningApplicantId !== null
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                            title="Generate an AI-assisted screening analysis"
                          >
                            {screeningApplicantId === applicant.id
                              ? "Screening..."
                              : "AI Screen"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleDeleteApplicant(applicant.id)
                            }
                            className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* AI Screening Result */}
        {screeningResult && (
          <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-col gap-4 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="rounded-md bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  AI-Assisted Candidate Screening
                </span>

                <h3 className="mt-2 text-xl font-black text-[#121212]">
                  {screeningApplicantName}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  setScreeningResult(null);
                  setScreeningApplicantName("");
                }}
                className="self-start rounded-xl border border-gray-200 px-3.5 py-1.5 text-xs font-bold text-gray-500 transition hover:bg-gray-50 sm:self-auto"
              >
                Close Summary
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                <p className="text-xs font-semibold text-blue-700">
                  Role Match Score
                </p>
                <p className="mt-1 text-3xl font-black text-blue-900">
                  {screeningResult.match_score}%
                </p>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                <p className="text-xs font-semibold text-emerald-700">
                  AI Recommendation
                </p>
                <p className="mt-1 text-lg font-bold text-emerald-900">
                  {screeningResult.recommendation}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Evaluation Summary
              </h4>

              <p className="mt-1.5 rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs leading-relaxed text-gray-700">
                {screeningResult.summary}
              </p>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Key Strengths
                </h4>

                <ul className="mt-2.5 space-y-2">
                  {screeningResult.strengths.map((item, index) => (
                    <li
                      key={index}
                      className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-3.5 py-2.5 text-xs font-medium text-emerald-900"
                    >
                      ✓ {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700">
                  Identified Gaps
                </h4>

                <ul className="mt-2.5 space-y-2">
                  {screeningResult.gaps.map((item, index) => (
                    <li
                      key={index}
                      className="rounded-xl border border-amber-100 bg-amber-50/80 px-3.5 py-2.5 text-xs font-medium text-amber-900"
                    >
                      • {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
              Note: AI screening is an advisory tool only. HR must review
              the results and make the final recruitment decision.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
