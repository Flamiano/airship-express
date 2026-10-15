"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type Applicant = {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  status: string;
};

type Interview = {
  id: string;
  applicant_id: string;
  interviewer_name: string | null;
  scheduled_date: string;
  location_or_link: string | null;
  status: string;
  rating: number | null;
  feedback: string | null;
  outcome: string | null;
  stage: string;
  created_at: string;
  applicants: Applicant | Applicant[] | null;
};

export default function InterviewsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [stageFilter, setStageFilter] = useState("ALL");

  // ==========================================
  // FETCH INTERVIEWS
  // ==========================================

  async function loadInterviews() {
    setLoading(true);
    setError("");

    try {
      const { data, error: fetchError } = await supabase
        .from("hr1_interviews")
        .select(`
          id,
          applicant_id,
          interviewer_name,
          scheduled_date,
          location_or_link,
          status,
          rating,
          feedback,
          outcome,
          stage,
          created_at,
          applicants:hr1_applicants (
            id,
            first_name,
            last_name,
            email,
            status
          )
        `)
        .order("scheduled_date", { ascending: true });

      if (fetchError) throw fetchError;

      setInterviews((data as unknown as Interview[]) || []);
    } catch (err: unknown) {
      console.error("INTERVIEWS LOAD ERROR (FULL):", JSON.stringify(err, null, 2));
      setError(`Unable to load interview schedules: ${err?.message || "Unexpected error"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // The initial Supabase read hydrates this page after the component mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInterviews();
  }, []);

  // Helper function to resolve applicant name safely
  function getApplicantName(applicants: Applicant | Applicant[] | null): string {
    if (!applicants) return "Unknown Applicant";
    if (Array.isArray(applicants)) {
      const applicant = applicants[0];
      if (!applicant) return "Unknown Applicant";
      return applicant.full_name || `${applicant.first_name || ""} ${applicant.last_name || ""}`.trim() || "Unknown Applicant";
    }
    return applicants.full_name || `${applicants.first_name || ""} ${applicants.last_name || ""}`.trim() || "Unknown Applicant";
  }

  function formatDate(date: string) {
    if (!date) return "N/A";
    return new Date(date).toLocaleString("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  // ==========================================
  // DELETE INTERVIEW RECORD
  // ==========================================

  async function handleDelete(interviewId: string) {
    const confirmed = window.confirm("Are you sure you want to delete this interview record?");
    if (!confirmed) return;

    setDeletingId(interviewId);
    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("hr1_interviews")
        .delete()
        .eq("id", interviewId);

      if (deleteError) throw deleteError;

      setInterviews((current) => current.filter((interview) => interview.id !== interviewId));
    } catch (err: unknown) {
      console.error("INTERVIEW DELETE ERROR:", err);
      setError(`Delete failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setDeletingId(null);
    }
  }

  // ==========================================
  // SEARCH & FILTER LOGIC
  // ==========================================

  const filteredInterviews = useMemo(() => {
    return interviews.filter((interview) => {
      const applicantName = getApplicantName(interview.applicants).toLowerCase();
      const location = (interview.location_or_link || "").toLowerCase();

      const matchesSearch =
        applicantName.includes(searchQuery.toLowerCase()) ||
        location.includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" || interview.status === statusFilter;

      const matchesStage = stageFilter === "ALL" || interview.stage === stageFilter;

      return matchesSearch && matchesStatus && matchesStage;
    });
  }, [interviews, searchQuery, statusFilter, stageFilter]);

  // ==========================================
  // BADGE STYLING
  // ==========================================

  function getStatusClass(status: string) {
    switch (status) {
      case "Scheduled":
        return "bg-blue-50 text-blue-700 ring-blue-200";
      case "Completed":
        return "bg-emerald-50 text-emerald-700 ring-emerald-200";
      case "Cancelled":
        return "bg-red-50 text-red-700 ring-red-200";
      case "Reschedule":
      case "Rescheduled":
        return "bg-amber-50 text-amber-700 ring-amber-200";
      default:
        return "bg-gray-100 text-gray-700 ring-gray-200";
    }
  }

  function getOutcomeClass(outcome: string | null) {
    switch (outcome) {
      case "Passed":
        return "bg-emerald-50 text-emerald-700 ring-emerald-200";
      case "Failed":
        return "bg-red-50 text-red-700 ring-red-200";
      case "Pending":
      case "Under Review":
        return "bg-amber-50 text-amber-700 ring-amber-200";
      default:
        return "bg-gray-50 text-gray-500 ring-gray-200";
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F9FA] pb-16">
      {/* Top Header */}


      {/* Main Container */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-6 sm:pt-8">
        {/* Title Bar */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[#121212]">Interviews</h2>
            <p className="mt-1 text-xs text-gray-500">
              Track each applicant through Initial Interview → Assessment → Final Interview, including schedules and results.
            </p>
          </div>

          <Link
            href="/recruitment-core-hub-dashboard/recruitment/interviews/new"
            className="inline-flex items-center justify-center rounded-xl bg-[#e5167e] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#b3115f] active:scale-[0.99]"
          >
            + Schedule Interview
          </Link>
        </div>

        {/* Global Error Notice */}
        {error && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-semibold text-red-700">
            <span>{error}</span>
            <button onClick={() => setError("")} className="font-bold text-red-500 hover:text-red-700">
              ✕
            </button>
          </div>
        )}

        {/* Records Card Container */}
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {/* Controls Bar */}
          <div className="flex flex-col gap-4 border-b border-gray-100 px-4 sm:px-6 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                type="text"
                placeholder="Search candidate name or venue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:max-w-xs rounded-xl border border-gray-200 px-3.5 py-2 text-xs text-gray-800 outline-none transition focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/15 placeholder:text-gray-400"
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs text-gray-800 outline-none transition focus:border-[#e5167e]"
              >
                <option value="ALL">All Statuses</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Completed">Completed</option>
                <option value="Reschedule">Rescheduled</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="w-full sm:w-auto rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs text-gray-800 outline-none transition focus:border-[#e5167e]"
                aria-label="Filter by recruitment stage"
              >
                <option value="ALL">All Stages</option>
                <option value="Initial Interview">Initial Interview</option>
                <option value="Assessment">Assessment</option>
                <option value="Final Interview">Final Interview</option>
                <option value="Legacy / Unspecified">Legacy / Unspecified</option>
              </select>
            </div>

            <button
              type="button"
              onClick={loadInterviews}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin text-[#e5167e]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Refreshing...</span>
                </>
              ) : (
                "Refresh List"
              )}
            </button>
          </div>

          {/* Loading View */}
          {loading && (
            <div className="flex min-h-[320px] items-center justify-center p-8">
              <div className="flex flex-col items-center gap-3">
                <div className="relative flex h-12 w-12 items-center justify-center">
                  <div className="absolute h-12 w-12 animate-ping rounded-full bg-[#e5167e]/10 opacity-75" />
                  <svg className="h-7 w-7 animate-spin text-[#e5167e]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-gray-500">Loading interview schedules...</p>
              </div>
            </div>
          )}

          {/* Empty View */}
          {!loading && filteredInterviews.length === 0 && (
            <div className="flex min-h-[340px] flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-50 text-2xl shadow-sm ring-8 ring-pink-50/50">
                📅
              </div>
              <h3 className="text-sm font-bold text-[#121212]">No interviews scheduled</h3>
              <p className="mt-1 max-w-sm text-xs text-gray-400 leading-relaxed">
                {searchQuery || statusFilter !== "ALL"
                  ? "No records match your active search or filter criteria. Try clearing filters."
                  : "Start scheduling interview appointments for active candidates to track progress."}
              </p>
              {!searchQuery && statusFilter === "ALL" && (
                <Link
                  href="/recruitment-core-hub-dashboard/recruitment/interviews/new"
                  className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[#e5167e] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#b3115f]"
                >
                  + Schedule First Interview
                </Link>
              )}
            </div>
          )}

          {/* Data Table */}
          {!loading && filteredInterviews.length > 0 && (
            <div className="max-w-full overflow-x-auto" tabIndex={0} aria-label="Interview records table; scroll horizontally to see all columns">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-100 bg-gray-50/70 uppercase tracking-wider text-gray-400 font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">Applicant Name</th>
                    <th className="px-6 py-3.5">Recruitment Stage</th>
                    <th className="px-6 py-3.5">Schedule Date & Time</th>
                    <th className="px-6 py-3.5">Location / Meeting Link</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Rating</th>
                    <th className="px-6 py-3.5">Outcome</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  {filteredInterviews.map((interview) => {
                    const applicantObj = Array.isArray(interview.applicants)
                      ? interview.applicants[0]
                      : interview.applicants;
                    const applicantKey = applicantObj?.id || interview.id;

                    return (
                      <tr key={interview.id} className="transition hover:bg-gray-50/50">
                        {/* APPLICANT */}
                        <td className="px-6 py-4">
                          <span className="font-bold text-[#121212]" key={applicantKey}>
                            {getApplicantName(interview.applicants)}
                          </span>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex rounded-full bg-pink-50 px-2.5 py-1 text-[11px] font-semibold text-pink-700 ring-1 ring-inset ring-pink-200">
                            {interview.stage || "Legacy / Unspecified"}
                          </span>
                        </td>

                        {/* DATE */}
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                          {formatDate(interview.scheduled_date)}
                        </td>

                        {/* LOCATION */}
                        <td className="max-w-[220px] px-6 py-4 text-gray-500">
                          <span className="truncate block" title={interview.location_or_link || ""}>
                            {interview.location_or_link || "Not specified"}
                          </span>
                        </td>

                        {/* STATUS */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${getStatusClass(
                              interview.status
                            )}`}
                          >
                            {interview.status}
                          </span>
                        </td>

                        {/* RATING */}
                        <td className="px-6 py-4 font-semibold text-gray-600 whitespace-nowrap">
                          {interview.rating !== null ? (
                            <span className="inline-flex items-center gap-1 text-amber-600">
                              ★ <span className="text-gray-800">{interview.rating}/5</span>
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* OUTCOME */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${getOutcomeClass(
                              interview.outcome
                            )}`}
                          >
                            {interview.outcome || "Pending"}
                          </span>
                        </td>

                        {/* ACTIONS */}
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(`/recruitment-core-hub-dashboard/recruitment/interviews/edit/${interview.id}`)
                              }
                              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(interview.id)}
                              disabled={deletingId === interview.id}
                              className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingId === interview.id ? "Deleting..." : "Delete"}
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
